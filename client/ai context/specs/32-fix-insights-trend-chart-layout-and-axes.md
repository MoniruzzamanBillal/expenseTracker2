# 32 — Fix the Insights trend chart: missing axis labels, bars overflowing the card

**Status**: Completed 2026-09-30
**Scope**: `client/components/main/MonthlyTransaction/TrendTab.tsx` only. No server change, no data-layer change, no dependency change.

## Reported symptom

User: "in insight page, the chart is not appropriate. i'm not seeing any label in x axis and y axis. also
the income expense bar line is going outside the chart card."

Three separate defects, plus two more found while reading the file.

## 1. Bars overflowed the card — no `width` was passed

`BarChart` was rendered with `barWidth={28} spacing={24}` and **no `width` prop**. Reading
`react-native-gifted-charts@1.4.78`'s `Components/BarAndLineChartsWrapper/index.js`, the chart body is a
`ScrollView` with `position: 'absolute'`, and the last entry in its `contentContainerStyle` is:

```js
!props.width && { width: totalWidth }
```

So with no `width`, the content is sized to the full `totalWidth` and is neither clipped nor scrollable —
it is an absolutely-positioned child wider than its parent, which is exactly "going outside the chart
card". `BarChart/index.js` falls back to `screenWidth` for its own bounds checks for the same reason.

Two compounding causes, both fixed:

- **No `width`.** Now measured from the card's own `onLayout` (minus its `spacing.md` padding on each
  side) rather than derived from `Dimensions`, so it stays correct whatever padding `HistoryPage` applies.
  The chart renders only once that measurement lands.
- **Fixed bar geometry.** 28pt bars with 24pt gaps need ~620pt at the 12-month setting, roughly twice the
  available width. Bars are now solved to fit: `slot = plotWidth / n`,
  `barWidth = clamp(slot × 0.5, 8, 26)`, `gap = slot − barWidth`, with `initialSpacing`/`endSpacing` at
  half a gap. Since total is `n × (barWidth + gap)`, that is `plotWidth` exactly.

Verified by execution at a 296pt card (a 360pt screen less `screenPad` and card padding):

| Months | plot | bar | gap | total | fits |
|---|---|---|---|---|---|
| 3 | 250 | 26 | 57.3 | 250.0 | ✅ |
| 6 | 250 | 20 | 21.7 | 250.0 | ✅ |
| 12 | 250 | 10 | 10.8 | 250.0 | ✅ |

## 2. No y-axis labels — the axis collapsed on all-negative data

The bars plot **net** (`income − expense`) per month, so values are frequently negative, and for many
users *every* month in the window is. Nothing set `maxValue`/`stepValue`/`noOfSections`, so the chart
derived them from the data — and when `max(nets) < 0` the positive half of the scale collapses to 0,
taking the tick values with it.

Both halves are now given one explicit step, so the ticks are always real numbers and the zero line is a
true zero:

```ts
const step = niceStep(Math.max(Math.abs(maxNet), Math.abs(minNet)) / 2);
const sectionsAbove = Math.max(1, Math.ceil(maxNet / step));
const sectionsBelow = minNet < 0 ? Math.max(1, Math.ceil(-minNet / step)) : 0;
```

`niceStep` rounds up to 1/2/5 × 10^k so ticks land on numbers a person reads as round. Executed across
six shapes, each covering its data:

| Case | step | ticks |
|---|---|---|
| all negative (the reported case) | 20000 | `20k 0 −20k −40k` |
| all positive | 5000 | `10k 5k 0` |
| mixed | 10000 | `20k 10k 0 −10k −20k` |
| all zero | 1 | `1 0` |
| single month | 500 | `500 0 −500 −1k` |
| lakh scale | 200000 | `4L 2L 0 −2L` |

`formatTotal` could not be reused for these — its grouped two-decimal output ("1,23,456.00") needs a row
of its own, not a 46pt gutter. A local `compact` helper does k/L (en-IN grouping, matching the rest of
the app) and uses U+2212 for the minus like every other negative figure in the UI. Widest label across
all six cases is 4 characters, well inside the 46pt `yAxisLabelWidth`.

## 3. No x-axis labels — the card's bottom edge cut across them

The month labels were being rendered; the card was ending above them. The library's chart container sets

```js
marginBottom: (xAxisLabelsHeight ?? xAxisTextNumberOfLines * 18) - 55 - xAxisLabelsVerticalShift
```

which with the defaults is **−37**: it reserves 50pt of slack above the labels and then trims it back off
so a following sibling sits close. That negative margin pulls the card's content box up over the label
strip. Fixed by padding it back out — `styles.barCard` adds `paddingBottom: spacing.xxl` on this card
only, not on the donut card, which has no axis.

Also, `xAxisThickness` was `0`, hiding the axis line. With bars that can point downward a zero line is
load-bearing, so it is now drawn 1pt in `C.border`, and the horizontal rules are `dashed` in `C.divider`
instead of the library's default light grey (which was a mid-grey line on a dark card).

## 4. `text.label` does not exist — both card titles had no typography

Both chart titles were styled `text.label`. There is no `label` key in `theme/typography.ts`. Because
`text` is typed `Record<string, TextStyle>`, `text.label` typechecks fine and is `undefined` at runtime,
so the titles fell back to the platform default font at 14pt while only picking up their colour.

Both moved to `text.kicker`, which is the token `NetTodayCard` uses for the same job. `kicker` carries
`textTransform: 'uppercase'`, so the hand-uppercased strings became sentence case
("Net total · last 6 months") and the token does the casing — same as `"Net today"` on Home.

> This is worth a grep before the next release: `Record<string, TextStyle>` means **any** typo in a
> `text.*` key is silently `undefined` rather than a type error. Not chased here beyond this file.

## 5. The donut's centre was white in dark mode

`PieChart` with `donut` fills its inner circle with `innerCircleColor`, which defaults to white — a
bright hole punched through the middle of a `C.surface` card. Now `C.surface`, and the space it frees is
used for a `centerLabelComponent` showing the period's total spend.

## Also added

- An explicit `height={150}` on the chart, so vertical space no longer depends on the library's default.
- A "No months to chart yet." line in place of an empty chart when `monthlySummary` is empty, which also
  keeps the axis math away from `Math.max()` of an empty list.

## Verify when done

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` clean
- [x] Axis step/tick math executed across six data shapes (all-negative, all-positive, mixed, all-zero, single-month, lakh-scale) — every one yields labelled ticks that cover its data
- [x] Bar fit executed at 3/6/12 months — total width equals the plot width exactly
- [x] Overflow mechanism confirmed by reading the installed library, not assumed
- [ ] **On a device**: bars, both axes and the labels all sit inside the card at 3, 6 and 12 months
- [ ] **On a device**: y-axis ticks are readable and not truncated at 46pt for the user's real figures
- [ ] **On a device**: a month with a negative net draws below the zero line, with its month label still legible
- [ ] **On a device**: the donut's centre matches the card and the centre total is not clipped by the 60pt inner radius
- [ ] **Visual, light mode**: `C.divider` dashed rules are visible but not heavy on `C.surface`
- [ ] Nothing here was rendered — the whole file is reasoned from the installed library's source plus executed arithmetic. Every layout claim needs one look on a device.

## Deliberately not changed

- The bar chart plots **net**, not income and expense side by side. The user's phrase "the income expense
  bar line" may mean they expect grouped bars; the card's own title says "Net total", the colour already
  encodes the sign, and switching to grouped bars is a different chart, not a layout fix. Worth asking.
- `radius={90}` on the donut is still fixed rather than measured. It fits a 296pt card with room to
  spare, and unlike the bar chart it is centred, so it degrades symmetrically on a narrow screen.
