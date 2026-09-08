# Architecture — Client

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo (React Native), file-based routing via `expo-router` |
| UI library | Custom design system in `theme/` (`colors.ts`/`typography.ts`/`spacing.ts`/`ThemeContext.tsx`, light+dark, ported from the `xpnsapp` visual reference per `specs/06-visual-redesign-xpnsapp-design-system.md`) — `react-native-paper` is still mounted (`PaperProvider`) but only used for its `Portal`/`Modal` primitives in `UpdateTransactionModal.tsx`/`PendingTransactionEditModal.tsx`; everywhere else uses plain RN components + `theme/`'s `useTheme()`, `text`, `spacing`, `radius` |
| Server state | TanStack Query, one global `QueryClient` (no custom `staleTime`/`retry` config) |
| HTTP | Axios, one shared instance (`utils/axiosInstance.ts`) |
| Local persistence | `AsyncStorage` for `user`/`token` only |

`theme/index.ts` exports `useTheme()` (returns the active `ColorScheme` — light or dark, driven by `useColorScheme()`), `text` (type scale), `spacing`/`radius`/`shadows`. Every screen/component reads colors from `useTheme()` — never hardcode a hex color. `constants/theme.ts` (`Colors`/`Fonts`) is unrelated, unmodified Expo scaffolding with zero real call sites — don't confuse it with `theme/`.

## Provider stack

`app/_layout.tsx` mounts, in order: `SafeAreaProvider` → `KeyboardProvider` → `QueryClientProvider` → `ThemeProvider` (`theme/ThemeContext.tsx`) → `GestureHandlerRootView` → `PaperProvider` → `UserProvider` (`context/user.context.tsx`) → `<Slot />` + `<Toast />`. Order matters (each layer depends on the one outside it being mounted). Root layout also gates on `@expo-google-fonts/inter` loading (`useFonts`), showing `utils/SplashScreen.tsx` until fonts are ready — that splash renders before `ThemeProvider` mounts, so it always uses `ThemeContext`'s default (dark) regardless of system theme; harmless (a few hundred ms), not worth fixing.

## Data-fetching pipeline

`utils/axiosInstance.ts` (interceptors) → `utils/api.ts` (`apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete` thin wrappers) → `hooks/useApi.ts` (`useFetchData`, `usePost`, `useUpdateData`, `usePatch`, `useDeleteData` — TanStack Query wrappers with query-key invalidation) → screens. Prefer the `useApi.ts` hooks over calling `axiosInstance`/`utils/api.ts` directly from components.

**The interceptor chain is currently broken for error handling** — read `known-issues.md#FETCH-1` before writing any new error-handling code that assumes a mutation's `catch`/`onError` will fire on an API error; today it won't.

## Auth flow

- `context/user.context.tsx`'s `UserProvider` holds `user`/`token`/`isLoading` in state, persisted to `AsyncStorage` under keys `"user"`/`"token"` (hardcoded independently in three places — `known-issues.md#AUTH-3`).
- Login (`app/auth.tsx`) and register (`app/register.tsx`) are top-level routes outside the `(tabs)` group.
- `utils/AuthGuard.tsx` is mounted **only** inside `app/(tabs)/_layout.tsx` — it redirects `/auth` ↔ `/` based on `user`/`isLoading`, but because it's only mounted inside `(tabs)`, its "already logged in, redirect away from `/auth`" branch never actually runs (`known-issues.md#AUTH-1`).
- On a 401, `axiosInstance.ts`'s response interceptor clears `AsyncStorage` and redirects to `/auth`, but doesn't touch `UserProvider`'s in-memory state (`known-issues.md#AUTH-2`).
- There is no token refresh mechanism anywhere — a 401 is the only session-expiry signal that exists.

## Routing structure

Expo Router file-based routing under `app/`. `@/*` resolves to the `client/` root. `app/(tabs)/` is the authenticated tab group — `index`, `addTransaction`, `monthlyTransactions` (doubles as the Weekly view, see below), `history` are the 4 visible tabs; `smart-add` is also in the group (shares its chrome/back stack) but registered with `options={{ href: null }}` so it doesn't show in the tab bar — reached only via a button on Add Transaction. `app/auth.tsx`/`app/register.tsx` sit outside the group entirely. There is no `weeklyTransactions` route — Weekly is an in-page segmented-control state inside `MonthlyTransaction.tsx`, not a separate screen (`specs/06-visual-redesign-xpnsapp-design-system.md`, Decision 8).

## Numbered invariants

1. **The axios response interceptor never rejects on HTTP errors** (`return error` instead of `return Promise.reject(error)`). This is the root cause of a chain of dead code: `utils/api.ts` wrappers return `undefined` on failure, every mutation `onError` in `hooks/useApi.ts` is unreachable for API errors, and every screen-level `try/catch` around a mutation never enters `catch`. → `known-issues.md#FETCH-1`
2. **A 401 clears storage but not in-memory session state.** `UserProvider`'s `user`/`token` can remain stale (non-null) after a 401 until a reload or manual logout. → `known-issues.md#AUTH-2`
3. **`AsyncStorage` keys `"user"`/`"token"` are string literals repeated in three files**, not a shared constant — check all three if you ever rename one. → `known-issues.md#AUTH-3`
4. **`types/Transaction.tyes.ts`'s filename typo is load-bearing across ~13 files.** Do not rename it without a full grep-and-fix pass across every importer in the same change. → `known-issues.md#TYPE-3`
5. **Client and server `TTransaction` types have drifted** (`isDeleted` missing client-side; `description` required-on-server/optional-on-client). There's no shared/generated types package — keep both sides in sync by hand when you change either. → `known-issues.md#TYPE-2`
