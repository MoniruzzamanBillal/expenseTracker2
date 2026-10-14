# 42 — Insights › Year month rows drill in to the month you tapped

**Status**: ✅ Completed 2026-10-14 — both steps implemented; the param handoff verified end-to-end in a
headless browser against throwaway probe routes. On-screen verification on the real Activity tab is
still open (it is behind `AuthGuard` and this session had no test credentials).
**Scope**: `client/components/main/HistoryPage/HistoryPage.tsx` and
`client/components/main/MonthlyTransaction/MonthlyTransaction.tsx`. No server change, no data-layer
change, no new route file, no new dependency.

Follow-up to `specs/41-insights-year-full-month-list.md`, which flagged this as decision **(c)**: ship
41 unchanged, then fix the drill-in in its own spec. It is also logged in `progress-tracker.md`'s Known
Gaps.

## Reported symptom

Raised in this session's spec-41 summary and confirmed by the user ("fix this"): tapping a month row on
Insights → Year opens Activity on the **current** month, not the month that was tapped.

---

## Goal

Make a month row on Insights → Year open Activity on **that month's** daily breakdown, by passing the
tapped month through the route and having Activity adopt it on arrival.

---

## Diagnosis

The push carries no destination month:

```tsx
onPress={() => tappable && router.push({ pathname: "/monthlyTransactions" })}
```

and `MonthlyTransaction.tsx:87` owns its month entirely:

```tsx
const currentMonth = new Date().getMonth() + 1;
const [selectedMonth, setSelectedMonth] = useState(currentMonth);
```

It reads no route params — there is no `useLocalSearchParams` call anywhere in the app today — so every
row lands on the current month. Pre-existing, and not a 41 regression: with 5 newest-first rows the top
row *was* the current month and the error was easy to miss. With January → October it is wrong on 9 rows
out of 10.

Two facts shape the fix:

1. **The two screens count months differently.** `yearSummary[].month` is **0-based** (the server builds
   it with `getUTCMonth()`, and `MONTHS[m.month]` indexes 0-based). Activity's `selectedMonth` is
   **1-based** (`getMonth() + 1`, `startMonth = 1`, `endMonth = 12`) because that is what the API's
   `?targetMonth=` expects. The handoff has to add one.
2. **Activity stays mounted.** It is a tab screen, and React Navigation keeps a tab mounted once
   visited, so `useState(currentMonth)` runs at most once per app launch. A `useState` initialiser
   reading the param would therefore apply the *first* drill-in of a session and silently ignore every
   one after it. The param has to be adopted in an effect.

---

## Scope

**In:**

- `targetMonth` on the push from Insights' month rows, 1-based.
- Activity reads, validates, adopts and then **clears** it.
- Arriving with a target month forces the Monthly segment, so the month is actually visible.

**Out:**

- A year param. Insights only makes rows tappable for the current year (`canDrillIn`), and Activity has
  no year navigation at all, so there is no second year to disambiguate. If year navigation ever reaches
  Activity, this handoff needs `targetYear` alongside `targetMonth`.
- Everything else on both screens: the chart, the net cards, the segment controls, the "This month"
  pill, the category filter, the Weekly view.
- `startMonth`/`endMonth` hardcoding the calendar year, and the next-chevron allowing future months —
  both pre-existing, both explicitly left alone by `specs/31`.
- Anything in `known-issues.md`.

---

## Design

No visual change on either screen. No new colour, token, component or icon — this is a navigation fix,
and the rows already look tappable (`specs/41` gave non-tappable rows no chevron).

**Route params, not a module-level bridge.** Params are expo-router's own mechanism, `app.json`'s
`experiments.typedRoutes` already types `/monthlyTransactions` as accepting
`params?: Router.UnknownInputParams` (no route file is added, so nothing needs regenerating), and the
destination is a real, linkable state of the screen. The alternative — a one-shot module global like
`utils/authEvents.ts` — is the right tool for a logout signal that has no URL, and the wrong one for
"show me this month".

**The param is named `targetMonth` and is 1-based**, matching the `?targetMonth=` query param Activity
already sends to `/transactions/monthly-transaction`. One name, one base, for the same number across the
route and the API.

**Adopt in an effect, then clear the param.** Clearing is not hygiene, it is correctness:

- Without it, **the same month can only be opened once.** Drill into March, page to May inside Activity,
  go back to Insights, tap March again — the param is still `"3"`, the effect's dependency never
  changes, so nothing happens and the user is left looking at May.
- A stale param would also re-apply itself if the tab ever did remount (app reload, memory pressure),
  yanking the user to a month they tapped some time ago.

Clearing is a write of `""` rather than `undefined`: expo-router's `setParams` takes strings, and `""`
both reads as "no target" and is the dependency change that lets the next identical push be seen. The
effect re-runs once on the cleared value and returns early — no loop.

**Arriving sets the Monthly segment.** If the user last left Activity on Weekly, adopting a month
without switching segments would show a week and hide the thing they asked for. `setView("monthly")`
only on arrival; it is not touched otherwise.

**A bad param is ignored, not clamped.** `?targetMonth=abc`, `0`, `99` or a float leaves the screen on
whatever month it was already showing. Clamping would invent a month the user never asked for; ignoring
is the conservative read, and this is a hand-editable URL on the web target.

**The category filter resets for free.** Activity's existing `useEffect` on `[view, selectedMonth]`
clears `selectedCategoryKey` (spec 13's rule), and both of those change on arrival.

---

## Implementation

### Step 1 — pass the month from Insights

`client/components/main/HistoryPage/HistoryPage.tsx`, in `renderItem`'s `onPress`:

```tsx
onPress={() =>
  tappable &&
  router.push({
    pathname: "/monthlyTransactions",
    // Spec 42: `yearSummary[].month` is 0-based; Activity's month and the API's
    // `?targetMonth=` are both 1-based.
    params: { targetMonth: String((m?.month ?? 0) + 1) },
  })
}
```

Nothing else in the file changes. `tappable` already excludes zero-activity rows and non-current years.

### Step 2 — adopt the param in Activity

`client/components/main/MonthlyTransaction/MonthlyTransaction.tsx`.

Import `useLocalSearchParams` and `useRouter` from `expo-router` (the file imports neither today):

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
```

Inside the component, after `selectedMonth`'s `useState`:

```tsx
const router = useRouter();
const { targetMonth } = useLocalSearchParams<{ targetMonth?: string }>();

// Spec 42: a month row on Insights pushes `?targetMonth=<1-12>`. This runs in an effect, not
// in `useState`'s initialiser, because this screen is a tab and stays mounted — an
// initialiser would adopt the first drill-in of a session and ignore every later one. The
// param is cleared once adopted so the same month can be opened again (an unchanged
// dependency would make the second tap a no-op) and so a stale value can't re-apply itself
// if the tab ever remounts.
useEffect(() => {
  if (!targetMonth) return;
  const month = Number(targetMonth);
  if (Number.isInteger(month) && month >= startMonth && month <= endMonth) {
    setSelectedMonth(month);
    // Landing on Weekly would hide the month that was just asked for.
    setView("monthly");
  }
  router.setParams({ targetMonth: "" });
}, [targetMonth, router]);
```

Place it above the existing `useEffect` that resets `selectedCategoryKey`, so the file reads
arrive → derive. Do not fold the two together: that one keys off `[view, selectedMonth]` and must keep
firing for ordinary in-screen month changes.

### Step 3 — verify the mechanism, not just the types

The Activity tab sits behind `AuthGuard` inside `(tabs)`, and this session has no test credentials, so
the real screen can't be reached headlessly. The *mechanism* can: two throwaway top-level routes (which
`AuthGuard` does not cover — it is mounted only inside `(tabs)`, `known-issues.md#AUTH-1`) driven on the
web target, asserting the four behaviours the design above depends on:

1. a push with `params` arrives as `useLocalSearchParams`
2. the effect adopts it
3. `router.setParams({ targetMonth: "" })` actually clears it
4. pushing the **same** value again after the clear is seen a second time

Delete both probe files afterwards and re-run `tsc`/`lint` on the clean tree.

---

## Dependencies

None to install. `expo-router` 6.0.22 (already a dependency) supplies `useLocalSearchParams`,
`useRouter` and `setParams`. No new route file, so `experiments.typedRoutes` needs no regeneration —
`.expo/types/router.d.ts` already types `/monthlyTransactions` with
`params?: Router.UnknownInputParams`.

---

## Implementation notes

Both steps landed as written; no deviation, and nothing outside the two files changed.

- **Step 1** — `HistoryPage.tsx`'s row `onPress` now pushes
  `params: { targetMonth: String((m?.month ?? 0) + 1) }`.
- **Step 2** — `MonthlyTransaction.tsx` gained a single `expo-router` import
  (`useLocalSearchParams`, `useRouter`) and the adopt-and-clear effect, placed directly above the
  existing `selectedCategoryKey` reset so the file reads arrive → derive.

`npx tsc --noEmit` and `yarn lint` are clean. Typed routes needed no regeneration, as predicted — no
route file was added, and `.expo/types/router.d.ts` already types `/monthlyTransactions` with
`params?: Router.UnknownInputParams`.

### Step 3: what the probe proved

Two throwaway top-level routes (`app/zz-probe-a.tsx`, `app/zz-probe-b.tsx` — outside `(tabs)`, so
`AuthGuard` doesn't cover them) mirrored the effect verbatim and were driven on the web target with
Playwright. Both files were deleted afterwards and `tsc`/`lint` re-run on the clean tree.

| Case | Result |
| --- | --- |
| Push with `params: { targetMonth: "3" }` | arrives as `useLocalSearchParams`, adopted (`month=3`, `view=monthly`), param cleared to `""` |
| In-screen change to 5, then **the same `"3"` re-sent while still mounted** | `month=3` again, `adoptions=2`; a third time gives `adoptions=3` |
| Out-of-range `"99"` | ignored — month and view untouched, `adoptions=0`, param still cleared |
| Hand-typed `?targetMonth=abc` on a cold load | ignored, month untouched |
| Hand-typed `?targetMonth=7` on a cold load | adopted |
| Console/page errors throughout | none |

The second row is the one that matters: it is the exact scenario the param clear exists for, and it was
checked **on a single mount**, because an A→B→A→B round trip on the web target remounts the destination
and would have passed for the wrong reason (a fresh `useState` plus a first adopt, rather than the effect
genuinely re-firing).

### One honest wrinkle: `setParams` doesn't clear on a cold URL load

On an in-app push — the only path the app itself uses — `router.setParams({ targetMonth: "" })` clears
the param, confirmed in cases 1–3. On a **cold page load** of `/monthlyTransactions?targetMonth=7` on
the web target, the value is adopted correctly but the param stays in the URL: the effect's `setParams`
runs before the router has settled and is a no-op. Deliberately not worked around — the consequence is
that reloading such a URL re-adopts the month, which is the right behaviour for a linkable address, and
the lingering param changes nothing otherwise (an unchanged dependency can't re-fire the effect).

### What is still unverified

The **real Activity tab**. It sits behind `AuthGuard` inside `(tabs)`, and this session had no test
credentials, so the drill-in could not be exercised on the actual screens. The probe verifies
expo-router's param delivery, the adopt, the clear and the repeat; it does not verify that a tab-to-tab
`router.push` with params behaves the same as the top-level push it stood in for, nor the react-navigation
tab-retention assumption the effect-over-initialiser decision rests on. Both are the standard behaviour
of these libraries, but neither was observed here.

Note also that verifying this properly needs **back-dated data**: a transaction created today lands in
the current month, so a fresh account has no past month to drill into — only the current-month row would
be tappable at all (`specs/41` makes zero-activity rows inert). A real check wants a local server plus
seeded rows in an earlier month of this year.

## Verify when done

- [x] `npx tsc --noEmit` clean.
- [x] `yarn lint` clean (no new output for either file).
- [x] Probe (Step 3): a pushed param arrives, is adopted, is cleared by `setParams`, and the same value
      pushed again is seen a second time — the repeat checked on a single mount, `adoptions` reaching 3.
- [x] Probe files deleted; `git status` shows only the two intended files plus docs.
- [ ] **Needs a logged-in session** — Insights → Year → tap **March**: Activity opens on March, with
      March's daily breakdown, `avg expense/day` and category breakdown.
- [ ] **Needs a logged-in session** — the "This month" pill appears after drilling into a past month,
      and returns to the current month when tapped (spec 31 behaviour, unchanged).
- [ ] **Needs a logged-in session** — drill into March, page to May inside Activity, return to Insights
      and tap March again: Activity shows **March**, not May. (This is the one the param clear exists
      for.)
- [ ] **Needs a logged-in session** — leave Activity on the **Weekly** segment, then drill in from
      Insights: it switches to Monthly on the tapped month.
- [ ] **Needs a logged-in session** — the category filter is reset on arrival, not carried over from the
      previously viewed month.
- [ ] **Needs a logged-in session** — tapping the current-month row still opens the current month, and
      zero-activity rows are still not tappable (spec 41).
- [x] **Web target only** — `/monthlyTransactions?targetMonth=abc`, `?targetMonth=0` and
      `?targetMonth=99` are ignored and leave the month as-is — verified on the probe (`abc`, `99`).
- [x] Row in `progress-tracker.md`'s Spec status table, and the Known Gaps entry for this bug closed.
