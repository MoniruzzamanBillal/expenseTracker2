# 22 — Monthly transactions: accept a target year

## Why

`GET /api/transactions/monthly-transaction` took `targetMonth` but always
derived the **year** from `new Date()`, so a past month could only be
addressed within the current year. The client (TrendTab month/year picker,
client spec 49) now needs to browse past years.

## Change

`getMonthlyTransactions` (`transaction.service.ts`) accepts an optional
`targetYear` query param alongside `targetMonth`:

```ts
const month = Number(query?.targetMonth) || today.getUTCMonth() + 1;
const year = Number(query?.targetYear) || today.getUTCFullYear();
```

- Query values arrive as strings; both are coerced with `Number(...)` and fall
  back to the current month/year on anything missing or non-numeric
  (`Number(undefined)` → `NaN` → falsy → fallback).
- `start`/`end` window construction, the daily grouping and the
  `categoryBreakdown` are otherwise unchanged — only the year source moved from
  a constant to the (defaulted) param.

Backward compatible: callers that send only `targetMonth` (Activity, Budgets)
keep the current-year behaviour exactly.

## Verify when done

- [x] `npx tsc --noEmit` clean.
- [ ] `yarn dev` + curl: `?targetMonth=1&targetYear=2025` returns that month of
      2025; omitting `targetYear` returns the current year. (Not run this
      session — needs a seeded past-year row.)
- [ ] Deploy (`yarn build` + Vercel) before the client picker works against prod.

Companion: client `ai context/specs/49-trend-month-year-picker.md`.
