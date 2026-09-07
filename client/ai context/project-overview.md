# Project Overview — Client

## What this is

The Expo/React Native mobile app for ExpenseTracker, a personal income/expense tracking app. Talks to the API in `server/` (a fully independent project — see the root `CLAUDE.md`) over a hardcoded production base URL.

## Screens (`app/(tabs)/`)

| Screen | Purpose |
|---|---|
| `index.tsx` | Home — today's totals + transaction list |
| `addTransaction.tsx` | Manual transaction entry; also the entry point to Smart Add (a button, not a tab — see below) |
| `history.tsx` | Yearly history, per-month totals (read-only, no drill-in) |
| `monthlyTransactions.tsx` | Current month's daily breakdown **and** the current Friday–Thursday weekly summary, toggled via an in-page segmented control ("Monthly"/"Weekly") — the two were merged into one tab during the visual redesign (`specs/06-visual-redesign-xpnsapp-design-system.md`, Decision 8); there is no separate `weeklyTransactions.tsx` route anymore |
| `smart-add.tsx` | Natural-language AI-assisted bulk entry (calls the server's `manage-money` endpoint, then lets the user review/edit before saving). Not shown in the tab bar (`href: null`) as of the same redesign (Decision 7) — reached via a button on Add Transaction's nav row instead |

Plus `app/auth.tsx`/`app/register.tsx` outside the tab group.

## Tech stack

Expo, React Native, `expo-router` (file-based routing), a custom design system in `theme/` (colors/typography/spacing, light+dark — see `architecture.md`) with `react-native-paper` kept mounted only for its `Portal`/`Modal` primitives (used by the two edit modals), TanStack Query + Axios for data fetching, `AsyncStorage` for session persistence.

## Not a shared-types monorepo

There's no shared or generated types package between this app and `server/` — `types/Transaction.tyes.ts` and the server's `transaction.interface.ts` are two independently hand-maintained files that must be kept in sync manually. They've already drifted somewhat — see `known-issues.md#TYPE-2`.

For the provider stack, data-fetching pipeline, auth flow, and numbered invariants, read `architecture.md` next.
