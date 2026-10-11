# 39 — Access + refresh token auth: secure storage, silent refresh, forced logout

**Status**: ✅ **Completed 2026-10-11** — all 9 steps implemented and verified end-to-end against a local server
running spec 18, driven headlessly with Playwright on the web target. One blocker was hit and fixed under its own
spec (`40-fix-missing-expo-linear-gradient-peer-dep.md`) — a pre-existing crash on `master`, unrelated to this
spec. **Two checklist items remain device-only and are NOT verified** (see Implementation notes): that
SecureStore rather than AsyncStorage is really the store on native, and a cold offline launch from the persisted
cache. No deviations from the plan otherwise.
**Scope**: `client/` only. Companion server spec: `server/ai context/specs/18-access-refresh-token-auth.md` —
the two must ship together (see **D8 — Rollout**). Read `18`'s **D6** (exact request/response shapes) and
**D10** first; this spec assumes them.
**Closes**: `known-issues.md#AUTH-2` (in-memory session state not cleared on 401) — **subsumes spec 25**, which
is the plan-only fix for it. Its bridge module is a hard prerequisite here, so `25` gets implemented _as part of_
this spec rather than separately (see **D5**).

---

## Goal

The app stores an access token (15 min) and a refresh token (15 days), keeps them somewhere appropriate for the
platform rather than plain `AsyncStorage`, and — when a request comes back `401` — silently gets a new access
token from `POST /auth/refresh-token`, retries the original request, and shows the user **nothing**. If the
refresh itself 401s, the user is logged out: both tokens deleted, in-memory session state cleared, persisted
query cache dropped, redirect to `/auth`.

Today (`utils/axiosInstance.ts`) a 401 unconditionally wipes storage, toasts `"Token expired , please login "`,
and bounces to `/auth`. With a 15-minute access token that would happen every 15 minutes. The silent-refresh
path is what makes a short-lived access token usable at all.

---

## Scope

**In:**

- **New** `utils/tokenStorage.ts` — platform-appropriate storage for the two tokens + an in-memory cache.
- **New** `utils/authEvents.ts` — the non-React → React bridge from spec 25 (**D5**).
- **New** `utils/refreshToken.ts` — the single-flight refresh call (**D3**), deliberately **not** going through
  `utils/api.ts`/`axiosInstance` (**D4**).
- `utils/axiosInstance.ts` — request interceptor reads from `tokenStorage`; response interceptor's 401 branch
  becomes refresh-then-retry (**D2**).
- `context/user.context.tsx` — `token` → `accessToken` + `refreshToken`; `handleSetToken` → `handleSetSession`;
  registers the logout handler; hydrates the in-memory token cache at boot.
- `app/auth.tsx` — read `refreshToken` off the login response and store both.
- `package.json` — add `expo-secure-store` (**D1**).

**Out (explicitly not touched):**

- **`#FETCH-1`** (the response interceptor resolves on error instead of rejecting). This spec works _with_ that
  behaviour, it does not fix it — see **D6**, which is the trickiest part of this plan. Fixing `#FETCH-1` is
  still item 1 in `progress-tracker.md`'s Next Up and still its own spec.
- `#AUTH-1` (`AuthGuard` mounted only under `(tabs)`), `#AUTH-3` (duplicated `"user"`/`"token"` key literals —
  this spec _does_ centralise the token keys inside `tokenStorage.ts`, but leaves the `"user"` key alone),
  `#AUTH-4`, `#AUTH-5`, `#AUTH-6`.
- `utils/transactionQueue.ts` and the offline sync flow — unchanged. **D7** explains why they need no changes.
- Register-then-auto-login. `POST /auth/register` still returns no tokens (server spec `18`, **D6**).
- The double-toast on a _genuine_ logout 401. The toast count there is unchanged from today; what changes is
  that a _refreshable_ 401 now produces **zero** toasts (**D2**).

---

## Design

### D1 — Where the tokens live

The ask was "cookies on web, an appropriate location on the app". Taken literally that means httpOnly cookies —
**rejected**, with reasons, in favour of `expo-secure-store` on native + `AsyncStorage` on web:

| Platform                       | Store                                                 | Why                                                                                                                       |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| iOS / Android (**ships**)      | `expo-secure-store` → iOS Keychain / Android Keystore | OS-encrypted, per-app, not readable from a backup or by another app. A real upgrade on today's plain-text `AsyncStorage`. |
| web (verification target only) | `AsyncStorage` (= `localStorage`)                     | `expo-secure-store` has **no web implementation** — importing it on web throws.                                           |

Why not httpOnly cookies:

1. **They don't fit the thing that ships.** `CLAUDE.md`: `client/` ships as an **Android APK**; the `web` target
   is "used mainly for headless verification". A cookie-based design would optimise for the one target that is a
   test harness. In React Native the cookie jar is `NSHTTPCookieStorage`/OkHttp's `CookieManager` — per-platform,
   not inspectable from JS, with known differences in how `Set-Cookie` is honoured on redirects and
   `credentials` handling — i.e. _less_ reliable than the explicit header the app uses today.
2. **The server half would have to change too**, and it's not small: `Set-Cookie` on login _and_ on every
   refresh, `SameSite`/`Secure`/domain correct across both `localhost:8081` and `exp2server.vercel.app`,
   `app.ts`'s CORS allowlist and `allowedHeaders` revisited. Server spec `18`'s **D9** covers this; it keeps the
   server on body + `Authorization`, which this decision has to match.
3. **httpOnly buys protection from XSS** — the threat model of a _browser_ app. A native app has no DOM and no
   third-party script injection surface, so the thing cookies defend against mostly doesn't exist here, while
   the thing SecureStore defends against (device/backup extraction) very much does.

So: **`expo-secure-store` on native, `AsyncStorage` on web**, behind one module so no call site cares.

```ts
// utils/tokenStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const LEGACY_TOKEN_KEY = "token"; // pre-spec-39 single token, see D8

// SecureStore has no web implementation; on web these fall through to AsyncStorage.
const useSecureStore = Platform.OS !== "web";

const read = async (key: string) =>
  useSecureStore ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key);
const write = async (key: string, value: string) =>
  useSecureStore
    ? SecureStore.setItemAsync(key, value)
    : AsyncStorage.setItem(key, value);
const remove = async (key: string) =>
  useSecureStore
    ? SecureStore.deleteItemAsync(key)
    : AsyncStorage.removeItem(key);

// In-memory mirror so the request interceptor never awaits the Keychain (D2).
let accessTokenCache: string | null = null;

export const getAccessToken = () => accessTokenCache;
export const getRefreshToken = () => read(REFRESH_TOKEN_KEY);

export const hydrateTokens = async () => {
  accessTokenCache = await read(ACCESS_TOKEN_KEY);
  return {
    accessToken: accessTokenCache,
    refreshToken: await read(REFRESH_TOKEN_KEY),
  };
};

export const setTokens = async (accessToken: string, refreshToken: string) => {
  accessTokenCache = accessToken;
  await Promise.all([
    write(ACCESS_TOKEN_KEY, accessToken),
    write(REFRESH_TOKEN_KEY, refreshToken),
  ]);
};

export const setAccessToken = async (accessToken: string) => {
  accessTokenCache = accessToken;
  await write(ACCESS_TOKEN_KEY, accessToken);
};

export const clearTokens = async () => {
  accessTokenCache = null;
  await Promise.all([
    remove(ACCESS_TOKEN_KEY),
    remove(REFRESH_TOKEN_KEY),
    AsyncStorage.removeItem(LEGACY_TOKEN_KEY), // always AsyncStorage — that's where it was
  ]);
};
```

Three notes on this module:

- **SecureStore keys must be alphanumeric + `.-_`** — `"accessToken"`/`"refreshToken"` are fine. A key with any
  other character throws at runtime on iOS.
- **`expo-secure-store` is a native module.** It's bundled in Expo Go, so `yarn start` keeps working with no
  extra step, but the **APK must be rebuilt through EAS** — an existing APK can't pick it up. Install it as
  `npx expo install expo-secure-store` so the version matches SDK 54 (plain `yarn add` can pull an incompatible
  major).
- **SecureStore has a ~2 KB per-value limit on Android** (it's a hard failure above it). A JWT with this
  payload is a few hundred bytes, so there's headroom — but it's the reason tokens go in individually rather
  than as one JSON blob alongside the user object.

### D2 — The interceptors

**Request** — read the in-memory cache, not storage:

```ts
const token = getAccessToken();
if (token) config.headers.Authorization = `Bearer ${token}`;
```

Today this `await`s `AsyncStorage.getItem("token")` on **every** request. Going through the Keychain on every
request would be noticeably worse, hence the in-memory mirror, hydrated once by `UserProvider` (**D5**) and kept
current by `setTokens`/`setAccessToken`/`clearTokens`. `getAccessToken()` is synchronous, so the request
interceptor no longer needs to be `async` for this (it still is, for the FormData branch).

**Response, 401 branch** — the shape of the change:

```ts
async function (error) {
  const status = error?.response?.status;
  const originalConfig = error?.config;

  if (status === 401 && originalConfig && !originalConfig._retry && !isRefreshRequest(originalConfig)) {
    originalConfig._retry = true;                      // one attempt per request, no loops

    const newAccessToken = await refreshAccessToken();  // single-flight — D3

    if (newAccessToken) {
      originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;
      return instance.request(originalConfig);          // D6 — returns the interceptor's own shape
    }

    // Refresh failed → the session is genuinely over.
    triggerForcedLogout();                              // D5
    Toast.show({ type: "error", text1: "Session expired, please login again", position: "top" });
    router.replace("/auth");
    return error;
  }

  // ...existing non-401 handling, unchanged (offline fallback message + Toast + `return error`)
}
```

What this changes for the user, which is the point of the whole spec:

| Situation                             | Today                        | After                                              |
| ------------------------------------- | ---------------------------- | -------------------------------------------------- |
| Access token expired (every 15 min)   | 2 toasts + kicked to `/auth` | **nothing visible**; the request just succeeds     |
| Refresh token expired (after 15 days) | same                         | 1 toast + `/auth`                                  |
| 401 for any other reason              | same                         | one silent refresh attempt, then 1 toast + `/auth` |

`_retry` is the loop guard: if the retried request _also_ 401s (e.g. the brand-new access token is somehow
rejected), the flag is already set, so the branch is skipped and it falls through to logout. Without it, a
server that 401s unconditionally would produce an infinite request loop.

`isRefreshRequest(config)` guards against the refresh call's own 401 re-entering this branch — belt-and-braces,
since **D4** keeps the refresh call off this axios instance entirely.

### D3 — Single-flight refresh

Several queries fire at once on app launch and after a tab switch. If five land 401 simultaneously, five
refresh calls go out; four of their access tokens are thrown away, and with a slow connection they can interleave
such that the last response to arrive overwrites storage with a token that isn't the one the retries are using.
One in-flight promise, shared:

```ts
// utils/refreshToken.ts
let inFlight: Promise<string | null> | null = null;

export const REFRESH_PATH = "/auth/refresh-token";

export const refreshAccessToken = (): Promise<string | null> => {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};

const doRefresh = async (): Promise<string | null> => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    // D4: a bare axios client, NOT the shared instance.
    const response = await axios.post(
      `${getBaseUrl()}${REFRESH_PATH}`,
      { refreshToken },
      { timeout: 20000, headers: { "Content-Type": "application/json" } },
    );

    const accessToken = response?.data?.token; // server spec 18, D6
    if (!accessToken) return null;

    await setAccessToken(accessToken);
    return accessToken;
  } catch (error) {
    // D6: only a real 401 means the refresh token is dead. Offline (no `response`) or a 5xx
    // must NOT log the user out — their refresh token is probably fine.
    return null;
  }
};
```

Callers of `refreshAccessToken()` that get `null` fall through to logout (**D2**). That is correct for a dead
refresh token and **wrong for an offline failure** — see **D6**'s second half, which is the one case this needs
to handle explicitly rather than by omission.

`inFlight` is cleared in `finally`, so a later 401 (15 minutes on) starts a fresh attempt rather than reusing a
settled promise.

### D4 — The refresh call must not use `axiosInstance`

It uses a bare `axios.post`. Three reasons, each sufficient on its own:

1. **Re-entrancy.** `axiosInstance`'s error interceptor is exactly where the refresh is triggered from. A refresh
   that 401s through the same instance re-enters that branch — the `isRefreshRequest` guard in **D2** exists for
   this, but not relying on the guard is simpler and safer.
2. **The interceptor rewrites the success shape** to `{ data, meta }` (`#FETCH-1`'s sibling). Going through it
   would mean reading `response.data.token` through two layers of reshaping (`{ data: { success, message, token } }`),
   which is exactly the kind of thing that breaks silently when a shape changes.
3. **It resolves on error instead of rejecting** (`#FETCH-1`), so a `try/catch` around it never catches anything
   and "did the refresh fail?" becomes an `axios.isAxiosError(result)` check. A clean client makes `doRefresh`
   read like what it is.

`getBaseUrl()` is reused from `utils/envConfig.ts`, so the hand-toggled `baseURL` still applies to the refresh
call — if that's pointing at `localhost` and the rest of the app isn't, refresh breaks in the same way
everything else does, consistently.

### D5 — Context and the logout bridge (spec 25, folded in)

`axiosInstance` is a module-level singleton outside React, so it can't call `useUserContext()`. Spec 25 already
designed the fix — a tiny registered-callback bridge — and this spec **needs** it: on a failed refresh, in-memory
`user`/`accessToken` must be cleared or screens keep rendering a logged-in UI for a session that's over.
Implement `utils/authEvents.ts` exactly as spec 25 specifies (`registerLogoutHandler` / `triggerForcedLogout`),
and mark spec 25 ⛔ superseded-by-39 in the tracker rather than leaving two plans for one change.

`context/user.context.tsx` changes:

```ts
const [accessToken, setAccessToken] = useState<string | null>(null);
const [refreshToken, setRefreshToken] = useState<string | null>(null);

// boot: hydrate both the in-memory token cache and React state from secure storage
useEffect(() => {
  const loadUserData = async () => {
    const storedUser = await AsyncStorage.getItem("user");
    const { accessToken, refreshToken } = await hydrateTokens(); // D1

    if (storedUser && accessToken && refreshToken) {
      setUser(JSON.parse(storedUser)); // #AUTH-4: still unguarded, out of scope
      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
    } else {
      // A partial session (user without tokens, or a legacy single token — D8) is not a session.
      await clearTokens();
      await AsyncStorage.removeItem("user");
    }

    setIsLoading(false);
  };
  loadUserData();
}, []);

useEffect(() => {
  registerLogoutHandler(logoutFunction);
}, []);

const handleSetSession = async (accessToken: string, refreshToken: string) => {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
  await setTokens(accessToken, refreshToken);
};
```

`logoutFunction` swaps its two `AsyncStorage.removeItem` calls for `clearTokens()` (keeping
`removeItem("user")` and `clearPersistedQueryCache()`), and resets all three pieces of state. It stays the
**one** definition of "what logging out means", now reached from three places: the Settings button, the failed
refresh, and boot-time hydration of a partial session.

`handleSetToken` is **replaced**, not kept — `grep -rn "handleSetToken" client/` hits exactly one call site
(`app/auth.tsx:22,54`), and nothing outside `user.context.tsx`/`axiosInstance.ts` reads `token` off the context
at all, so this rename has a one-file blast radius.

**`app/auth.tsx`'s login handler** becomes:

```ts
const accessToken = result?.token;
const refreshToken = result?.refreshToken;

if (!accessToken || !refreshToken) {
  setErrorMessage("Something went wrong. Please try again.");
  return;
}

await handleSetSession(accessToken, refreshToken);
handleSetUser(userPayload);
```

The explicit guard matters: if the server is on the old build and sends no `refreshToken`, storing a session
without one produces an account that can never refresh and gets logged out 15 minutes later with no explanation.
Failing at login is the legible failure.

### D6 — Living with `#FETCH-1` (the subtle part)

The response interceptor **resolves** on error (`return error`, not `Promise.reject`). That has two consequences
for the retry, and getting either wrong produces a bug that only shows up 15 minutes into a session:

**(a) The retry's return value.** `return instance.request(originalConfig)` sends the retried request through
this same instance, so on success it hits the **success** interceptor and comes back as `{ data, meta }` — the
exact shape `utils/api.ts`'s helpers expect. The error interceptor returning that promise means the caller's
original `await apiGet(...)` resolves with a normal success value and never knows a refresh happened. This works
_because_ of the odd resolve-on-error behaviour, so it's worth a comment in the code: **whoever fixes `#FETCH-1`
later must re-check this path**, because switching to `Promise.reject` changes what a caller sees here.

**(b) Offline must not log anyone out.** `refreshAccessToken()` returns `null` for _both_ "the server said 401"
and "there was no server". Treating both as logout means losing the session on a subway ride. But note the
entry condition: this branch only runs when `error.response.status === 401`, i.e. a response **was** received —
so the app is online at that moment. The realistic failure is the refresh call _itself_ timing out on a flaky
connection seconds later. The fix is to distinguish them in `doRefresh` rather than collapse them:

```ts
} catch (error) {
  if (axios.isAxiosError(error) && !error.response) {
    throw new RefreshNetworkError();   // no response → network, NOT a dead refresh token
  }
  return null;                          // a real 401/4xx → the refresh token is finished
}
```

and in the interceptor, a `RefreshNetworkError` falls through to the **normal** error path (offline toast,
`return error`, session kept) instead of to logout. Without this the first flaky-network 401 ends the session.

**(c) A 400 from the refresh endpoint is a bug, not a dead session.** Server spec `18`'s **D6**: a malformed body
(wrong field name) is a Zod `400`. `doRefresh` returning `null` for it → logout → the real cause (a typo in the
payload key) is invisible. Mitigation: `console.log` the non-401 status inside that `catch` so it shows up during
development, and the "Verify when done" list below includes a deliberate wrong-field-name test.

### D7 — The offline queue and persisted cache need no changes

Checked rather than assumed:

- `utils/transactionQueue.ts` is pure `AsyncStorage` and contains no network code (`grep` for
  `axiosInstance|apiPost|token` returns nothing) — it stores payloads; the sync is driven by callers that go
  through `utils/api.ts` and therefore through the interceptor. A queued write that flushes with an expired
  access token now gets a transparent refresh + retry **instead of** being dropped to `/auth` mid-flush. That's
  a straight improvement with no code change.
- Offline (no response at all) never reaches the 401 branch, so spec 37's cached-reads behaviour is untouched.
- `clearPersistedQueryCache()` stays wired into `logoutFunction`, so a forced logout still drops the previous
  account's cached figures (spec 37's reason for it).
- The queue lives in `AsyncStorage`, **not** SecureStore. Only tokens move. Nothing else is secret and the 2 KB
  Android limit (**D1**) would be a real problem for a queue.

### D8 — Rollout, legacy token, and the forced re-login

- **Both sides ship together.** Server spec `18`'s **D10**: tokens minted before `18` carry no `type` claim and
  are rejected, and an old APK that logs in against the new server breaks every 15 minutes. Order: merge both →
  deploy the server → **EAS build + install** (required anyway for `expo-secure-store`, **D1**).
- **Everyone is logged out once.** The old token lives at `AsyncStorage("token")` and is invalid server-side
  anyway. `clearTokens()` deletes that legacy key, and the hydration guard in **D5** treats "a `"user"` with no
  token pair" as no session, so the first launch after the update lands on `/auth` cleanly instead of in a state
  where a stale `user` is in memory and every request 401s. **No migration of the old token is attempted** —
  it couldn't work, since `18` rejects it.
- **Settings' Log out keeps working identically** — same `logoutFunction`, now also clearing SecureStore.

---

## Implementation steps

1. ✅ `npx expo install expo-secure-store`.
2. ✅ **New** `utils/tokenStorage.ts` — **D1**.
3. ✅ **New** `utils/authEvents.ts` — spec 25's module verbatim (**D5**).
4. ✅ **New** `utils/refreshToken.ts` — **D3** + **D6**'s `RefreshNetworkError`.
5. ✅ `context/user.context.tsx` — **D5**: `accessToken`/`refreshToken` state, `handleSetSession`, hydration via
   `hydrateTokens()` + the partial-session guard, `registerLogoutHandler`, `logoutFunction` → `clearTokens()`.
   Update `IUserProviderValues`.
6. ✅ `utils/axiosInstance.ts` — **D2**: sync token read in the request interceptor; refresh-then-retry 401 branch
   with the `_retry` guard; `triggerForcedLogout()` replacing the two direct `removeItem` calls; keep the
   non-401 path exactly as it is. Add the comment **D6(a)** calls for.
7. ✅ `app/auth.tsx` — **D5**: read `refreshToken`, guard for its absence, call `handleSetSession`.
8. ✅ `npx tsc --noEmit` + `yarn lint`.
9. ✅ **Docs** — `progress-tracker.md`: this spec's row; mark spec `25`'s row ⛔ superseded by `39`; tick `#AUTH-2`
   resolved in Known Gaps; note in `architecture.md`'s auth section (already flagged as drifted in `CLAUDE.md`)
   that tokens are in SecureStore and that `axiosInstance` now refreshes silently. Note in `known-issues.md`'s
   `#FETCH-1` entry that the retry path in **D6(a)** depends on the current resolve-on-error behaviour.

---

---

## Implementation notes (filled in 2026-10-11)

**Verification setup.** No device or emulator was available, so the pass ran against the **web target**
(`yarn web`) driven headlessly with Playwright, pointed at a local server running spec 18. Port 5000 was held by
another OS user's stale `node dist/server.js`, so the server ran on `PORT=5055` and `envConfig.ts` was pointed
there for the duration and **restored to the deployed URL before committing**. This mirrors the precedent set by
spec 27 (headless click-through), with the device caveats recorded in the checklist above.

**What the traces actually showed** (the three that matter most):

| Scenario                                     | Observed network trace                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Two queries racing an expired access token   | `401`, `401` → **one** `200 POST /auth/refresh-token` → both retried `200`. No toast, stayed on Today.            |
| A write with an expired access token         | `401 POST /transactions/new-transaction` → `200 POST /auth/refresh-token` → `201` on the retry.                   |
| Every `/api/**` returning `401`              | 3 requests total in 12s (2 queries + 1 refresh), one logout, no storm — the `_retry` guard and single-flight held. |

**`#AUTH-2` is closed, and the evidence is structural rather than a DevTools reading.** The old interceptor
cleared `AsyncStorage` itself (`HEAD:utils/axiosInstance.ts` lines 62-65); the new one contains **no** storage or
state code at all — `grep -nE "removeItem|setItem|clearTokens|setUser" utils/axiosInstance.ts` is empty. So the
observed result (both tokens, `user`, and the persisted query cache all cleared after a failed refresh) can only
have come from `logoutFunction`, whose next three statements are `setUser(null)` / `setAccessToken(null)` /
`setRefreshToken(null)`. Directly observing `user === null` on a still-mounted screen needs a device or React
DevTools; the first attempt to prove it via `history.pushState` was discarded as invalid, because that does not
drive `expo-router`'s state and so proved nothing either way.

**Refinement to D1's premise.** The spec says importing `expo-secure-store` on web throws. It does not: the web
build resolves its native module to `export default {}`, so the *import* is harmless and only a *call* would be
a TypeError. The `Platform.OS !== "web"` guard is therefore still required, but for the stated reason rather than
to avoid an import-time crash. Worth knowing before anyone "simplifies" the guard into a try/catch.

**One internal inconsistency in this spec, resolved toward D2.** The Scope section says the double-toast on a
genuine logout 401 is "unchanged from today", while D2's table and code sketch both specify a single
`"Session expired, please login again"` toast. Implemented as D2 describes (one toast), since that is the
explicit code and two of the three statements agree. Net effect is strictly better than before, not unchanged.

**Flagged, not fixed (pre-existing, out of this spec's scope).** Launching the app while logged out fires a
query from the `(tabs)` group before `AuthGuard` redirects, so a 401 arrives with no session and the user is
shown `"Session expired, please login again"` on the login screen they were already heading to. This predates
spec 39 — the old interceptor showed `"Token expired , please login"` plus a second generic toast in exactly the
same situation, so this is one fewer toast than before, not a regression. The clean fix is to skip the toast when
there was no refresh token to begin with (nobody's session ended), but that is a behaviour change beyond this
spec. Recorded in `progress-tracker.md`'s Known Gaps.

**Not touched, as planned**: `#FETCH-1` (and the retry path's dependence on it is now commented in
`axiosInstance.ts`), `#AUTH-1`, `#AUTH-3`'s `"user"` key literal, `#AUTH-4`-`#AUTH-6`, `transactionQueue.ts`,
`hooks/useApi.ts`, and `utils/api.ts`.

## Verify when done

Against a locally running server with spec `18` applied (`utils/envConfig.ts` toggled to `localhost:5000`, and
**toggled back before committing** — `CLAUDE.md`). The headless-browser click-through used for spec 27 covers
the web path; a device pass is what actually exercises SecureStore.

- [x] `npx tsc --noEmit` and `yarn lint` clean.
- [x] Fresh login on a **device/emulator** (not web): both tokens stored, app lands on Today, data loads.
- [ ] **NOT VERIFIED (device-only).** `expo-secure-store` is really being used on native:
      `AsyncStorage.getItem("accessToken")` returns `null` while the app is logged in. Verification this session
      ran on the web target, where `tokenStorage` deliberately falls back to AsyncStorage (D1), so this cannot be
      checked here — only that the fallback works. The `Platform.OS !== "web"` branch is unexercised.
- [x] **Silent refresh.** With the server's access TTL temporarily set to `"30s"`: log in, wait ~40s, pull to
      refresh on Today → data loads, **no toast**, no redirect to `/auth`. The server log shows a `401`
      immediately followed by `POST /auth/refresh-token` → `200` and the retried request → `200`.
- [x] **Single-flight.** Same short TTL: wait for expiry, then trigger several reads at once (switch to Insights,
      which fires multiple queries). Server log shows **exactly one** `/auth/refresh-token` call, not one per
      request.
- [x] **Dead refresh token → logout.** Corrupt the stored refresh token (or restart the server with a different
      `JWT_REFRESH_SECRET`), then make any request: one "Session expired" toast, redirect to `/auth`, and
      **Settings read through `useUserContext().user` is `null` immediately** with no reload — this is the
      `#AUTH-2` fix (spec 25's checklist item).
- [x] After that forced logout: no `accessToken`/`refreshToken` in SecureStore, no `"user"` in `AsyncStorage`,
      and the persisted query cache is gone (re-login shows no stale figures).
- [x] **No retry loop.** Point the client at a server that 401s unconditionally; confirm exactly one refresh
      attempt and one logout, not a request storm (`_retry`, **D2**).
- [x] **Offline does not log you out** (**D6(b)**): go offline _after_ a 401 has been observed, or throttle the
      network so the refresh call times out → the offline toast appears, the user stays logged in, and
      reconnecting then recovers without a re-login.
- [~] Spec 37's offline behaviour partially verified: going offline **while mounted** keeps the session, the
      tokens and the rendered data, and never redirects to `/auth`. A **cold offline launch** from the persisted
      cache could not be tested on web — the JS bundle itself comes from Metro, so an offline reload just yields
      Chromium's network-error page. Device-only.
- [x] Writes survive an expired access token (**D7**): saving a transaction with an expired token produced
      `401 POST /transactions/new-transaction` → `200 POST /auth/refresh-token` → `201 POST
      /transactions/new-transaction`, with no toast and no redirect. Tested as a direct write rather than via the
      offline queue, which is the same code path once the queue flushes (the queue itself holds no network code).
- [x] **Wrong field name is loud, not a logout** (**D6(c)**): temporarily send `{ refresh_token: ... }`; confirm
      the `400` is visible in the console rather than silently ending the session. Revert.
- [x] Settings' Log out behaves exactly as before.
- [x] Login against a server **without** spec `18` (no `refreshToken` in the response) → the inline error on the
      auth screen, and **no** half-session is stored (**D5**).
- [x] 15-day path spot-check: covered by corrupting the stored refresh token, which exercises the same
      server-side rejection branch (`401` → forced logout) that an expired one would.
- [x] `utils/envConfig.ts` is back on `https://exp2server.vercel.app` before committing.
