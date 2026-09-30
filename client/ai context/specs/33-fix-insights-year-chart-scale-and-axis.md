# 33 — Fix the Insights Year chart: bars scaled off a net denominator, no y-axis

**Status**: Completed 2026-09-30
**Scope**: `client/components/main/HistoryPage/HistoryPage.tsx`, plus one shared helper added to
`client/utils/formatAmount.ts`. No server change, no data-layer change.

Companion to spec 32, which fixed the **Trend** tab's chart. This is the **Year** tab, which is a
different chart entirely — hand-rolled `View`s, not `react-native-gifted-charts` — so none of spec 32's
fixes applied to it.

## Reported symptom

User: "in the insight page, in year tab, in the chart data, i'm not seeing any label in y axis and the
line is going outside of the chart card."

## 1. Bars ran thousands of points past the card — a net denominator scaling gross values

The twelve-column income/expense chart sized each bar as:

```tsx
const maxAbs = Math.max(...yearSummary.map((x) => Math.abs(x?.income - x?.expense)), 1);
// …
height: Math.max((m?.income / (maxAbs || 1)) * 54, m?.income > 0 ? 2 : 0)
```

`maxAbs` is the largest **|income − expense|** — a *net* — but it divides **income** and **expense**,
which are *gross*. For a year of months that roughly break even the denominator is tiny while the
numerators are large, and nothing clamped the result. Reproduced by execution on three near-breakeven
months:

```
maxAbs (largest |net|) = 1000    container height = 54
month 0: income bar 2160pt, expense bar 2133pt  -> overflow by 2106pt
month 1: income bar 2268pt, expense bar 2214pt  -> overflow by 2214pt
month 2: income bar 2052pt, expense bar 2106pt  -> overflow by 2052pt
```

Bars over 2000pt tall inside a 54pt box. React Native does not clip overflow by default, so they ran
down the whole screen — "the line is going outside of the chart card".

Fixed three ways:

- The scale now comes from the largest **gross** figure in the year
  (`Math.max(...yearSummary.flatMap((m) => [m.income, m.expense]), 1)`), which is the only denominator
  that makes sense for two series drawn side by side.
- A `barHeight` helper clamps at both ends — `Math.min(CHART_H, …)` so nothing can ever draw past the
  plot again regardless of the data, and a 2pt floor for any non-zero amount so a month with one small
  entry doesn't read as empty.
- `maxAbs` was being recomputed **inside** the `.map()`, so twelve times per render over all twelve
  months. Hoisted into a `useMemo`.

Executed across five shapes; no overflow in any, including the one that broke:

| Case | peak | tallest bar (limit 64) |
|---|---|---|
| near-breakeven (the reported case) | 42000 | 64.0 |
| expense-heavy | 15000 | 64.0 |
| one huge month | 900000 | 64.0 |
| tiny amounts | 5 | 64.0 |
| all zero | 1 | 0.0 |

## 2. No y-axis, because there was no axis at all

Not a styling miss — the chart had no y-axis to label. It was twelve bar pairs and a row of month
initials, with no scale of any kind, so a reader could see shape but not magnitude.

Added a 34pt gutter with ticks at 0, half and full peak, and a dashed-free set of 1pt rules in
`C.divider` at the same three fractions. Each tick is absolutely positioned off `bottom` and lifted half
a line-height so it centres on its own rule; laying them out in flow would have spaced their *boxes*
evenly rather than their baselines.

Tick labels use the new shared `formatCompact`, verified to stay within 4 characters in a 34pt gutter at
every scale from ৳5 to ৳9 lakh:

```
peak 42000  ->  0  21k  42k
peak 15000  ->  0  7.5k  15k
peak 900000 ->  0  4.5L  9L
```

Also added a small In/Out legend beside the card's title, since two colours with no key is the other half
of "I can't read this chart".

### `formatCompact` extracted to `utils/formatAmount.ts`

Spec 32 introduced a local compact formatter inside `TrendTab` for exactly this job. Rather than write a
second copy here it moved to `utils/formatAmount.ts` next to `formatAmount`/`formatTotal`, and `TrendTab`
now imports it. `formatTotal` can't serve axis ticks — its grouped two decimals ("1,23,456.00") need a
row of their own, not a 34pt gutter.

## 3. Column alignment made robust

The old layout used `justifyContent: "space-between"` with each column holding its bars *and* its month
letter. The bars and the letters are now two separate rows so the gridlines don't run across the text,
which means the two rows have to agree on column positions — `space-between` would not guarantee that.
Both rows now use `flex: 1` columns, which pins each letter under its own pair by construction.

Verified the 11pt bar pair (5 + 1 + 5) fits the column at every plausible card width:

| Card | plot | column |
|---|---|---|
| 296 | 238 | 19.8 |
| 272 | 214 | 17.8 |
| 240 | 182 | 15.2 |

## 4. The chart is now gated on real activity, not on row count

It rendered whenever `yearSummary.length > 0`. A year can return twelve rows that are all zero, which
drew an empty plot whose ticks came from the peak's `1` fallback — "0 1 1". Now gated on
`hasYearActivity` (some month has non-zero income or expense).

## Year net card restyled (same session, user request)

> "make the text a bit white and make the text a bit small also reduce the padding a bit small"

Applied to `HistoryPage`'s own `netCard` only — `MonthlyTransaction` and `NetTodayCard` have their own
copies of this card and were left alone.

| | Before | After |
|---|---|---|
| "Net · 2026 so far" kicker | `C.textSecondary` | `C.text` — one step up, matching what `NetTodayCard`'s header already does. A token, so light mode steps to its own near-black rather than going pale. |
| Net figure | `text.amountLg` (40/44/−0.8) | 32/36/−0.64 as a local override on the token, so `fontFamily.medium` and tabular-nums still come from it |
| Sign + ৳ | 22 | 16, half the amount, tracking it rather than the type scale |
| In / Expense | `text.bodySm` (13) | `text.caption` (12) |
| Card padding | `spacing.base` / bottom `spacing.lg` / gap `spacing.md` | `spacing.md` / bottom `spacing.base` / gap `spacing.sm` |

The type scale jumps 40 straight to 18 with nothing between, so the headline overrides `amountLg`'s
metrics rather than reaching for a different token — the same approach, and nearly the same size, as
`NetTodayCard` on Today.

## Verify when done

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` clean
- [x] The overflow reproduced by execution against the old formula, and the fix shown clamped across five data shapes
- [x] Tick label widths and column widths checked by execution at three card widths
- [ ] **On a device**: Year tab bars stay inside the card for a year of near-breakeven months (the case that broke)
- [ ] **On a device**: y-axis ticks line up with their gridlines
- [ ] **On a device**: each month initial sits under its own bar pair, and the current month's initial is still accent-coloured
- [ ] **On a device**: future months of the current year still show their 2pt stub
- [ ] **On a device**: the restyled net card — brighter kicker, smaller figure, tighter padding — and that its glow elevation still reads at the reduced padding
- [ ] **Visual, light mode**: `C.divider` rules on `C.surface`
- [ ] Nothing here was rendered. The arithmetic is executed and the overflow cause is proven, but every layout claim needs one look on a device.

## Note for whoever picks this up next

Both charts on Insights are now fixed, but they were fixed independently and they are still two unrelated
implementations of nearly the same picture — one gifted-charts, one hand-rolled `View`s, with their own
scale logic, their own tick rendering and their own legends. Spec 32's `text.label`-doesn't-exist finding
also still stands as a repo-wide risk: `theme/typography.ts` types `text` as
`Record<string, TextStyle>`, so any typo'd `text.*` key is silently `undefined` instead of a type error.
Neither is in this spec's scope.
