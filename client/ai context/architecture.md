# Architecture — Client

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo (React Native), file-based routing via `expo-router` |
| UI library | Custom design system in `theme/` (`colors.ts`/`typography.ts`/`spacing.ts`/`ThemeContext.tsx`, light+dark, ported from the `xpnsapp` visual reference per `specs/06-visual-redesign-xpnsapp-design-system.md`) — `react-native-paper` is still mounted (`PaperProvider`) but only used for its `Portal`/`Modal` primitives in `UpdateTransactionModal.tsx`/`PendingTransactionEditModal.tsx`; everywhere else uses plain RN components + `theme/`'s `useTheme()`, `text`, `spacing`, `radius` |
| Server state | TanStack Query, one global `QueryClient` defined in `utils/queryClient.ts` (spec 37: `gcTime` 7 days, `staleTime` 30s, `retry: 2`) and persisted to AsyncStorage (`EXPENSE_TRACKER_QUERY_CACHE`, 7-day `maxAge`) so reads survive a restart |
| HTTP | Axios, one shared instance (`utils/axiosInstance.ts`) |
| Local persistence | `expo-secure-store` for the two auth tokens on native (`AsyncStorage` on web, which has no SecureStore implementation) via `utils/tokenStorage.ts`; `AsyncStorage` for `user`, the offline write queue and the persisted query cache (spec 39) |

`theme/index.ts` exports `useTheme()` (returns the active `ColorScheme` — light or dark, driven by `useColorScheme()`), `text` (type scale), `spacing`/`radius`/`shadows`. Every screen/component reads colors from `useTheme()` — never hardcode a hex color. `constants/theme.ts` (`Colors`/`Fonts`) is unrelated, unmodified Expo scaffolding with zero real call sites — don't confuse it with `theme/`.

## Provider stack

`app/_layout.tsx` mounts, in order: `SafeAreaProvider` → `KeyboardProvider` → `PersistQueryClientProvider` (spec 37; was a plain `QueryClientProvider`) → `ThemeProvider` (`theme/ThemeContext.tsx`) → `GestureHandlerRootView` → `PaperProvider` → `UserProvider` (`context/user.context.tsx`) → `<Slot />` + `<Toast />`. Order matters (each layer depends on the one outside it being mounted). **Reads are cache-first (spec 37):** a failed read no longer replaces a screen — the six list screens (Today, Activity ×2, Insights' Year view, Budgets, Requests) keep rendering the last good/persisted data under an `OfflineNotice` strip, and `ErrorState` only appears when there is nothing cached (and, on Today, nothing queued). `apiGet` throws a typed `ApiReadError` (`offline`, `status`) for a failed read. The persisted cache is dropped by `clearPersistedQueryCache()` on logout and on a 401; `pending-transactions` and mutations are never persisted. When a payload shape a screen reads changes, bump `buster` in `utils/queryClient.ts`. Root layout also gates on `@expo-google-fonts/inter` loading (`useFonts`), showing `utils/SplashScreen.tsx` until fonts are ready — that splash renders before `ThemeProvider` mounts, so it always uses `ThemeContext`'s default (dark) regardless of system theme; harmless (a few hundred ms), not worth fixing.

## Data-fetching pipeline

`utils/axiosInstance.ts` (interceptors) → `utils/api.ts` (`apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete` thin wrappers) → `hooks/useApi.ts` (`useFetchData`, `usePost`, `useUpdateData`, `usePatch`, `useDeleteData` — TanStack Query wrappers with query-key invalidation) → screens. Prefer the `useApi.ts` hooks over calling `axiosInstance`/`utils/api.ts` directly from components.

**The interceptor chain is currently broken for error handling** — read `known-issues.md#FETCH-1` before writing any new error-handling code that assumes a mutation's `catch`/`onError` will fire on an API error; today it won't.

## Auth flow

- `context/user.context.tsx`'s `UserProvider` holds `user`/`accessToken`/`refreshToken`/`isLoading` in state. `user` is persisted to `AsyncStorage` under `"user"`; the **two tokens go through `utils/tokenStorage.ts`** (spec 39), which writes them to `expo-secure-store` on native and falls back to `AsyncStorage` on web. The token key literals now live only in that module; the `"user"` literal is still duplicated (`known-issues.md#AUTH-3`, partially addressed).
- **Two tokens since spec 39** (server spec 18): a 15-minute access token and a 15-day refresh token, both returned by `POST /auth/login` (`token` and `refreshToken`). `app/auth.tsx` stores them together via `handleSetSession` and **refuses to store a half-session** if either is missing — which is what a pre-spec-18 server would send.
- **A 401 is no longer a session-expiry signal by itself.** `axiosInstance.ts`'s response interceptor refreshes and retries (`utils/refreshToken.ts`): one attempt per request (an `_retry` flag on the config guards against loops), and **single-flight**, so several queries racing the same expiry produce one `POST /auth/refresh-token`, not one each. A successful refresh is invisible to the caller and to the user — no toast, no redirect — because the retry goes back through this same instance and resolves as the usual `{ data, meta }`. **That works because the interceptor resolves on error instead of rejecting (`known-issues.md#FETCH-1`); fixing FETCH-1 means re-checking this path.**
- The access token is read from an **in-memory mirror** (`getAccessToken()`), not from storage, on every request — previously this was an `await AsyncStorage.getItem("token")` per request, and reaching into the Keychain that often would be worse. `UserProvider` primes the mirror at boot via `hydrateTokens()`.
- **Only a genuinely dead refresh token ends the session**: `triggerForcedLogout()` (the `utils/authEvents.ts` bridge) → `logoutFunction`, one toast, redirect to `/auth`. A refresh that fails at the **network** level throws `RefreshNetworkError` and is treated as an ordinary offline error with the session kept — otherwise a flaky connection would log people out. A **400** from the refresh endpoint means this client sent the wrong field name; it is logged to the console rather than silently swallowed.
- Logging out is purely client-side — there is no server-side session to end and no `/auth/logout` endpoint (server spec 18 D8). `logoutFunction` is the single definition of what it means, reached from Settings' button, a failed refresh, and the boot-time partial-session guard.
- Login (`app/auth.tsx`) and register (`app/register.tsx`) are top-level routes outside the `(tabs)` group.
- `utils/AuthGuard.tsx` is mounted **only** inside `app/(tabs)/_layout.tsx` — it redirects `/auth` ↔ `/` based on `user`/`isLoading`, but because it's only mounted inside `(tabs)`, its "already logged in, redirect away from `/auth`" branch never actually runs (`known-issues.md#AUTH-1`).
- `AUTH-2` is **fixed** as of spec 39: the interceptor no longer touches storage itself at all, so a forced logout necessarily goes through `logoutFunction`, which clears storage and in-memory state together.

## Routing structure

Expo Router file-based routing under `app/`. `@/*` resolves to the `client/` root. `app/(tabs)/` is the authenticated tab group — `index`, `addTransaction`, `monthlyTransactions` (doubles as the Weekly view, see below), `history` are the 4 visible tabs; `smart-add` is also in the group (shares its chrome/back stack) but registered with `options={{ href: null }}` so it doesn't show in the tab bar — reached only via a button on Add Transaction. `app/auth.tsx`/`app/register.tsx` sit outside the group entirely. There is no `weeklyTransactions` route — Weekly is an in-page segmented-control state inside `MonthlyTransaction.tsx`, not a separate screen (`specs/06-visual-redesign-xpnsapp-design-system.md`, Decision 8).

## Numbered invariants

1. **The axios response interceptor never rejects on HTTP errors** (`return error` instead of `return Promise.reject(error)`). This is the root cause of a chain of dead code: `utils/api.ts` wrappers return `undefined` on failure, every mutation `onError` in `hooks/useApi.ts` is unreachable for API errors, and every screen-level `try/catch` around a mutation never enters `catch`. → `known-issues.md#FETCH-1`
2. **A 401 is a refresh trigger, not a logout** (spec 39). It only ends the session if the refresh itself is rejected; in-memory state and storage are then cleared together through `logoutFunction`. → `known-issues.md#AUTH-2`, resolved
3. **The two token keys live only in `utils/tokenStorage.ts`**; never read or write them directly, and never assume they are in `AsyncStorage` — on native they are in SecureStore. The `"user"` key is still a literal in two places. → `known-issues.md#AUTH-3`, partially addressed
4. **`types/Transaction.tyes.ts`'s filename typo is load-bearing across ~13 files.** Do not rename it without a full grep-and-fix pass across every importer in the same change. → `known-issues.md#TYPE-3`
5. **Client and server `TTransaction` types have drifted** (`isDeleted` missing client-side; `description` required-on-server/optional-on-client). There's no shared/generated types package — keep both sides in sync by hand when you change either. → `known-issues.md#TYPE-2`
