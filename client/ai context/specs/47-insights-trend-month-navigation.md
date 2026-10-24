# 47: Insights › Trend — month navigation + collapsed-by-default category accordions

> User-reported, two complaints about the Trend tab (`components/main/MonthlyTransaction/TrendTab.tsx`, built by `7892980` without a spec of its own):
> 1. It only ever shows the **current** month. There is no way to look at an earlier month, and the user wants chevron paging plus a way back to the current month "just like the monthly transaction page" (`MonthlyTransaction.tsx`, spec 31's "This month" pill).
> 2. Every category's transaction list renders **already open**. It should start closed and toggle open/closed on a tap of the header.

## Context — why this is an endpoint swap, not a new query param

`TrendTab` reads `GET /transactions/trend-transaction?months=1`. That endpoint's window is **rolling and anchored to now** (`transaction.service.ts`, `getTrendSummary`: `start = Date.UTC(y, m - (months - 1), 1)`, `end = Date.UTC(y, m + 1, 1)`), so `months` can only reach *further back from today* — it can never address a single past month. Month navigation therefore needs either a new server parameter (a deploy, and this is a client-only request) or a different endpoint.

`GET /transactions/monthly-transaction?targetMonth=<1-12>` already returns everything this tab draws, for **any** month of the current year:

- `categoryBreakdown: TCategoryBreakdownEntry[]` — the donut and its legend, as-is.
- `transactionData: { date, income, expense, transactions }[]` — every transaction of the month, `include`d `category` and all (`getMonthlyTransactions` → `toApiShape`), newest-first, from which the per-category detail the tab renders can be rebuilt locally.

Two incidental wins from that swap, both worth having:

- **The cache is shared with Activity and Budgets.** Using the exact same query key Activity uses (`["monthly-transaction", "monthly-transaction-<m>", "<m>"]`, the pattern `BudgetFormModal.tsx:48` already borrows) means a month Activity has loaded renders instantly here, and vice versa.
- **Writes now invalidate it.** Every mutation in the app invalidates the `["monthly-transaction"]` prefix (`AddTransactionPage`, `TransactionCard`, `UpdateTransactionModal`, `SmartAdd`, …). **Nothing** invalidates `["trend-transaction"]`, so adding or deleting a transaction today leaves the Trend tab stale until the cache expires. The swap closes that silently.

What is lost: nothing this tab renders. `trend-transaction`'s `monthlySummary` is not drawn here (the bar chart went away in the Nocturne redesign), and its `categoryDetail` is this tab's only consumer. The server endpoint and both response fields stay exactly as they are — unused by the client after this spec, not removed. `TTrendSummary`/`TCategoryDetailEntry` stay in `types/Transaction.tyes.ts` too; `TCategoryDetailEntry` is reused as the shape of the locally-derived buckets, so only `TTrendSummary` goes unreferenced.

## Scope

**In** — `components/main/MonthlyTransaction/TrendTab.tsx` only:
- fetch `monthly-transaction?targetMonth=<selected>` instead of `trend-transaction?months=1`;
- derive the per-category detail from that payload, mirroring the server's `buildCategoryDetail` ordering;
- a chevron month selector + "This month" pill, visually identical to Activity's;
- category accordions closed by default, toggling on tap, reset on a month change;
- month name in the two card headings and the empty states, in place of "this month".

**Out**:
- No server change, no deploy. No change to `HistoryPage.tsx` (it renders `<TrendTab />` and nothing else needs to move), `useApi`, the types file, or any other screen.
- **No year navigation.** Like Activity, every fetch is a `targetMonth` inside the current year — `getMonthlyTransactions` derives the year from `new Date()` and takes no year parameter. Cross-year browsing stays on Insights › Year.
- **No error/offline UI.** `TrendTab` has none today (a failed read falls through to the empty state) and spec 37's `ErrorState`/`OfflineNotice` treatment is not being retro-fitted here. Flagged below, not fixed.
- `known-issues.md` items left alone per `ai-workflow-rules.md`.

## Implementation

### A — month state and navigation

1. ✅ Module-level, beside the existing helpers: `const now = new Date()`, `const currentMonth = now.getMonth() + 1`, `const currentYear = now.getFullYear()`, `const startMonth = 1`. Forward paging stops at `currentMonth`, **not** December — a future month in the current year is always empty, and this matches Insights › Year disabling the forward chevron at `currentYear`. (Activity deliberately differs: it allows up to `endMonth = 12`.)
2. ✅ `const [selectedMonth, setSelectedMonth] = useState(currentMonth)`.
3. ✅ `handleMonthChange(direction)` guarded at both ends, `goToCurrentMonth()` → `setSelectedMonth(currentMonth)`, both copied in spirit from `MonthlyTransaction.tsx`.
4. ✅ Month label via `date-fns` `format(new Date(currentYear, selectedMonth - 1, 1), "MMMM")` — `date-fns` is already imported in this file, and this avoids a **third** copy of the `MONTHS` array (`MonthlyTransaction.tsx` and `HistoryPage.tsx` already each carry one; consolidating those is out of scope).
5. ✅ Render, above the content, a centered chevron row (`chevron-back` / month name + muted year / `chevron-forward`, `Ionicons`, 18pt, `C.textMuted` when disabled) and, **only when `selectedMonth !== currentMonth`**, the "This month" pill: `today-outline` 11pt + `text.captionMd`, `C.accent` border on `C.accentDim`, `C.accentText` text, 22pt tall with `hitSlop` — byte-for-byte the treatment spec 31 settled on for Activity, so the one accent affordance looks the same on both screens.
6. ✅ The nav row renders **outside** the loading branch, so stepping to an uncached month keeps the selector on screen while the skeleton shows underneath (today's `if (isLoading) return <TransactionCardSkeleton />` would blank the whole tab).

### B — data

7. ✅ Local `type TMonthlyData = { income: number; expense: number; transactionData: TDailyData[]; categoryBreakdown: TCategoryBreakdownEntry[] }` with `TDailyData = { date: string; expense: number; income: number; transactions: TTransaction[] }` — same local-type pattern `MonthlyTransaction.tsx` uses for the same payload.
8. ✅ `useFetchData<TMonthlyData>(["monthly-transaction", `monthly-transaction-${selectedMonth}`, String(selectedMonth)], `/transactions/monthly-transaction?targetMonth=${selectedMonth}`)` — the key must match Activity's **exactly**, character for character, or the shared cache and the mutation invalidations above don't apply.
9. ✅ `categoryDetail` in a `useMemo` over `transactionData`: flatten the daily buckets, bucket by `t.categoryId ?? "uncategorized"`, carry `name`/`icon` from `t.category` (falling back to `"Uncategorized"`/`null`), sum `income`/`expense` by `t.type`, and collect `{ _id, type, title, description, amount, createdAt }` rows. Order mirrors the server's `buildCategoryDetail` so the view doesn't change under the user: transactions `createdAt` **desc**, buckets `b.expense - a.expense || b.income - a.income` (biggest spender first).
    - The type comparison reads `TransactionTypeConst` from `constants/TransactionType.constant.ts` — the only permitted enum site (`known-issues.md#TYPE-1`).
    - `createdAt` is a string here (it was a `Date` server-side), so sort on `new Date(x).getTime()`, with `0` for an unparseable value rather than a `NaN` comparator.
9a. ✅ The donut keeps reading the server's `categoryBreakdown`, but **filtered to `expense > 0`**: `getMonthlyTransactions` builds it from *all* transactions, where `getTrendSummary` built it from expense rows only, so an income-only category would otherwise enter `pieData` as a zero-value slice and a "৳0 (0.0%)" legend row.
10. ✅ Loading: keep `TransactionCardSkeleton`, but gate it the spec-37 way — `isPending && !hasCached` where `hasCached = !!data?.data` — so a cached month paints immediately and only a genuinely cold month shows the skeleton.

### C — accordion default state

11. ✅ Replace `collapsed: Record<string, boolean>` (open-by-default, `open = !collapsed[key]`) with `expanded: Record<string, boolean>` and `open = !!expanded[key]`, toggled by `setExpanded((p) => ({ ...p, [key]: !p[key] }))`. Default closed, tap opens, tap again closes. The chevron already follows `open`, so it needs no change.
12. ✅ Reset `expanded` to `{}` on `selectedMonth` change, in an effect — same reasoning as `MonthlyTransaction.tsx` resetting `selectedCategoryKey` on a month change (spec 13): carrying one month's open rows into another month's list, which may not even contain those categories, is confusing.
13. ✅ Add `accessibilityRole="button"` + an `accessibilityState={{ expanded: open }}` on the header, since it is now a real disclosure control rather than decoration.

### D — copy

14. ✅ `By category · <Month>`, `Spending by category · <Month>`, `No transactions in <Month>`, `No spending in <Month> to break down` — the month name throughout, since "this month" is now a lie on 11 of 12 selections.

## Verify when done

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` clean
- [ ] Trend tab opens on the current month, same numbers as before the change
- [ ] Back chevron steps to the previous month and the data changes with it; disabled at January
- [ ] Forward chevron disabled on the current month
- [ ] "This month" pill appears only off the current month and returns to it in one tap
- [ ] All category accordions start closed; a tap opens one, a second tap closes it; opening one does not open the others *(state logic read-verified; needs a tap pass)*
- [ ] Open rows reset when the month changes
- [ ] Donut, centre total and legend describe the selected month — **no zero-value slice for an income-only category verified by execution** (see notes), the rest device-pending
- [ ] A month with no entries shows the empty states naming that month, not "this month"
- [ ] Device pass (Expo Go / APK) — the whole tab, both themes

## Implementation notes

**Done 2026-10-24.** Single file touched: `components/main/MonthlyTransaction/TrendTab.tsx` (+ this spec and the tracker row). `npx tsc --noEmit` and `yarn lint` both clean.

Everything landed as planned; three details worth recording:

- **The derivation was verified by execution, not by eye.** The `categoryDetail` memo and the donut's `expense > 0` filter were lifted into a throwaway Node script and run against a hand-built two-day payload covering a multi-entry category, a bigger-spending category, an income-only category, a `categoryId: null` row and one unparseable `createdAt`. All eight assertions pass: buckets come back biggest-spender-first (`Rent, Food, Uncategorized, Salary`), a category's rows newest-first, sums correct across days, `Uncategorized` keeps `categoryId: null`, a `NaN` date neither drops its row nor poisons the comparator, an empty month yields no buckets, and the income-only category is kept out of `pieData`. That matches `buildCategoryDetail`'s `b.expense - a.expense || b.income - a.income` ordering, so the list reads the same as it did before the endpoint swap.
- **`atTime` exists because `createdAt` changed type across the swap.** `buildCategoryDetail` sorted `Date` objects (`c.createdAt.getTime()`); the monthly payload is JSON, so the same field arrives as a string and `TCategoryDetailTransaction.createdAt` types it as one. Sorting on `new Date(x).getTime()` directly would hand the comparator `NaN` for a malformed value, which leaves the array order unspecified rather than merely unsorted — hence the `0` fallback.
- **`isPending && !hasCached`, not `isLoading`.** With the shared Activity/Budgets cache this now matters in practice: a month either of those screens has already fetched paints immediately instead of flashing a skeleton.

**Not verified in a running app.** No session was available here — the client's `baseURL` points at `https://exp2server.vercel.app` and a browser pass needs real credentials, so every behavioural item in the Verify list above is still open, including both themes and the pill's light-mode `accentDim` contrast (the same standing caveat spec 31 left).

**Flagged, not fixed** (per `ai-workflow-rules.md`): `TrendTab` still has no error or offline UI, so a failed read falls through to "No transactions in <Month>" as if the month were empty. Spec 37 gave `HistoryPage`/`MonthlyTransaction` `ErrorState` + `OfflineNotice`; this tab was never retro-fitted and this spec deliberately did not widen to it.

**Server side, informational:** `GET /transactions/trend-transaction` now has **no client consumer**. Nothing was removed on either side — the endpoint, `monthlySummary` and `categoryDetail` all stay as they are, and `TTrendSummary` stays in `types/Transaction.tyes.ts` (now unreferenced; `TCategoryDetailEntry` is still used as the local bucket shape).
