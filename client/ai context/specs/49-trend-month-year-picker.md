# 49 — Insights › Trend: month + year picker

## Why

User-reported follow-up to spec 47. TrendTab's arrow stepper can only move the
month **within the current year**. The user wants to tap the month name and
pick a month **and year**, while keeping the arrows working as they do now.

## Change

- New shared `MonthYearPickerSheet.tsx` (in `MonthlyTransaction/`): a `Sheet`
  with a year stepper (`‹ 2025 ›`, capped forward at the current year, back
  `minYear`, default current − 10) and a 3-column month grid. Future months of
  the current year are disabled (can't hold data). Active month/year uses the
  accent chip treatment (`accentDim`/`accentBorder`/`accentText`), matching
  CategoryPicker and the Activity "This month" pill. A local `viewYear` seeds
  from the selected year on each open and commits only when a month is tapped.
- `TrendTab` gains `selectedYear` state (default current year) and `pickerOpen`.
  - The month name is now a `TouchableOpacity` with a `chevron-down`; tapping it
    opens the sheet.
  - Arrow stepping is unchanged in spirit: `maxMonth = selectedYear ===
    currentYear ? currentMonth : 12`, so a past year pages Jan–Dec and the
    current year still stops at the current month. Prev still stops at January
    (no cross-year roll — that's the picker's job).
  - "This month" pill and `goToCurrentMonth` now reset **month and year**;
    pill shows whenever `!isCurrentMonth` (month **or** year differs).
  - Fetch carries `&targetYear=${selectedYear}` (server spec 22) and the query
    key includes the year. The key still begins `["monthly-transaction"]`, so
    every write's invalidation still reaches it; it no longer shares Activity's
    exact key (spec 47's micro-optimisation), which is an acceptable trade for
    year addressing — correctness via the prefix is unchanged.
  - `expanded` accordion reset now also fires on a year change.

## Verify when done

- [x] `npx tsc --noEmit` and `expo lint` clean.
- [ ] Device/session: tap month name → sheet opens; pick a past year+month →
      Trend reloads that month; arrows still step within the selected year;
      "This month" returns to the live month/year; future months disabled.

Companion: server `ai context/specs/22-monthly-transactions-target-year.md`.
