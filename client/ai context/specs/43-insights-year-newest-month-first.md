# 43 — Insights › Year: order the month list newest-first

**Status**: ✅ Completed 2026-10-14 — one-line change, verified by typecheck, lint and execution. On-screen
verification carries the same caveat as specs 41/42 (no test session available this session).
**Scope**: one line plus its comment in `client/components/main/HistoryPage/HistoryPage.tsx`, and a
forward-reference in `specs/41`. No server change, no data-layer change, no new dependency.

Reverses the ordering decision in `specs/41-insights-year-full-month-list.md`. Everything else 41 did —
the January → latest-month range, the zero months kept but muted, the `hasYearActivity` empty-state gate
— stands unchanged.

## Request

> in history page, i m seeing all the data, but at first i want to see the latest month data then the
> rest, like october, then september, august, ... , february, january ..

---

## Goal

Order Insights → Year's month list **newest-first** — October, September, … February, January for the
current year — while keeping the full January → latest-month range spec 41 introduced.

---

## Design

**Descending by month number.** The rows, the range and the muted treatment of zero months are all
exactly as spec 41 left them; only the sort direction changes.

**This deliberately overrides spec 41's stated rationale.** That spec chose ascending so the list would
scan in the same direction as the 12-column chart directly above it (left-to-right, Jan → Dec), and
called the change away from the old newest-first order "intended, not a regression". The user has now
asked for newest-first explicitly, having seen both. A stated user preference outranks an internal
consistency argument, so 41's Design section gets a note pointing here rather than being left to
contradict the shipped behaviour.

The practical case for it is also good: the current month is the one looked at most, and newest-first
puts it at the top where no scrolling is needed, while January — the row most likely to be empty early
in a year — ends up at the bottom.

**Not re-adopting `.reverse()`.** The pre-41 code reversed the server's array in place of sorting it,
which left the order dependent on the payload arriving in ascending order. An explicit descending
comparator is the same cost and says what it means.

**The chart is untouched.** Its left-to-right Jan → Dec axis is a convention of its own and reversing it
was not asked for; the list and the chart simply read in opposite directions now.

---

## Implementation

In `client/components/main/HistoryPage/HistoryPage.tsx`, inside the `monthRows` memo spec 41 added,
flip the comparator:

```tsx
-      .sort((a, b) => a.month - b.month);
+      .sort((a, b) => b.month - a.month);
```

and update the memo's comment so it no longer claims the list reads in the chart's direction — it now
records the newest-first order and that spec 43 chose it.

Then add a line to `specs/41`'s Design section marking its "Order: ascending" rule as superseded by this
spec, so the two files don't disagree.

Nothing else changes: `monthRows` is consumed only by the `FlatList`'s `data` prop, `keyExtractor` is
`String(m.month)` (order-independent), and `ItemSeparatorComponent` is positional.

---

## Dependencies

None. No package, no native module, no new EAS build — a pure JS change that reloads over Expo Go and
over the existing APK's JS bundle.

---

## Implementation notes

The comparator flipped to `(a, b) => b.month - a.month`, and the `monthRows` comment was rewritten: it
no longer claims the list reads in the chart's direction, and it records that 43 chose newest-first and
why it sorts rather than reverses. `specs/41`'s "Order: ascending" rule now carries a superseded marker
pointing here, and the checklist item in 41 that asserted ascending is annotated — its row *count* is
still what 41 verified, only the direction moved.

Nothing else was touched. `monthRows` feeds only the `FlatList`'s `data`; `keyExtractor` is
`String(m.month)` and `ItemSeparatorComponent` is positional, so neither cares about order.

### Verified by execution

`npx tsc --noEmit` and `yarn lint` clean. The same harness convention as 41:

| Check | Result |
| --- | --- |
| Current year (2026), scattered activity | `Oct Sep Aug Jul Jun May Apr Mar Feb Jan` — 10 rows |
| Past year (2025), all months active | `Dec Nov Oct Sep Aug Jul Jun May Apr Mar Feb Jan` — 12 rows |
| Figures still belong to their own row | 0 mismatches between each row's income and that month's source row — the flip moves rows, not values |
| Spec 42's drill-in, per row | params top-to-bottom `10, 9, –, –, 6, –, –, 3, –, 1`: still 1-based, still the row's own month, still absent on muted rows |
| Zero months | present, muted, `No entries`, not tappable — unchanged by the flip |
| Dead year | 0 rows, empty card shown |
| Future months of the current year | absent |

The drill-in row is worth calling out: with the current month now at the top, a handoff bug would be easy
to miss, since the first row's target happens to match Activity's default. Each row still carries its own
`targetMonth`.

## Verify when done

- [x] `npx tsc --noEmit` clean.
- [x] `yarn lint` clean.
- [x] Current year (2026): the list runs **October at the top → January at the bottom**, 10 rows. — *by execution*
- [x] A past year (2025): **December → January**, 12 rows. — *by execution*
- [x] Still true after the flip: November and December of the current year are absent; zero months are
      present but muted, unsigned and not tappable; a year with no activity shows the empty card and no
      rows. — *by execution*
- [x] Each row still carries its own month's figures — the flip must not shift values between rows
      (a `.reverse()` on a stale-ordered payload could). — *0 mismatches by execution*
- [x] Drill-in still opens the month that was tapped (spec 42) — the first row now being the current
      month must not be the only one that lands correctly. — *per-row params checked by execution; the
      real tab is still unverified, per spec 42*
- [x] `specs/41`'s Design section no longer asserts ascending as the intended order.
- [x] Row in `progress-tracker.md`'s Spec status table.
