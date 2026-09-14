# 14: Trend summary endpoint (rolling N-month totals + latest-month category breakdown)

Status: 📝 Drafted — awaiting review before implementation starts. **The category-breakdown half depends on `09-wire-category-to-transaction.md`'s `buildCategoryBreakdown` helper existing — see Scope.**

## Cross-repo context

Server side of a 2-spec feature:
- **This doc** — one new endpoint returning N months of income/expense totals plus the latest month's expense category breakdown.
- `client/ai context/specs/18-trend-charts.md` — a new "Trend" segment on the existing Monthly/Weekly page, rendering this endpoint's response as a bar chart + donut.

Source: `feature-plan-proposals.md` §4 ("Charts & trends"), whose own implementation sketch says this should return "the same shape as Bike Log server's already-shipped spending-trend endpoint" (`bikelog_server/context/specs/17...` — actually the trend endpoint itself, referenced from `bikelog_app/ai context/specs/18-spending-mileage-trend-charts.md`'s Context section: `GET /bikes/:bikeId/spending-summary/trend?months=N` → `{ months, monthlySummary: [{ targetMonth, totalSpending, categoryBreakdown }] }`). This spec's response shape is modeled directly on that, adapted for this app's income+expense domain (Bike Log only tracks spending, no income side).

## A lesson borrowed directly from the sibling project, not re-learned the hard way here

Bike Log's own trend-chart feature took **four** specs to get right: spec 18 shipped it hardcoded to `?months=3`; spec 25 removed the whole feature because the donut had no legend (over-correcting a narrower complaint); spec 28 restored it with a legend; spec 30 — a full 3 specs later — finally fixed the fact that the user had wanted **6 months**, not 3, since the very first spec, and nobody had implemented it. Two mistakes worth avoiding here from the start rather than repeating:
1. **Default to 6 months, not 3**, for exactly the reason spec 30 documents — 3 is an arbitrary placeholder that's easy to ship and forget about.
2. (Client-side, flagged here for visibility) **any donut/pie chart must ship with a visible legend from the start** — a donut with color-only slices and no legend was reported as "broken" and nearly got the whole feature deleted in the sibling project.

## Goal

Give the client one endpoint to draw a monthly income/expense trend and a "where did my money go last month" breakdown from, without a separate request for each.

## Scope

**In scope:**
- `GET /transactions/trend-transaction?months=N` (query param optional, default `6`, clamped to `1-24` — same validated range Bike Log's own trend endpoints use).
- Response: `{ months, monthlySummary: [{ targetMonth: "YYYY-MM", income: number, expense: number }], categoryBreakdown: [...] }`, a **rolling** N-month window ending at the current month (not calendar-year bound, unlike `getYearlySummary`).
- Every month in the window appears in `monthlySummary`, including months with zero transactions (as `{ income: 0, expense: 0 }`) — never silently omitted. This is the exact zero-activity-month behavior Bike Log's spec 18 got right the first time; no reason to regress it here.
- `categoryBreakdown`: the **latest month's** expense-type transactions only, grouped by category, reusing spec 09's `buildCategoryBreakdown` helper verbatim (no new grouping logic). Expense-only, not income — matches this app's own `Budget` model (spec 12), which already made the same "spend" framing choice for the same reason ("a budget/spending breakdown only makes sense against spending").

**Explicitly out of scope:**
- **A UI-facing window selector.** `months` is a real, working query param (unlike Bike Log's initial hardcode), but there's no spec here for a client control to change it — the client spec picks one fixed value and calls it a day, same v1 scope Bike Log itself shipped.
- Per-category trend over time (e.g., "Food spending over the last 6 months") — only the single latest month gets a category breakdown; the multi-month series is category-agnostic totals only.
- `TransactionRequest` (Bike Log inbox model) — not part of any trend computation, same boundary every other transaction-summary spec in this app already draws.
- Any change to the existing `daily-transaction`/`monthly-transaction`/`weekly-transaction`/`yearly-transaction` endpoints — this is a new, separate endpoint, not a modification of those.

## Design

### Route — `server/src/app/modules/transaction/transaction.route.ts`

```ts
router.get(
  "/trend-transaction",
  authCheck,
  transactionControllers.getTrendSummary,
);
```

Matches this file's existing flat naming convention (`/monthly-transaction`, `/weekly-transaction`, `/yearly-transaction`) — no new module, no router-mounting change (already inside the registered `transactionRouter`).

### Service — `transaction.service.ts`, new `getTrendSummary` function

```ts
type TTrendPayload = { months?: string };

const getTrendSummary = async (userId: string, query: TTrendPayload) => {
  const months = Math.min(24, Math.max(1, Number(query?.months) || 6));

  const now = new Date();
  // Window: [start, end) — start is the 1st of the oldest included month,
  // end is the 1st of the month *after* the current one (exclusive upper bound).
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const transactionsRaw = await prisma.transaction.findMany({
    where: { userId, isDeleted: false, createdAt: { gte: start, lt: end } },
    include: { category: true },
  });
  const transactions = transactionsRaw.map(toApiShape);

  // Pre-seed one zero-valued bucket per month in the window, oldest first — same
  // "never drop a quiet month" discipline getYearlySummary already applies per-year,
  // generalized here to an arbitrary rolling window that can cross a year boundary.
  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const buckets: Record<string, { targetMonth: string; income: number; expense: number; transactions: typeof transactions }> = {};
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1) + i, 1));
    buckets[monthKey(d)] = { targetMonth: monthKey(d), income: 0, expense: 0, transactions: [] };
  }

  for (const t of transactions) {
    const key = monthKey(new Date(t.createdAt as Date));
    if (!buckets[key]) continue; // defensive — shouldn't happen given the query's own range
    if (t.type === transactionConstants.income) buckets[key].income += t.amount;
    else if (t.type === transactionConstants.expense) buckets[key].expense += t.amount;
    buckets[key].transactions.push(t);
  }

  // Object.values preserves insertion order here since every key is a "YYYY-MM" string,
  // never a bare-integer-like key JS would otherwise reorder — buckets stay oldest→newest.
  const monthlyBuckets = Object.values(buckets);
  const latest = monthlyBuckets[monthlyBuckets.length - 1];
  const latestExpenseTransactions = latest.transactions.filter((t) => t.type === transactionConstants.expense);

  return {
    months,
    monthlySummary: monthlyBuckets.map(({ targetMonth, income, expense }) => ({ targetMonth, income, expense })),
    categoryBreakdown: buildCategoryBreakdown(latestExpenseTransactions),
  };
};
```

`buildCategoryBreakdown` is imported/reused exactly as spec 09 defines it — **this function does not exist in the codebase today**; if this spec is picked up before spec 09 ships, implement spec 09 first (the proposal doc's own dependency note already says the same: "Depends on Categories (#1) only for the category-donut half"). Its bucket shape includes both `income`/`expense` per category — since the input here is pre-filtered to expense-type transactions only, every bucket's `income` will always read `0`. Accepted redundancy from reusing the exact existing helper rather than forking an expense-only variant for one call site.

**Why a rolling window, not `getYearlySummary`'s calendar-year approach**: a 6-month trend ending in, say, February needs to include the previous September through February — spanning a year boundary `getYearlySummary`'s `[Jan 1, Jan 1 next year)` range structurally can't express. `Date.UTC(year, month - N, 1)` handles a negative month index correctly (JS `Date` normalizes `month: -3` into the prior year automatically), so no manual year-rollover branching is needed.

### Controller — `transaction.controller.ts`, new thin wrapper

Same `catchAsync` + `sendResponse` shape as every other controller function in this file.

### Interface

No changes to `TTransaction` needed — this endpoint returns a new, dedicated response shape (`monthlySummary`/`categoryBreakdown`), not a list of raw transactions.

## Implementation notes

Files touched/added:
- `server/src/app/modules/transaction/transaction.route.ts` (edit — 1 new route)
- `server/src/app/modules/transaction/transaction.service.ts` (edit — 1 new function, reuses spec 09's `buildCategoryBreakdown`)
- `server/src/app/modules/transaction/transaction.controller.ts` (edit — 1 new function)

No new npm packages, no Prisma migration — reads existing `Transaction`/`Category` tables as-is.

## Verify when done

- [ ] `GET /api/transactions/trend-transaction` with no query param returns exactly 6 months, ending at the current month.
- [ ] `?months=3` and `?months=12` return exactly that many months; `?months=0`, `?months=999`, and `?months=abc` all clamp/fall back sanely (`1`, `24`, and the `6` default respectively) rather than erroring or returning an empty/huge array.
- [ ] A month in the window with zero transactions still appears in `monthlySummary` as `{ income: 0, expense: 0 }`, not omitted.
- [ ] The window correctly spans a calendar-year boundary (e.g. requested in January with `months=6` includes the previous August–December) — confirmed by checking `monthlySummary[0].targetMonth` against a manual calculation, not just trusting the code.
- [ ] `categoryBreakdown` reflects only the **latest** month's **expense**-type transactions — a large income transaction in the latest month, or any transaction (income or expense) in an earlier month in the window, does not appear in it.
- [ ] `categoryBreakdown` includes an "Uncategorized" bucket when the latest month has at least one expense transaction with `categoryId: null`, matching spec 09's existing convention.
- [ ] Two different users' data never mixes — verified against a second throwaway user's transactions.
- [ ] `yarn build` / `npx tsc --noEmit` / `yarn lint` clean.
