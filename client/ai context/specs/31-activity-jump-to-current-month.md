# 31 — Restore "jump to current month" on Activity

**Status**: Completed 2026-09-30
**Scope**: `client/components/main/MonthlyTransaction/MonthlyTransaction.tsx` only. No server change, no data-layer change, no new component.

## Request

User: "in activity page, i have the functionality to change the month. in my previous app, when i change
the month, then a button appears to jump to the current month. when i click that button then the month is
set to the current month. now in my current app, there should be this feature. add this feature and the
design have to be appropriate."

## What the previous version did

The feature is in git history, not lost to a rewrite. `bb6d33d` ("feat(monthly transaction):update the
month select section", 2026-03-25) added, below the chevron row:

```tsx
{selectedMonth !== currentMonth && (
  <TouchableOpacity style={styles.currentMonthButton} onPress={goToCurrentMonth}>
    <MaterialCommunityIcons name="calendar-today" size={12} color={COLORS.primary} />
    <Text style={styles.currentMonthText}>Current Month</Text>
  </TouchableOpacity>
)}
```

— a centred `#F3F4F6` pill, `borderRadius: 20`, 10pt label in `COLORS.primary`. It was dropped in the
`52e66cb` / `2b60c93` redesigns; `goToCurrentMonth` went with it, while `selectedMonth`,
`currentMonth` and `handleMonthChange` all survived.

That commit also made the month title itself a second, invisible tap target for the same action. **Not
restored** — with a visible pill it is redundant, and a title that silently navigates when tapped is a
surprise, not an affordance.

## Implementation

`goToCurrentMonth` is back as a one-liner (`() => setSelectedMonth(currentMonth)`), and the chevron row
is now wrapped in a `styles.monthNav` column that holds the row plus the conditional pill.

Design decisions, since the ask included "the design have to be appropriate":

| Decision | Why |
|---|---|
| Accent border + `accentDim` fill + `accentText` content | This is exactly `CategoryPicker`'s **active chip** treatment. Reusing it means the accent affordance looks identical everywhere in the app instead of introducing a fourth button style. |
| `Ionicons` `today-outline`, size 11 | Nocturne's split puts chrome on Ionicons and keeps MCI for category icons only, so the old `MaterialCommunityIcons calendar-today` could not come back as-is. Glyph name confirmed present in the installed glyphmap. |
| Label "This month", not "Current Month" | Matches the screen's existing voice — the weekly view's header is "This week", the empty state is "No entries this month". |
| `height: 22`, `text.captionMd`, `spacing.sm` padding | Shipped at 28/`bodySm`/`spacing.md` first; the user asked for it smaller in the same session, so it went to 22pt with a 12pt medium label. Ends up close to the old app's 10pt/6pt-padding pill. `captionMd` not `caption` — medium weight is what still reads as a button at that size. Well below `CategoryPicker`'s 34, which is right: the `h3` month title stays the anchor of the block. |
| `hitSlop` of 10 on all sides | 22pt is far under `spacing.hitTarget` (44). `hitSlop` restores a comfortable touch area without inflating the visual. |
| Below the row, centred — not inline beside a chevron | The row is `justifyContent: "center"`; hanging a pill off one end pushes the month title off-centre. |
| `marginBottom` moved from `monthSelectorContainer` to the new `monthNav` wrapper | Otherwise the pill would be separated from the selector by the block's outer margin and read as belonging to the net card below it. |
| Rendered only when `selectedMonth !== currentMonth` | What the user described ("a button appears"). Costs a small downward shift of the content below on reveal — the previous version behaved the same way, and the alternative is permanently reserved dead space on the month you are on most of the time. |

Comparing months alone, with no year in the condition, is correct here: there is no year navigation on
this screen. `currentYear` is display-only and every fetch is `?targetMonth=<1-12>`.

The pill lives inside the `view === "monthly"` branch, so the Week view — which has no month nav — is
untouched.

## Verify when done

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` clean
- [x] `today-outline` confirmed in the installed Ionicons glyphmap
- [ ] **On a device**: on Activity → Month, the pill is absent on the current month
- [ ] **On a device**: step back a month → pill appears → tap → title returns to the current month and the pill disappears
- [ ] **On a device**: the monthly data, `avg expense/day` and "Spent on" all refetch for the jumped-to month (the query key includes `selectedMonth`, so this should follow for free)
- [ ] **On a device**: the category filter resets on the jump — the existing `useEffect` on `[view, selectedMonth]` should already cover it (spec 13's rule)
- [ ] **Visual, light mode**: `accentDim` `#e7e5fe` on `background` `#eef0f9` is a low-contrast fill; confirm the pill still reads as a button there and not as a flat label (it has the `C.accent` border, which is what carries it)

## Adjacent things noticed, deliberately not changed

- The next-month chevron is only disabled at December, so you can page into future months of the current
  year and get empty results. Arguably it should clamp at `currentMonth`, but that is a behavior change
  the user did not ask for — and it is also part of why a jump-back button is useful.
- Both `startMonth`/`endMonth` hardcode the calendar year, so there is no way to reach last December.
  Pre-existing, out of scope.
