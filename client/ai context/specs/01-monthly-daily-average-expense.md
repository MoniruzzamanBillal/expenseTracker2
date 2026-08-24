# 01: Monthly Daily-Average-Expense Section

## Goal

Add a "daily average expense" card to the Monthly Transactions page, visually mirroring the Weekly page's existing average card, but with a different divisor: calendar days elapsed in the month, not "days that had an expense." Example from the request: if today is Aug 24 and the month's total expense is 2000, the average shown is `2000 / 24`; if today were Aug 28, it'd be `2000 / 28`.

## Scope

**In scope:**

- A new card component (`MonthlyAverageCard.tsx`) in `components/main/MonthlyTransaction/`, visually matching `components/main/weeklyTransactionsPage/WeeklyAverageCard.tsx` (same styling/structure), with its own title text.
- New calculation logic inline in `components/main/MonthlyTransaction/MonthlyTransaction.tsx` (mirroring where `WeeklyTransactionsPage.tsx` computes its average), using the calendar-day divisor described below.
- Rendering the new card in `MonthlyTransaction.tsx`, placed consistently with how the weekly page places its own card.

**Out of scope (explicitly, per instruction):**

- No changes to `WeeklyTransactionsPage.tsx` or `WeeklyAverageCard.tsx` — the existing weekly calculation and section stay exactly as they are.
- No refactor of `WeeklyAverageCard` into a shared/generic component — see "Reuse decision" below for why.
- No server-side changes. `getMonthlyTransactions` (`server/src/app/modules/transaction/transaction.service.ts`) already returns `{ income, expense, transactionData }`, which is everything this needs.

## Design

### Current behavior for reference (unchanged, not touched by this spec)

`WeeklyTransactionsPage.tsx` computes its average as:

```ts
const daysWithExpense =
  weeklyTransaction?.data?.transactionData?.filter((d) => d.expense > 0)
    .length ?? 0;
const averageExpense =
  daysWithExpense > 0
    ? (weeklyTransaction?.data?.expense ?? 0) / daysWithExpense
    : 0;
```

This divides total weekly expense by the count of distinct days that had at least one expense — not by 7, and not by calendar days elapsed. This logic is intentionally **not** reused for monthly, because the request asks for a different divisor (calendar day-of-month, not "days with expense").

### Divisor logic for the monthly card (the core design decision — please confirm)

`MonthlyTransaction.tsx` already distinguishes the currently-viewed month from the real current month via `selectedMonth !== currentMonth` (used today to show/hide the "Current Month" button). Reuse that same comparison:

- **Viewing the current calendar month** (`selectedMonth === currentMonth`): divisor = `new Date().getDate()` (today's day-of-month — matches the request's Aug 24 → 24 example exactly).
- **Viewing a past (or future) month**: divisor = total days in that month. Use `date-fns`'s `getDaysInMonth` (already a project dependency — `date-fns`'s `format` is used in `TransactionAccordion.tsx`, so no new package needed) rather than hand-rolling `new Date(year, month, 0).getDate()`. Reasoning: a month that's already over has no "days elapsed" — averaging over its full length is the only sensible reading.
- Numerator is always `monthlyTransaction?.data?.expense ?? 0` — the month's total expense as already returned by the endpoint, not re-derived by summing `transactionData` (that array only contains days with at least one transaction, so summing it would be redundant with the total the server already computes).
- Divide-by-zero guard: if the divisor is somehow `0`, fall back to `0` — same defensive pattern `WeeklyAverageCard`'s calculation already uses (`daysWithExpense > 0 ? ... : 0`).

### Component: `MonthlyAverageCard.tsx`

- New file: `components/main/MonthlyTransaction/MonthlyAverageCard.tsx`.
- Structurally a copy of `components/main/weeklyTransactionsPage/WeeklyAverageCard.tsx`: same `View`/`Text`/`StyleSheet` structure (plain React Native, not `react-native-paper`, matching the existing card), same `COLORS` import from `@/utils/colors`, same `MaterialCommunityIcons` icon treatment, same `৳` + `.toFixed(2)` amount formatting — so the two pages read as one visual system.
- Props: `{ averageExpense: number }` — identical signature to `WeeklyAverageCard`.
- Title text: proposed static `"Avg Daily Expense · This Month"` — see Open Questions, since the divisor's meaning actually changes between current-month and past-month views, and the static label doesn't reflect that.

### Reuse decision: duplicate the card, don't generalize `WeeklyAverageCard`

`WeeklyAverageCard` is presentation-only (`averageExpense: number` in, formatted card out) and could technically be generalized with a `title` prop and shared between both pages. This spec deliberately proposes a separate `MonthlyAverageCard` instead, because:

1. The instruction was explicit: don't change or update the weekly page's calculation or section — even a purely-additive prop change touches a file that was asked to be left alone.
2. There's already a precedent for this kind of deliberate small duplication in this codebase (e.g. `TDailyData` is independently redeclared in both `MonthlyTransaction.tsx` and `TransactionAccordion.tsx` today).

If a single shared, generic card is preferred instead of two near-identical components, say so on review — this spec would need a small revision first (adding a `title` prop to `WeeklyAverageCard` and updating its one call site), which is a change to the weekly page's file even though its visible output and math stay identical.

### Placement

Render `<MonthlyAverageCard averageExpense={...} />` in `MonthlyTransaction.tsx` immediately after `<TotalBalanceCard ... />`, mirroring where `WeeklyTransactionsPage.tsx` places `WeeklyAverageCard` relative to its own `TotalBalanceCard` — so both pages follow the same layout rhythm (summary card → average card → period selector → daily list).

### Typing

No new type needed. The calculation only reads `monthlyTransaction?.data?.expense`, using the page's existing local `TData` type — unlike the weekly page's calculation, this one doesn't need to iterate `transactionData` at all.

## Implementation notes (for the follow-up implementation pass)

- Files touched: new `components/main/MonthlyTransaction/MonthlyAverageCard.tsx`; edit `components/main/MonthlyTransaction/MonthlyTransaction.tsx` (add the divisor logic + render the card). No other files, no server changes.
- Import `getDaysInMonth` from `date-fns` for the past-month branch rather than hand-rolling a `Date` calculation.
- Reuse `COLORS` from `@/utils/colors` exactly as `WeeklyAverageCard` does — don't introduce a second color source.

## Verify when done

- [x] Viewing the current month (e.g. today = Aug 24) shows `totalExpense / 24` — confirmed by code inspection: `selectedMonth === currentMonth` branch uses `new Date().getDate()`.
- [x] Advancing to tomorrow (or simulating a later date) changes the divisor accordingly (e.g. `/ 25` the next day) without a code change — `new Date().getDate()` is recomputed on every render, not cached/hardcoded.
- [x] Navigating to a past month shows `totalExpense / <days in that month>` — confirmed by code inspection: the `else` branch calls `getDaysInMonth(new Date(currentYear, selectedMonth - 1))`.
- [x] Tapping "Current Month" to return from a past month back to the present switches the divisor logic back to elapsed-days — `goToCurrentMonth` sets `selectedMonth` back to `currentMonth`, which re-triggers the elapsed-days branch.
- [x] `WeeklyTransactionsPage.tsx` and `WeeklyAverageCard.tsx` have zero diff — confirmed via `git diff --stat` against those paths (empty output).
- [x] No new network calls were added — confirmed by inspection: only a client-side calculation was added, no new `useFetchData`/`apiPost` call.

**Note on verification depth**: `tsc --noEmit` and `yarn lint` both pass clean, and a full `expo export --platform web` succeeded (Metro bundled and static-rendered `/monthlyTransactions` and `/weeklyTransactions` with no errors), confirming the component tree renders without throwing. This was not visually verified in a running simulator/browser against live data (no server was running during this pass) — recommend a quick manual check in Expo Go/web against a real month with data before considering this fully done end-to-end.

## Open questions (for review before implementation starts)

1. Should the card's title change wording between the "current month" (elapsed-days) and "past month" (full-month) states, or stay as one static label regardless?
2. Duplicate component (`MonthlyAverageCard.tsx`, recommended above to avoid touching the weekly page's file) vs. generalizing `WeeklyAverageCard` into one shared component with a `title` prop — confirm the duplicate approach, or say if the shared version is preferred despite touching the weekly file.
3. Confirm the numerator should be the month's total `expense` as returned by the endpoint (not recomputed by summing `transactionData`).
