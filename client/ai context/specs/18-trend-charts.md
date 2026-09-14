# 18: Trend charts (bar + category donut, new segment on Monthly/Weekly)

Status: 📝 Drafted — awaiting review before implementation starts. **Depends on `server/ai context/specs/14-trend-summary-endpoint.md` — build/deploy that first, this UI is tested against its response shape.**

## Cross-repo context

Client side of a 2-spec feature:
- `server/ai context/specs/14-trend-summary-endpoint.md` — the `GET /transactions/trend-transaction?months=N` endpoint this screen consumes.
- **This doc** — a new "Trend" segment on the existing Monthly/Weekly page, rendering a net-total bar chart and a category-breakdown donut.

Source: `feature-plan-proposals.md` §4 ("Charts & trends"), which points at `bikelog_app`'s already-shipped trend-chart specs (`18-spending-mileage-trend-charts.md`, `28-restore-trend-charts-with-legend.md`, `30-fix-trend-chart-6-months.md`) as the proven reference for library choice and chart component usage — followed here, not re-derived from scratch, with two specific corrections carried forward from lessons that project already paid for (see below).

## Where this lives — a new segment, not a new tab or screen

`MonthlyTransactionPage.tsx` already merges Monthly and Weekly into one screen via an in-page segmented control (`TView = "monthly" | "weekly"`, spec 06 Decision 8) rather than giving each its own bottom tab. This is the same shape Bike Log used for its own trend chart — an additional pill inside an already-multi-tab screen (`Spending.tsx` gained a 4th "Trend" pill alongside Month/Year/Lifetime; `Mileage.tsx` gained a 5th "Trends" pill), not a new top-level destination. Following both precedents: this spec adds `"trend"` as a **third** value to `MonthlyTransactionPage.tsx`'s existing `TView` union and pill row, rather than a new bottom tab (the tab bar already has 4 visible tabs today, heading to 5 once `14-settings-profile-page.md` ships) or a new hidden route reached from Settings (that pattern is reserved for Budgets, per its own explicit "dedicated screen" requirement — Charts has no such requirement, so it defaults to the cheaper, already-proven "new segment" shape).

## Two lessons carried forward from Bike Log's trend-chart history, not re-learned here

Reading `bikelog_app`'s full trend-chart spec history (18 → 25 → 28 → 30) before designing this:
1. **The donut must ship with a legend from day one.** Bike Log shipped its donut with color-only slices, no legend; the user reported it as broken/unusable and it was removed entirely for a full spec cycle before being restored — fixed by adding a legend (swatch + name + amount + percentage per row). This spec's donut has a legend in its first version, not as a follow-up fix.
2. **Default the month window to something real, not a throwaway placeholder.** Bike Log hardcoded `?months=3` in its first spec and it took three more specs to notice the user actually wanted 6. Server spec 14 already defaults to `6` for this exact reason — this spec's fetch call doesn't override that default with something smaller.

## Goal

Let the user see their net income/expense trend over the last several months and a breakdown of last month's spending by category, without leaving the screen they already use for Monthly/Weekly totals.

## Scope

**In scope:**
- `TView` in `MonthlyTransactionPage.tsx` gains `"trend"`; the existing pill row gains a third "Trend" pill, same styling as the existing two.
- A new `TrendTab.tsx` component: a bar chart of **net total per month** (`income − expense`, colored `C.income`/`C.expense` per bar depending on sign) over the server's default 6-month window, and — below it — a donut of the latest month's expense category breakdown **with a legend** (swatch + category name + amount + percentage per row, one row per category).
- New dependency: `react-native-gifted-charts` + its peer `react-native-svg` (neither currently installed — confirmed via `package.json`).
- A `chartPalette: string[]` addition to `theme/colors.ts` (both `light` and `dark` `ColorScheme`s) — 5 colors, used only for the donut's per-category slice/legend colors, kept distinct from the app's existing `income`/`expense`/`accent` semantic tokens so a chart color is never confused with those meanings elsewhere in the UI.

**Explicitly out of scope:**
- **A window-size selector** (e.g. a "3mo / 6mo / 12mo" toggle) — this spec calls the endpoint with no `months` param, taking the server's `6`-month default as-is, same v1 scope Bike Log itself shipped (see server spec 14's own Scope).
- **A separate income-vs-expense grouped bar view.** The bar chart shows net total per month only; the current month's actual income/expense split is already visible one pill over, on the existing Monthly/Weekly segments — this new segment's job is specifically the trend over time, not a re-display of data the sibling segments already show.
- **Multi-month category trends** (e.g. "Food spending over 6 months") — matches server spec 14's own scope boundary; only the latest month gets a category breakdown.
- `History.tsx` (yearly view) — unchanged, this feature lives entirely inside `MonthlyTransactionPage.tsx`.
- Pinch-to-zoom, tap-a-bar-for-detail, or any other chart interactivity beyond what `react-native-gifted-charts` gives for free — a static, read-only view.

## Design

### New dependency

`npx expo install react-native-gifted-charts react-native-svg`, then `npx expo install --check` to confirm no version-pin mismatch against this app's own Expo SDK (`~54.0.32`, confirmed in `package.json`). **Don't assume Bike Log's exact `react-native-svg@15.12.1` pin carries over unchanged** — re-check at implementation time; the two apps can drift to different patch versions even on nominally the same SDK. No `app.json` plugin entry needed — `react-native-svg` autolinks with no native config, same as Bike Log's spec 18 found.

### `theme/colors.ts` — add `chartPalette`

```ts
export interface ColorScheme {
  // ...existing fields...
  chartPalette: string[];
}
```

```ts
// dark
chartPalette: ['#7c9eff', '#52d48a', '#f0b95c', '#c792ea', '#f07272'],
// light
chartPalette: ['#4a72d4', '#1fa861', '#c98a2e', '#8c5fc7', '#d94444'],
```

Distinct hues from `income`/`expense` (which stay reserved for their existing income/expense meaning) — a category slice being green must never be misread as "this is income."

### Types — `client/types/Transaction.tyes.ts`

```ts
export type TTrendMonth = { targetMonth: string; income: number; expense: number };
export type TCategoryBreakdownEntry = { categoryId: string | null; name: string; icon: string | null; income: number; expense: number };
export type TTrendSummary = { months: number; monthlySummary: TTrendMonth[]; categoryBreakdown: TCategoryBreakdownEntry[] };
```

### `TrendTab.tsx` — `client/components/main/MonthlyTransaction/TrendTab.tsx` (new)

```tsx
export default function TrendTab() {
  const C = useTheme();
  const { data, isLoading } = useFetchData<TTrendSummary>(
    ["trend-transaction"],
    "/transactions/trend-transaction",
  );

  const trend = data?.data;
  const monthlySummary = trend?.monthlySummary ?? [];
  const categoryBreakdown = trend?.categoryBreakdown ?? [];
  const breakdownTotal = categoryBreakdown.reduce((sum, c) => sum + c.expense, 0);

  const barData = monthlySummary.map((m) => {
    const net = m.income - m.expense;
    return {
      value: net,
      label: format(parse(m.targetMonth, "yyyy-MM", new Date()), "MMM"),
      frontColor: net >= 0 ? C.income : C.expense,
    };
  });

  const pieData = categoryBreakdown.map((c, i) => ({
    value: c.expense,
    text: c.name,
    color: C.chartPalette[i % C.chartPalette.length],
  }));

  if (isLoading) return <ChartSkeleton />; // or existing loading convention used elsewhere on this page

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={[styles.chartCard, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[text.label, { color: C.textSecondary }]}>Net total, last {trend?.months ?? 6} months</Text>
        <BarChart data={barData} barWidth={28} spacing={24} roundedTop roundedBottom yAxisThickness={0} xAxisThickness={0} />
      </View>

      {pieData.length > 0 ? (
        <View style={[styles.chartCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[text.label, { color: C.textSecondary }]}>Spending by category, last month</Text>
          <PieChart data={pieData} donut radius={90} innerRadius={60} />

          <View style={styles.legend}>
            {categoryBreakdown.map((c, i) => {
              const pct = breakdownTotal > 0 ? ((c.expense / breakdownTotal) * 100).toFixed(1) : "0.0";
              return (
                <View key={c.categoryId ?? "uncategorized"} style={styles.legendRow}>
                  <View style={[styles.swatch, { backgroundColor: C.chartPalette[i % C.chartPalette.length] }]} />
                  <Text style={[text.caption, { color: C.text, flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[text.caption, { color: C.textSecondary }]}>৳{fmt(c.expense)} ({pct}%)</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <EmptyState label="No spending last month to break down" />
      )}
    </ScrollView>
  );
}
```

**Bar coloring**: reuses `C.income`/`C.expense` — the same green/red semantic already used for every income/expense distinction elsewhere in this app (`TransactionCard`, `BudgetProgressBar` from spec 16) — a net-positive month is "good" (green), net-negative is "bad" (red), consistent with how those colors already read everywhere else, not a new color meaning introduced just for this chart.

**Donut/legend**: colors from the new `chartPalette` (not `income`/`expense`) since categories aren't inherently good/bad; the legend is a plain vertical list, one row per category (swatch, name, amount+percentage) — matches `CategoryBreakdown.tsx` (spec 13)'s already-established amount-display convention (`৳{fmt(n)}`) and avoids the wrapping/truncation problems a horizontal chip-style legend would hit with long category names at phone width (same reasoning Bike Log's spec 28 used to choose a vertical legend over a horizontal one).

**Zero-activity months**: `barData` is a plain `.map()` over the full `monthlySummary` array with no filter — a month the server returns as `{income: 0, expense: 0}` renders as a real zero-height bar, not a gap, matching server spec 14's own zero-fill guarantee.

### Wire into `MonthlyTransactionPage.tsx`

```ts
type TView = "monthly" | "weekly" | "trend";
```

Pill row: add a third entry to the existing `(["monthly", "weekly"] as TView[]).map(...)` array → `(["monthly", "weekly", "trend"] as TView[])`, with a label branch (`v === "monthly" ? "Monthly" : v === "weekly" ? "Weekly" : "Trend"`). Render switch gains `{view === "trend" && <TrendTab />}`. `TrendTab` needs no props from the parent — it fetches its own data independently, same self-contained shape as `CategoryBreakdown` (spec 13). No change to the existing monthly/weekly data-fetching (`useFetchData` calls gated on `enabled: view === "monthly"|"weekly"`) — the trend fetch is a third, independent `useFetchData` call inside `TrendTab` itself, not added to the parent's existing ones.

## Implementation notes

Files touched/added:
- `client/theme/colors.ts` (edit — add `chartPalette` to `ColorScheme` + both `light`/`dark` objects)
- `client/types/Transaction.tyes.ts` (edit — add `TTrendMonth`/`TCategoryBreakdownEntry`/`TTrendSummary`)
- `client/components/main/MonthlyTransaction/TrendTab.tsx` (new)
- `client/components/main/MonthlyTransaction/MonthlyTransaction.tsx` (edit — `TView` gains `"trend"`, pill row + render switch updated)

## Verify when done

- [ ] `yarn lint` / `npx tsc --noEmit` pass clean.
- [ ] A third "Trend" pill appears on the Monthly/Weekly page, styled identically to the existing two; tapping it shows the bar chart + donut.
- [ ] The bar chart shows 6 bars (the server's default window) with the most recent month last/rightmost.
- [ ] A month with `income: 0, expense: 0` renders as a visible zero-height bar in its correct chronological position, not a gap.
- [ ] A net-positive month's bar is green (`C.income`); a net-negative month's bar is red (`C.expense`).
- [ ] The donut renders **with a visible legend** — one row per category with a swatch, name, and `৳amount (pct%)` — confirmed before calling this done, not deferred (this is the exact gap that caused Bike Log's sibling feature to be reverted once).
- [ ] Each legend swatch's color visually matches its corresponding donut slice (both indexed off the same `chartPalette[i % chartPalette.length]` over the same array/order).
- [ ] With zero expense transactions last month, the donut area shows the "No spending last month to break down" empty state instead of a broken/empty chart.
- [ ] Switching between Monthly/Weekly/Trend pills doesn't re-fetch unrelated data — `TrendTab`'s own `useFetchData` only fires while `"trend"` is the active view (component only mounts when selected).
- [ ] `History.tsx` (yearly) is confirmed unchanged (diff review).
- [ ] *(Explicit caveat, matching this project's standing limitation)* If no physical device/simulator is available at implementation time, chart rendering (bar heights, donut segment proportions, legend layout at phone width) is code-reviewed against the installed library's documented props, not visually confirmed — same caveat noted throughout Bike Log's own trend-chart specs.
