# 41 — Insights › Year: list every month from January to the latest, not the last 5

**Status**: ✅ Completed 2026-10-14 — all 5 steps implemented; verified by typecheck, lint, and
execution of the derived logic against representative payloads. On-screen verification of the list
itself is still open (see Implementation notes).
**Scope**: `client/components/main/HistoryPage/HistoryPage.tsx` only. No server change, no data-layer
change, no new dependency.

## Reported symptom

User, on the Insights → Year tab's month list:

> in this section, i see only 5 months income and expenses .. but i should see the data starting from
> january to latest month. I want to see data from january to the latest month.

---

## Goal

Make the Year tab's month list show a continuous run of months from **January through the latest month
that can hold data** for the selected year — this month for the current year, December for a past year —
instead of the newest 5 active months, so the list matches the 12-column chart sitting directly above it.

---

## Diagnosis (why only 5 rows)

The data is already complete. `getYearlyTransaction` in
`server/src/app/modules/transaction/transaction.service.ts` seeds `monthlySummary[0..11]` with
`{ income: 0, expense: 0, transactionCount: 0 }` **before** folding transactions in, so
`yearSummary` is always 12 rows for any year, every one of them present whether or not it had activity.

Both losses happen in `HistoryPage.tsx`:

```tsx
// ~line 128 — drops every month with no activity, then flips to newest-first
const recentMonths = useMemo(
  () =>
    [...yearSummary]
      .filter((m) => m?.income > 0 || m?.expense > 0 || m?.transactionCount > 0)
      .reverse(),
  [yearSummary],
);

// ~line 206 — and then keeps only the first five of those
data={showErrorCard ? [] : yearSummary.length ? recentMonths.slice(0, 5) : []}
```

`.slice(0, 5)` is the cap the user is hitting. `.reverse()` is why the five they do see are the newest
ones rather than January onward. The `.filter(...)` is a third, quieter loss: a January with no entries
would be missing from the list even with the cap lifted, which is exactly the range the user is asking
for.

Two consequences of this that the fix has to carry:

1. **The chart and the list disagree today.** The chart maps `yearSummary` directly — all 12 columns,
   drawing future months of the current year as a 2pt stub (`isFuture`). The list shows up to 5
   newest-first. After this change both read the same year in the same direction.
2. **The existing empty state is unreachable, and this change makes that matter.** The
   `Nothing logged in {selectedYear}` `EmptyState` is gated on `yearSummary.length === 0`, which the
   server never returns. Today that's harmless because `recentMonths`'s filter leaves an empty list for
   a dead year. Once zero months are kept, a year with no activity would render ten "No entries" rows
   and still no empty state. The gate has to move to `hasYearActivity`, which already exists on line
   ~118.

---

## Scope

**In:**

- Replace `recentMonths` with a January→latest range, ascending, including zero-activity months.
- Remove the `.slice(0, 5)` cap.
- Re-gate the `EmptyState` on `hasYearActivity` so a dead year still shows the empty card instead of a
  column of zero rows.
- A muted treatment for a zero-activity row, so the new rows read as "nothing here" and not as data.

**Out:**

- The chart, the net card, the year navigator, the Trend segment — untouched.
- The drill-in target bug (see **Known adjacent bug** below). Flagged, not fixed here.
- Anything in `known-issues.md`. Per `ai-workflow-rules.md`, nothing from that backlog gets fixed as a
  side effect of this.

---

## Design

Visual rules come from `theme/` as always — `useTheme()` for colour, `text.*` for type, `spacing.*` for
layout. No new tokens, no literals.

**Order: ascending, January at the top.** ⚠️ **Superseded by
[`specs/43-insights-year-newest-month-first.md`](43-insights-year-newest-month-first.md)
(2026-10-14)** — the user asked for newest-first (October → January) after seeing this shipped, so the
list now runs descending. The rest of this spec stands; only the sort direction changed. The reasoning
below is kept because it is why the order flipped in the first place. The user's phrasing ("starting from january to the latest
month") is a reading order, and it makes the list scan in the same direction as the chart's left-to-right
axis directly above it. This reverses today's newest-first order — that is intended, not a regression.

**Range end.** For `selectedYear === currentYear`, stop at `currentMonth` (the module-level
`new Date().getMonth()`, 0-based) — the same boundary the chart's `isFuture` check already uses, so
November and December of the current year don't appear as empty rows. For a past year, all 12.

**Zero-activity months stay in the list, visibly inert.** Keeping them is what makes the range
continuous and literally "January to the latest month". To stop them reading as real data:

| Element     | Active month                     | Zero month                     |
| ----------- | -------------------------------- | ------------------------------ |
| Month label | `C.text`                         | `C.textMuted`                  |
| Count line  | `{n} entries`, `C.textSecondary` | `No entries`, `C.textMuted`    |
| In/out line | `+{in}` `−{out}`, income/expense | not rendered                   |
| Net figure  | `C.income` / `C.expense`         | `৳0` in `C.textMuted`, no sign |
| Chevron     | shown when `canDrillIn`          | never shown                    |
| Row press   | enabled when `canDrillIn`        | disabled                       |

`1 entries` is wrong grammar the current code already ships; this spec leaves singular/plural as-is
rather than widening scope. Say so in the implementation notes if it gets fixed anyway.

**Row height.** A zero row drops the in/out line, so it is shorter than an active row. That is
acceptable — a `FlatList` with no `getItemLayout` here and ~12 rows has no perf stake in fixed heights.
If the ragged rhythm looks wrong on device, render the in/out line for zero months too in `C.textMuted`
rather than reintroducing a fixed height.

---

## Implementation

All steps are in `client/components/main/HistoryPage/HistoryPage.tsx`.

### Step 1 — replace `recentMonths` with `monthRows`

Delete the `recentMonths` `useMemo` (~line 128) and put this in its place, next to the other derived
memos so it sits above the first `return`:

```tsx
// Spec 41: January → the latest month that can hold data, ascending. Zero months are kept so the
// list is a continuous range and reads in the same direction as the chart above it; future months of
// the current year are cut at the same boundary the chart's `isFuture` stub uses. The server
// zero-fills all 12 months, so this is a window on complete data, never a gap-filling pass.
const monthRows = useMemo(() => {
  const lastMonth = selectedYear === currentYear ? currentMonth : 11;
  return yearSummary
    .filter(
      (m) =>
        typeof m?.month === "number" && m.month >= 0 && m.month <= lastMonth,
    )
    .sort((a, b) => a.month - b.month);
}, [yearSummary, selectedYear]);
```

Notes on the details, so they don't get "simplified" away later:

- The `typeof m?.month === "number"` guard is not defensive noise — `MONTHS[m?.month]` and
  `MONTHS[m?.month].slice(0, 3)` in `renderItem` throw on `undefined`, and the old `.filter()` happened
  to screen malformed rows out. Keep an explicit guard now that the filter is gone.
- `.sort()` is on a fresh array from `.filter()`, so it never mutates the query cache's object — don't
  drop the `.filter()` and sort `yearSummary` in place.
- The explicit sort is cheap insurance. `Object.entries` over integer-like keys is ascending today, so
  the payload already arrives in order; the sort means a differently-ordered or hand-written cached
  payload can't scramble the list.
- `currentMonth` and `currentYear` are the existing module-level constants (~line 63). Don't add new
  `new Date()` calls.

### Step 2 — feed the list the whole range

Replace the `data` prop (~line 206):

```tsx
data={showErrorCard || !hasYearActivity ? [] : monthRows}
```

This does three things at once: drops `.slice(0, 5)`, drops the now-redundant `yearSummary.length` test
(`monthRows` is already empty when `yearSummary` is), and makes a dead year render no rows so the empty
state in Step 4 is the only thing shown.

### Step 3 — the zero-month row treatment in `renderItem`

Inside `renderItem` (~line 215), derive the flag first and apply the table from the Design section:

```tsx
renderItem={({ item: m }) => {
  const mNet = (m?.income ?? 0) - (m?.expense ?? 0);
  const isPositive = mNet >= 0;
  // Spec 41: the list now spans the whole year, so most rows in an early-in-the-year view are
  // zero. Mute them so the range reads as a range and the months with data still stand out.
  const isEmptyMonth =
    (m?.income ?? 0) === 0 && (m?.expense ?? 0) === 0 && (m?.transactionCount ?? 0) === 0;
  const tappable = canDrillIn && !isEmptyMonth;
  const barColor = isEmptyMonth ? C.textMuted : isPositive ? C.income : C.expense;
  // ...
}}
```

Then in the JSX:

- `disabled={!tappable}`, `activeOpacity={tappable ? 0.7 : 1}`, and the `onPress` guard becomes
  `tappable && router.push(...)`.
- Month label colour: `isEmptyMonth ? C.textMuted : C.text`.
- Count line: `isEmptyMonth ? "No entries" : \`${m?.transactionCount} entries\``, colour
`isEmptyMonth ? C.textMuted : C.textSecondary`.
- Wrap the in/out `<Text>` in `{!isEmptyMonth ? ( ... ) : null}`.
- Net figure: when `isEmptyMonth`, render `৳0` with no `+`/`−` sign, in `barColor`.
- Chevron: the condition becomes `tappable ? <Ionicons .../> : null`.

### Step 4 — re-gate the empty state

Change the `EmptyState` condition (~line 395) from `yearSummary.length === 0` to `!hasYearActivity`:

```tsx
{
  !isPending && !showErrorCard && !hasYearActivity ? (
    <EmptyState
      title={`Nothing logged in ${selectedYear}`}
      subtitle="Totals appear here once a year has entries. Step forward to this year."
      icon="stats-chart-outline"
    />
  ) : null;
}
```

`hasYearActivity` is the same flag that already gates the chart card, so a dead year now shows exactly
one thing — the empty card — with no chart and no rows. `yearSummary.length === 0` was unreachable
against this server.

### Step 5 — tidy

- Confirm `recentMonths` has no other reference (`grep -n recentMonths` in the file — it should only
  ever have been the `data` prop).
- Leave the `divider`'s `marginLeft: 60` alone; it still lines up under the 40pt month label plus gap.
- Leave the uncommitted Prettier-only churn already in the working tree (the `formatAmount` import
  reorder and two rewraps) as-is; don't revert it and don't expand on it.

---

## Known adjacent bug (flagged, not in scope)

Every row's drill-in pushes `/monthlyTransactions` with **no parameters**:

```tsx
onPress={() => canDrillIn && router.push({ pathname: "/monthlyTransactions" })}
```

`MonthlyTransaction.tsx:87` initialises its own `useState(currentMonth)` and reads no route params, so
tapping _any_ month lands on the **current** month. With a 5-row newest-first list that's easy to miss;
with Jan→October it is 9 rows out of 10 going to the wrong month, and it will look like this spec broke
something.

Fixing it means passing a param and having Activity read it, with one trap worth writing down:
**Activity's month is 1-based** (`new Date().getMonth() + 1`, `startMonth = 1`, `endMonth = 12`) while
`yearSummary[].month` here is **0-based** (`getUTCMonth()`, and `MONTHS[m.month]` indexes 0-based). A
param has to be `m.month + 1` on the way out.

That is its own spec. Decide before implementing this one:

- **(a)** Ship this spec as-is and leave the drill-in wrong — smallest change, but a visible wrong
  behaviour on more rows than before.
- **(b)** Ship this spec and make the rows non-tappable (drop `canDrillIn` here), so nothing navigates
  to the wrong place while the real fix is scoped.
- **(c)** Scope a spec 42 for `?targetMonth=` on `/monthlyTransactions` and do it right after this.

Recommendation: **(c)**, with this spec shipping first and unchanged. The two changes are independent,
and (b) removes a working affordance for the current month to protect against a bug that spec 42 closes.

---

## Dependencies

None. No package to install, no native module, so no new EAS build — this is a pure JS/TSX change that
reloads over Expo Go and over the existing APK's JS bundle.

Already present and used unchanged: `theme/` (`useTheme`, `text`, `spacing`, `radius`, `elevation`),
`@expo/vector-icons`' `Ionicons`, `utils/formatAmount`'s `formatTotal`/`formatCompact`,
`hooks/useApi`'s `useFetchData`, `components/main/shared/EmptyState`.

---

## Implementation notes

All 5 steps landed in `client/components/main/HistoryPage/HistoryPage.tsx` exactly as written above; no
step deviated from the plan, and nothing outside that file changed.

- **Step 1** — `recentMonths` → `monthRows`, with the `typeof`/range filter and the explicit ascending
  sort. The comment block above it records why the guard and the sort are there.
- **Step 2** — `data={showErrorCard || !hasYearActivity ? [] : monthRows}`.
- **Step 3** — `isEmptyMonth`/`tappable` derived in `renderItem`, with the muted treatment from the
  Design table applied to the label, the count line, the in/out line, the net figure and the chevron.
- **Step 4** — the `EmptyState` gate moved from `yearSummary.length === 0` to `!hasYearActivity`.
- **Step 5** — `recentMonths` and `slice(0, 5)` both grep clean; `divider`'s `marginLeft: 60` left alone;
  the pre-existing Prettier-only churn in the working tree kept as-is.

**`1 entries` was left alone**, as the Design section said to — singular/plural is still wrong for a
one-entry month, and is still out of scope here.

**Two long lines were hand-wrapped** to the file's effective 80-column code width (the count line and the
net line in `renderItem`). The client has no Prettier dependency or config of its own — formatting here
comes from the editor — so this is cosmetic, and only done so a later editor save doesn't churn the
diff. Comments over 80 columns were left long, matching the rest of the file.

### A suspected bug that turned out not to be one

The verification harness printed a negative month's net as `--500`, which looked like a double sign from
`${isPositive ? "+" : "−"}৳${fmt(mNet)}`. It is not: `formatTotal` runs through `group()`, which is
`Math.abs`-based, so `fmt(-500)` is `"500.00"` and the row renders `−৳500.00`. The harness was printing
raw numbers rather than calling `fmt`. No code change, and no follow-up spec needed.

### What was actually verified, and how

`npx tsc --noEmit` clean, `yarn lint` clean (no new output for this file). The behavioural checks were
done by **executing the changed logic** against representative payloads — the same
reproduce-by-execution convention spec 33 used on this screen's chart:

| Payload | Result |
| --- | --- |
| Current year, activity in Jun–Oct only | old list `Oct Sep Aug Jul Jun` (5 rows) → new list `Jan`…`Oct` (10 rows, ascending); Nov/Dec absent; Jan–May muted with `No entries`, `৳0`, no in/out line, no chevron, not tappable |
| Current year, activity in **January only** | old list `Jan` alone → new list `Jan`…`Oct`, which is the literal ask |
| Past year (2025), all 12 months active | 12 rows `Jan`…`Dec`, zero chevrons (`canDrillIn` false off the current year) |
| A year with no activity | `hasYearActivity` false → 0 rows rendered and the `Nothing logged in {year}` card shown |
| Malformed + unordered rows (`month` missing/`undefined`) | dropped by the guard, survivors sorted ascending, `MONTHS[m.month]` never `undefined`, and the source array left unmutated |

The web target also bundles and boots clean headlessly (2156 modules, no page errors) — which rules out
a module-eval or bundling break, but stops at the login screen.

**Still open: on-screen verification.** Reaching Insights needs a logged-in session, and this session had
no test credentials; `utils/envConfig.ts` points at the deployed server, whose data belongs to the user.
The visual items left unticked below are the ones that need a real session — a device or a browser login.

### The drill-in bug: decision (c)

Option **(c)** from the section above. This spec shipped unchanged, and the wrong-month drill-in is
**still present and now more visible** — every active row pushes `/monthlyTransactions` with no params
and lands on the current month. It wants its own spec (`?targetMonth=`, remembering Activity's month is
1-based while `yearSummary[].month` is 0-based). Not opened here.

## Verify when done

Run from `client/`. The client's `utils/envConfig.ts` `baseURL` is toggled by hand — check what it
points at before blaming data.

- [x] `npx tsc --noEmit` is clean.
- [x] `yarn lint` shows nothing new for `HistoryPage.tsx` against the pre-change output.
- [x] `grep -n "slice(0, 5)\|recentMonths" components/main/HistoryPage/HistoryPage.tsx` returns nothing.
- [x] Insights → Year, current year (2026): the list runs **January at the top through October at the
      bottom** — 10 rows, ascending. Not 5, not newest-first. — *by execution; not yet seen on screen.*
      *Ordering since reversed by `specs/43` — the range (10 rows, Jan–Oct) is unchanged.*
- [x] November and December 2026 are **absent** from the list (matching the chart's stubbed future
      columns). — *by execution*
- [x] A month with no entries renders `No entries`, a muted `৳0` with no `+`/`−`, no in/out line, and
      no chevron; tapping it does nothing. — *by execution; colours are tokens, not yet seen on screen*
- [ ] *(needs a logged-in session)* A month with entries is unchanged from before: `{n} entries`, the green/red in/out line, a signed
      net, and a chevron that navigates.
- [x] Step back to a past year with data (2025): the list runs January through **December** — all 12
      rows — and no row shows a chevron (`canDrillIn` is false off the current year). — *by execution*
- [x] Step back to a year with no data at all: the `Nothing logged in {year}` empty card shows, with
      **no** chart card and **no** zero rows beneath it. — *gate verified by execution*
- [ ] *(needs a logged-in session)* The net card, the Income vs expense chart (bars, y-axis ticks, gridlines, highlighted current
      month) and the Year/Trend segment control are visually identical to before.
- [ ] *(needs a logged-in session)* Pull-to-refresh still refetches, and the row list repopulates in the same order afterwards.
- [ ] *(needs a logged-in session)* Offline/error paths unchanged: kill the network and reload — the cached year still lists its
      months with the `OfflineNotice` above them (spec 37 behaviour); with no cache, the
      `Couldn't load {year}` card shows and the list is empty.
- [ ] *(needs a logged-in session)* Both themes: switch Dark/Light in Settings (`useThemePreference`) and confirm the muted zero rows
      are legible but clearly recessive in each.
- [x] Add a row to `progress-tracker.md`'s Spec status table for this spec, and note in it whether the
      drill-in decision went (a), (b) or (c). — added; decision **(c)**
