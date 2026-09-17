# 21: Home screen — show today's category breakdown

> Ported from the reference implementation in `../../../Expense tracker app redesign/uploads/client` (a prior working snapshot of this same app, built against the current server). Verified against the live server before implementing: `GET /transactions/daily-transaction` (`server/src/app/modules/transaction/transaction.service.ts`, the daily-summary branch) already returns `categoryBreakdown` via `buildCategoryBreakdown(transactions)` — no server change needed.

## Goal
Surface the `categoryBreakdown` field already returned by `GET /transactions/daily-transaction` on the Home screen, consistent with how Monthly and Weekly already display it (spec 13) and Trend does (spec 18).

## Scope
**In**: add `categoryBreakdown: TBreakdownEntry[]` to `HomePage`'s `TData` type; render the existing `CategoryBreakdown` shared component (`components/main/shared/CategoryBreakdown.tsx`, already used elsewhere — no new component) below `TotalBalanceCard`. No API or query-key changes.
**Out**: any change to the endpoint, query invalidation, or `CategoryBreakdown` component itself.

## Implementation
- `components/main/Home/HomePage.tsx`: extend `TData` with `categoryBreakdown`; import `CategoryBreakdown` + `TBreakdownEntry` from `../shared/CategoryBreakdown`; render `<CategoryBreakdown data={categoryBreakdown} selected={null} onSelect={() => {}} />` right after `TotalBalanceCard`, only when there's data (read-only, no filter wiring on Home — Home stays a glance view, filtering already lives on Monthly/Weekly).

## Verify when done
- [x] Today's category chips appear on Home below the balance card when transactions exist
- [x] No regression to pending-sync banner, swipe-to-edit/delete, or pull-to-refresh
- [x] `yarn lint` / `npx tsc --noEmit` clean
