# 23: Trend tab — expose `months` lookback parameter

> Ported from the reference implementation in `../../../Expense tracker app redesign/uploads/client`. Verified against the live server: `GET /transactions/trend-transaction` (`transaction.service.ts`, `getTrendSummary`) already reads `query.months`, clamps it with `Math.min(24, Math.max(1, Number(query?.months) || 6))` — accepts 1–24, defaults to 6. The client hardcodes the default today.

## Goal
Let the user choose the rolling lookback window (3 / 6 / 12 months) in the Trend tab (spec 18).

## Scope
**In**: add a segmented control (3 | 6 | 12) to `TrendTab`; pass `?months=N` in the fetch URL and query key.
**Out**: no changes to the server, `useApi`, or any other component.

## Implementation
- `components/main/MonthlyTransaction/TrendTab.tsx`:
  - Add `const [months, setMonths] = useState<TMonths>(6)` with `MONTH_OPTIONS = [3, 6, 12] as const` and `type TMonths = (typeof MONTH_OPTIONS)[number]`.
  - Update `useFetchData` key to `["trend-transaction", String(months)]` and URL to `` `/transactions/trend-transaction?months=${months}` ``.
  - Render a 3-option segmented control above the bar chart card, matching the Monthly/Weekly segmented-control visual style (border, active state uses `C.accent`/`C.accentDim`).
  - Bar chart heading falls back to `trend?.months ?? months` (was `?? 6`) so it reflects the selected value even before the refetch resolves.

## Verify when done
- [x] Switching months re-fetches and re-renders the bar chart
- [x] Label in bar chart heading reflects the selected month count
- [x] `yarn lint` / `npx tsc --noEmit` clean
