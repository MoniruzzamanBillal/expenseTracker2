import axios from "axios";
import { getBaseUrl } from "./envConfig";
import { getRefreshToken, setAccessToken } from "./tokenStorage";

/**
 * The single-flight access-token refresh (spec 39 D3/D4).
 *
 * Called from `axiosInstance`'s 401 branch. Deliberately uses a **bare** `axios.post` rather
 * than the shared instance (spec 39 D4):
 *   1. re-entrancy - the shared instance's error interceptor is what calls this, so a 401 here
 *      would re-enter that branch;
 *   2. the shared instance's success interceptor rewrites responses to `{ data, meta }`, so the
 *      token would have to be dug out through an extra layer of reshaping;
 *   3. the shared instance resolves on error instead of rejecting (`known-issues.md#FETCH-1`),
 *      which would make the try/catch below dead code.
 *
 * `getBaseUrl()` is reused so the hand-toggled baseURL in `envConfig.ts` applies here too.
 */

export const REFRESH_PATH = "/auth/refresh-token";

/**
 * Thrown when the refresh request itself never reached a server (offline, DNS, timeout).
 *
 * This has to be distinguishable from "the server rejected the refresh token", because the two
 * demand opposite handling: a rejection means the session is over, a network failure means the
 * refresh token is probably fine and the user must stay logged in. Collapsing them is how a
 * flaky connection would end up logging people out (spec 39 D6b).
 */
export class RefreshNetworkError extends Error {
  constructor() {
    super("Could not reach the server to refresh the session.");
    this.name = "RefreshNetworkError";
  }
}

let inFlight: Promise<string | null> | null = null;

/**
 * Returns the new access token, or `null` when the refresh token is genuinely dead (the caller
 * should then log the user out). Throws `RefreshNetworkError` when the attempt never reached a
 * server.
 *
 * Single-flight: several queries firing at once after an expiry would otherwise each trigger
 * their own refresh, and with a slow connection the last response to land could overwrite
 * storage with a token the retries aren't using.
 */
export const refreshAccessToken = (): Promise<string | null> => {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => {
      // Cleared so the next expiry, 15 minutes on, starts a fresh attempt rather than
      // reusing this already-settled promise.
      inFlight = null;
    });
  }

  return inFlight;
};

const doRefresh = async (): Promise<string | null> => {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) return null;

  try {
    const response = await axios.post(
      `${getBaseUrl()}${REFRESH_PATH}`,
      { refreshToken },
      { timeout: 20000, headers: { "Content-Type": "application/json" } },
    );

    // Server spec 18 D6: the new access token comes back in the top-level `token` field,
    // matching what /auth/login already does.
    const accessToken = response?.data?.token;

    if (!accessToken) return null;

    await setAccessToken(accessToken);

    return accessToken;
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      throw new RefreshNetworkError();
    }

    // A 401 means the refresh token is expired/invalid/for a deleted user -> session over.
    // A 400 means *this client* sent the wrong field name (server spec 18 D6) and logging the
    // user out would hide that bug, so make it loud in development rather than silent.
    if (axios.isAxiosError(error) && error.response?.status !== 401) {
      console.log(
        "refresh-token returned an unexpected status:",
        error.response?.status,
        error.response?.data,
      );
    }

    return null;
  }
};
