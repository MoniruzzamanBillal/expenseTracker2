import axios, { InternalAxiosRequestConfig } from "axios";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { triggerForcedLogout } from "./authEvents";
import { getBaseUrl } from "./envConfig";
import {
  RefreshNetworkError,
  REFRESH_PATH,
  refreshAccessToken,
} from "./refreshToken";
import { getAccessToken } from "./tokenStorage";

const instance = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
});

instance.defaults.headers.post["Content-Type"] = "application/json";
instance.defaults.timeout = 60000;

// A request that has already been retried once after a refresh (spec 39 D2). Axios's config
// type has no slot for it, so it's carried as an extra property.
type TRetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Request interceptor
instance.interceptors.request.use(
  async function (config) {
    // <========
    // If the request is a POST request and the data is not FormData,
    // set Content-Type to application/json
    // ========>
    if (!(config?.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    } else {
      // Delete it, don't set it: a "multipart/form-data" with no `boundary` parameter is
      // incomplete, and this branch used to set exactly that while its comment claimed the
      // opposite. Removing the header lets the platform generate the full value with its own
      // boundary — the browser on web, OkHttp on Android, RCTNetworking on iOS. Those three
      // regenerate it anyway, which is why the old code happened to work (spec 35 Step 5).
      delete config.headers["Content-Type"];
    }

    // Spec 39: read the in-memory mirror instead of awaiting storage. This used to be an
    // `await AsyncStorage.getItem("token")` on every single request; the tokens now live in
    // SecureStore on native, and going through the Keychain per request would be worse still.
    // utils/tokenStorage keeps the mirror current (login, refresh, logout, boot hydration).
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  function (error) {
    console.log("error from axios instance = ", error);
    return Promise.reject(error);
  },
);

// The generic error path, behaviourally unchanged from before spec 39 (`known-issues.md#FETCH-1`:
// this resolves with the error instead of rejecting, so the Toast below is the only real
// user-facing error surface).
const reportError = (error: any) => {
  // error.response is undefined for a no-response failure (offline/timeout/
  // unreachable) — fall back to Axios's own message instead of showing a
  // blank toast (known-issues.md#FETCH-7).
  const errorMessage =
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again.";

  Toast.show({
    type: "error",
    text1: errorMessage,
    position: "top",
  });

  return error;
};

// Belt-and-braces: utils/refreshToken.ts uses a bare axios client precisely so the refresh
// call can never re-enter this interceptor (spec 39 D4). This guard means a future change
// routing it through the shared instance still couldn't recurse.
const isRefreshRequest = (config?: TRetriableConfig) =>
  !!config?.url?.includes(REFRESH_PATH);

instance.interceptors.response.use(
  // ✅ Handle success
  //@ts-expect-error: response type is not always consistent
  function (response) {
    return {
      data: response?.data,
      meta: response?.data?.meta,
    };
  },

  // ❌ Handle errors
  async function (error) {
    const status = error?.response?.status;
    const originalConfig = error?.config as TRetriableConfig | undefined;

    // ! Spec 39 D2 — silent refresh. With a 15-minute access token, an expiry 401 is routine,
    // ! so it must not be visible: refresh once, retry the original request, show nothing.
    // ! Only a genuinely dead refresh token ends the session.
    if (
      status === 401 &&
      originalConfig &&
      !originalConfig._retry &&
      !isRefreshRequest(originalConfig)
    ) {
      // ! One attempt per request. Without this, a server that 401s unconditionally (or a
      // ! brand-new access token still being rejected) would produce an infinite retry loop.
      originalConfig._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();

        if (newAccessToken) {
          originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;

          // ! Returning this promise is what makes the refresh invisible to the caller: the
          // ! retry goes back through THIS instance, so on success it hits the success
          // ! interceptor above and resolves as the usual `{ data, meta }` — exactly what
          // ! utils/api.ts expects. That works *because* this interceptor resolves on error
          // ! instead of rejecting; whoever fixes `known-issues.md#FETCH-1` must re-check
          // ! this path (spec 39 D6a).
          return instance.request(originalConfig);
        }
      } catch (refreshError) {
        // ! The refresh attempt never reached a server (spec 39 D6b). The refresh token is
        // ! almost certainly still valid, so keep the session and report this like any other
        // ! network failure — logging the user out here is how a flaky connection would end
        // ! a session that didn't need to end.
        if (refreshError instanceof RefreshNetworkError) {
          return reportError(error);
        }
      }

      // ! Refresh came back null: expired, invalid, wrong type, or a deleted user. The
      // ! session really is over. triggerForcedLogout clears BOTH storage and UserProvider's
      // ! in-memory state, which is the `known-issues.md#AUTH-2` fix (specs 25 + 39 D5).
      triggerForcedLogout();

      Toast.show({
        type: "error",
        text1: "Session expired, please login again",
        position: "top",
      });

      router.replace("/auth");

      return error;
    }

    return reportError(error);
    // return Promise.reject(error);
  },
);

export { instance as axiosInstance };
