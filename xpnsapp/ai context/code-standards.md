# Code Standards — xpns

## Component organization

See `architecture.md`'s "Component organization" section. Top-level rule: a route file under `app/` is a one-line re-export; the actual screen lives under `components/main/<Feature>/`.

## Data-fetching hooks

Import `useFetchData`/`usePost`/`usePatch` from `hooks/useApi.ts` — don't call `utils/api.ts` or `utils/axiosInstance.ts` directly from a component. `usePost`/`usePatch` both take an optional `invalidateQueriesKeys: string[][]` and are called with `mutate({ url, payload })`/`mutateAsync({ url, payload })`.

The API's "delete" is a `usePatch` call against a PATCH endpoint (soft-delete), not a real DELETE request — see `TransactionCard.tsx` for the pattern. There's no `useDeleteData`; don't add one for a soft-delete endpoint.

## Constants — enum source of truth

Import the income/expense enum **only** from `constants/TransactionType.constant.ts` (`TransactionTypeConst`, plus the derived `TTransactionType` type). Don't inline a second copy anywhere, however small.

## Styling — design system, not ad-hoc colors

Every component reads its colors from `useTheme()` (`theme/ThemeContext.tsx`), never a hardcoded hex value, so dark/light both stay correct automatically. Typography comes from `theme/typography.ts`'s `text.*` presets; spacing/radius/shadow from `theme/spacing.ts`. If you need a new visual pattern, check how the nearest existing screen in `components/main/` builds it (e.g. `DaySection`/`TransactionCard` for any new list-of-transactions UI) before introducing a new one-off style.

## Error handling

The axios response interceptor rejects on HTTP errors (see `architecture.md`), so a mutation's `try { await mutateAsync(...) } catch { ... }` or `onError` will actually run. The interceptor also fires a blanket Toast for every failure — a screen-level `catch` doesn't need to (and generally shouldn't) show a second, duplicate error message; it exists for screen-specific follow-up state (e.g. re-enabling a button), not for user-facing messaging.

## Testing

There is no automated test suite. Verify changes by running the app (`npx expo start`) against a real or local API — see `known-issues.md` for the placeholder base URL that needs setting first.
