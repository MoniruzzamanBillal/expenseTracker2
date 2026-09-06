# Architecture — xpns

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo (React Native), file-based routing via `expo-router` |
| UI | Custom design system (`theme/`) — dark/light color tokens, type scale, spacing/radius/shadow scale. No `react-native-paper`. |
| Server state | TanStack Query, one global `QueryClient` (no custom `staleTime`/`retry` config) |
| HTTP | Axios, one shared instance (`utils/axiosInstance.ts`) |
| Local persistence | `AsyncStorage` for `user`/`token` only |

## Design system (`theme/`)

`theme/colors.ts` exports `colors.dark`/`colors.light` (a `ColorScheme`) — background/surface/text/income/expense/accent tokens plus their tinted-background variants. `theme/typography.ts` is the type scale (`text.h1`, `text.body`, `text.label`, etc., keyed to the Inter font family). `theme/spacing.ts` has the spacing/radius/shadow scales. `theme/ThemeContext.tsx`'s `ThemeProvider` reads `useColorScheme()` and every component reads the active scheme via `useTheme()` — **never** hardcode a hex color in a component; pull it from `useTheme()` or `theme/colors.ts`.

## Provider stack

`app/_layout.tsx` mounts, in order: `SafeAreaProvider` → `QueryClientProvider` → `ThemeProvider` → `UserProvider` (`context/user.context.tsx`) → `AuthGuard` → `<Slot />` + `<Toast />`. Fonts (`@expo-google-fonts/inter`) are loaded before anything renders; `SplashScreen` is shown until they're ready.

## Data-fetching pipeline

`utils/axiosInstance.ts` (interceptors: attach JWT, unwrap 401 → clear storage + redirect to `/auth`, toast every error) → `utils/api.ts` (`apiGet`/`apiPost`/`apiPatch` thin wrappers) → `hooks/useApi.ts` (`useFetchData`, `usePost`, `usePatch` — TanStack Query wrappers with query-key invalidation) → screens/components. **Always** go through `useApi.ts`'s hooks from a component; don't call `axiosInstance`/`utils/api.ts` directly.

Unlike some Axios setups, the response interceptor here **does** `Promise.reject(error)` on failure — a mutation's `catch`/`onError` will fire normally on a 4xx/5xx. The interceptor's own Toast is a blanket "something went wrong" surface; a screen can add a more specific message in its own `catch` if useful, but doesn't have to.

## Auth flow

- `context/user.context.tsx`'s `UserProvider` holds `user`/`token`/`isLoading`, persisted to `AsyncStorage` under keys `"user"`/`"token"`.
- `app/auth.tsx` (login) and `app/register.tsx` are top-level routes, siblings of the `(tabs)` group.
- `utils/AuthGuard.tsx` is mounted once in the **root** `app/_layout.tsx`, above both the auth screens and `(tabs)` — so it can redirect in both directions (`user` on an auth route → `/`; no `user` off an auth route → `/auth`) regardless of which is currently active.
- On a 401, `axiosInstance.ts`'s response interceptor clears `AsyncStorage` and redirects to `/auth`. It does not currently touch `UserProvider`'s in-memory `user`/`token` state — see `known-issues.md`.
- There is no token-refresh mechanism; a 401 is the only session-expiry signal.

## Routing structure

`app/(tabs)/` is the authenticated tab group: `index` (Home), `history`, `addTransaction` (rendered as a raised center button, not a text tab), `smart-add`, `weeklyTransactions`. `monthlyTransactions` lives in the same group (so it shares the tab bar's surrounding chrome/back stack) but is excluded from the tab bar itself via `href: null` — it's reached only by tapping a month on the History screen. `app/auth.tsx`/`app/register.tsx` sit outside `(tabs)`.

## Component organization

`components/main/<Feature>/` holds screen-specific UI (`Home/`, `AddTransaction/`, `smartAdd/`, `HistoryPage/`, `MonthlyTransaction/`, `weeklyTransactionsPage/`), plus a cross-screen `components/main/shared/` bucket (`TransactionCard`, `DaySection`, `WeekDayRow`, `TotalBalanceCard`, `SummaryPills`, `TypeToggle`, `PrimaryButton`, `FormField`, `EmptyState`, `TransactionCardSkeleton`). Each `app/` route file is a thin re-export of its `components/main/...` page component — keep it that way; put logic in the component, not the route file.
