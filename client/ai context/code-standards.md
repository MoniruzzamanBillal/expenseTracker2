# Code Standards — Client

## Component organization

`components/main/<Feature>/` holds screen-specific UI (`AddTransaction/`, `HistoryPage/`, `Home/`, `MonthlyTransaction/`, `smartAdd/`, `weeklyTransactionsPage/`), plus a cross-screen `components/main/shared/` bucket (`TransactionCard.tsx`, `UpdateTransactionModal.tsx`, `TransactionCardSkeleton.tsx`, `TotalBalanceCard`). Top-level `components/*.tsx` and `components/ui/` are unmodified Expo template scaffolding (`hello-wave.tsx`, `themed-text.tsx`, `collapsible.tsx`, etc.) — don't add feature-specific components there.

## Data-fetching hooks — which ones are actually live

Of `hooks/useApi.ts`'s five hooks, `useFetchData`, `usePost`, and `usePatch` are the ones actually used across the app. `useUpdateData` and `useDeleteData` have zero call sites (`known-issues.md#FETCH-2`) — don't build new code on them without first checking whether the interceptor bug (`known-issues.md#FETCH-1`) needs fixing first, since their `onError`/success paths have the same dead-error-handling problem as the others.

The app's "delete" is a `usePatch` call against a PATCH endpoint (soft-delete), not a real `useDeleteData`/HTTP DELETE call — follow that pattern for consistency with the server's soft-delete model, not the unused `useDeleteData`.

## Constants — enum source of truth

Import the income/expense enum **only** from `constants/TransactionType.constant.ts` (`TransactionTypeConst`) in any new code. Two other copies exist (`known-issues.md#TYPE-1`) — don't add a fourth, and don't import from `AddTransactionPage.tsx`'s local `transactionConstants` the way `UpdateTransactionModal.tsx` currently does.

## Styling

`react-native-paper` defaults throughout; no custom design tokens/theme file exists. If you need a new visual pattern, check how the nearest existing screen in `components/main/` does it before introducing something new.

## Error handling — current (broken) pattern, documented as-is

Today, a failed mutation resolves rather than rejects (`known-issues.md#FETCH-1`), so the *only* user-facing error signal is the Toast fired inside `axiosInstance.ts`'s response interceptor. Don't write a new `try/catch` around a mutation expecting it to catch API errors — it won't, under the current interceptor.

**If the interceptor gets fixed** (uncommenting `Promise.reject(error)`), the intended pattern becomes: screens handle errors via each mutation's `onError`/a local `try/catch`, and the interceptor's blanket Toast should likely be scoped down or removed to avoid double-reporting the same error. This subsection is aspirational — it describes what *should* happen after a fix, not current behavior.

## Testing

There is no test suite on the client. Verify changes by running the app (`yarn start`) against a real or local server.
