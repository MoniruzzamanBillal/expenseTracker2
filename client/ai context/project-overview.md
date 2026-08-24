# Project Overview — Client

## What this is

The Expo/React Native mobile app for ExpenseTracker, a personal income/expense tracking app. Talks to the API in `server/` (a fully independent project — see the root `CLAUDE.md`) over a hardcoded production base URL.

## Screens (`app/(tabs)/`)

| Screen | Purpose |
|---|---|
| `index.tsx` | Home — today's totals + transaction list |
| `addTransaction.tsx` | Manual transaction entry |
| `history.tsx` | Yearly history, per-month totals |
| `monthlyTransactions.tsx` | Current month's daily breakdown |
| `weeklyTransactions.tsx` | Friday–Thursday weekly summary + average spend |
| `smart-add.tsx` | Natural-language AI-assisted bulk entry (calls the server's `manage-money` endpoint, then lets the user review/edit before saving) |

Plus `app/auth.tsx`/`app/register.tsx` outside the tab group.

## Tech stack

Expo, React Native, `expo-router` (file-based routing), `react-native-paper` (no custom design system on top — see `architecture.md`), TanStack Query + Axios for data fetching, `AsyncStorage` for session persistence.

## Not a shared-types monorepo

There's no shared or generated types package between this app and `server/` — `types/Transaction.tyes.ts` and the server's `transaction.interface.ts` are two independently hand-maintained files that must be kept in sync manually. They've already drifted somewhat — see `known-issues.md#TYPE-2`.

For the provider stack, data-fetching pipeline, auth flow, and numbered invariants, read `architecture.md` next.
