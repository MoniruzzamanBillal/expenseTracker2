# Architecture — Client

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo (React Native), file-based routing via `expo-router` |
| UI library | `react-native-paper` (Material Design) — no custom design system/tokens on top of it |
| Server state | TanStack Query, one global `QueryClient` (no custom `staleTime`/`retry` config) |
| HTTP | Axios, one shared instance (`utils/axiosInstance.ts`) |
| Local persistence | `AsyncStorage` for `user`/`token` only |

There's no `ui-context.md` in this folder — the app uses `react-native-paper`'s defaults with no custom theme/token layer worth documenting separately; styling conventions that do exist live in `code-standards.md`.

## Provider stack

`app/_layout.tsx` mounts, in order: `SafeAreaProvider` → `KeyboardProvider` → `QueryClientProvider` → `GestureHandlerRootView` → `PaperProvider` → `UserProvider` (`context/user.context.tsx`) → `<Slot />` + `<Toast />`. Order matters (each layer depends on the one outside it being mounted).

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

Expo Router file-based routing under `app/`. `@/*` resolves to the `client/` root. `app/(tabs)/` is the authenticated tab group (index/addTransaction/history/monthlyTransactions/smart-add/weeklyTransactions); `app/auth.tsx`/`app/register.tsx` sit outside it.

## Numbered invariants

1. **The axios response interceptor never rejects on HTTP errors** (`return error` instead of `return Promise.reject(error)`). This is the root cause of a chain of dead code: `utils/api.ts` wrappers return `undefined` on failure, every mutation `onError` in `hooks/useApi.ts` is unreachable for API errors, and every screen-level `try/catch` around a mutation never enters `catch`. → `known-issues.md#FETCH-1`
2. **A 401 clears storage but not in-memory session state.** `UserProvider`'s `user`/`token` can remain stale (non-null) after a 401 until a reload or manual logout. → `known-issues.md#AUTH-2`
3. **`AsyncStorage` keys `"user"`/`"token"` are string literals repeated in three files**, not a shared constant — check all three if you ever rename one. → `known-issues.md#AUTH-3`
4. **Three independent copies of the transaction-type enum exist.** Treat `constants/TransactionType.constant.ts`'s `TransactionTypeConst` as canonical for any new code; don't add a fourth copy or extend the other two. → `known-issues.md#TYPE-1`
5. **`types/Transaction.tyes.ts`'s filename typo is load-bearing across ~13 files.** Do not rename it without a full grep-and-fix pass across every importer in the same change. → `known-issues.md#TYPE-3`
6. **Client and server `TTransaction` types have drifted** (`isDeleted` missing client-side; `description` required-on-server/optional-on-client). There's no shared/generated types package — keep both sides in sync by hand when you change either. → `known-issues.md#TYPE-2`
