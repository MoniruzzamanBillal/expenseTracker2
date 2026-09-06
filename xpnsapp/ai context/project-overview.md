# Project Overview — xpns

## What this is

`xpns`, an Expo/React Native personal income/expense tracker. This is a **from-scratch visual redesign** of an existing production app (same author's `ExpenseTracker` client) — same screens, same API contract, same `useApi` data-fetching pattern, new dark/light design system in place of raw `react-native-paper` defaults. See the repo root `README.md`/`chats/`/`project/` for the Claude Design handoff this was built from.

Talks to an ExpenseTracker-compatible API over a base URL you set in `utils/envConfig.ts` (currently a placeholder — see `known-issues.md`).

## Screens

| Screen | Route | Purpose |
|---|---|---|
| Login | `app/auth.tsx` | Email + password sign in |
| Register | `app/register.tsx` | Name, email, password sign up |
| Home | `app/(tabs)/index.tsx` | Today's income/expense/balance + today's transactions |
| Add Transaction | `app/(tabs)/addTransaction.tsx` | Manual entry (type, title, amount, description) |
| Smart Add | `app/(tabs)/smart-add.tsx` | Natural-language AI entry → editable parsed draft list → save |
| History | `app/(tabs)/history.tsx` | Yearly view, totals per month, tap a month to drill in |
| Monthly Transactions | `app/(tabs)/monthlyTransactions.tsx` | Current (or selected) month's daily breakdown — reached only from History, not a tab |
| Weekly Transactions | `app/(tabs)/weeklyTransactions.tsx` | Friday–Thursday week view with daily average spend |

## Tech stack

Expo, React Native, `expo-router` (file-based routing), a small custom design system (`theme/`) — no `react-native-paper`. TanStack Query + Axios for data fetching, wrapped in `hooks/useApi.ts` (`useFetchData`/`usePost`/`usePatch`), `AsyncStorage` for session persistence.

## Not a shared-types monorepo

There's no shared/generated types package between this app and its server. `types/Transaction.types.ts` and whatever the server's transaction shape is are two independently hand-maintained definitions — keep them in sync manually if you touch either side.

For the provider stack, data-fetching pipeline, auth flow, and design-system conventions, read `architecture.md` next.
