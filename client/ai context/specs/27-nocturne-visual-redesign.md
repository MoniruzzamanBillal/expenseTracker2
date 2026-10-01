# 27 — Nocturne visual redesign

Full visual + navigation redesign of `client/` to the "Nocturne" design system, sourced from `Mobile app design project/handoff/` (gitignored design-source folder, not committed — see that folder's README.md for the reading order). This is a visual and navigation change only: auth/token flow, react-query keys and invalidation, the offline queue, receipt upload, and deep links are all kept as-is.

## Source of truth

- `01 Foundations.dc.html` — tokens (`theme/colors.ts`, `typography.ts`, `spacing.ts`), navigation map, shared component spec, "What the API can't serve yet" (13 backend gaps — workarounds only, no server changes).
- `02 Today and Capture.dc.html` — Today, Add, receipt flow, Smart Add, Quick Add, widget.
- `03 Review and Manage.dc.html` — Activity, Insights, Budgets, Requests, Settings, Auth.
- `TxRow.dc.html`, `TabBar.dc.html`, `StatePhone.dc.html` — shared row/tab-bar/empty-loading-error contracts.
- `Status.dc.html` — mock status bar only, ignored per that folder's README.

## Decisions made during planning (no further sign-off needed on these)

- Light-mode chart ramp `--c2..--c5`/`--uncat`: design doc only specifies `--c1` and `--uncat`'s dark value; light-mode values derived by lightening/desaturating the dark ramp (see `theme/colors.ts`).
- Activity's "every day always open" (accordion removed) and History→Insights rename + Trend promotion out of MonthlyTransaction: implemented exactly as drawn, per explicit nav-changes section of the design brief.
- Requests accept flow is two sequential API calls (accept → uncategorized transaction, then a follow-up PATCH to apply category) with no documented partial-failure handling in the design doc — implemented as two calls; if the second fails, the toast surfaces the category-apply error specifically so the (already-created, now-uncategorized) transaction isn't silently mis-reported as fully failed.
- RQ2's title/amount/description fields: implemented as editable (matches the build note's PATCH body listing them as optional overrides), styled with the same focused/accent-border treatment as other editable fields, despite the mockup's more static-looking box styling.

## Phases

1. **Theme tokens** — `theme/colors.ts`, `typography.ts`, `spacing.ts`, `index.ts`, `widgets/QuickAddWidget.tsx` palette. Done in an earlier commit this session (`feat(client): Nocturne redesign phase 1 — theme tokens`).
2. **Shared components** — `components/main/shared/*`: TransactionCard (TxRow), TotalBalanceCard+SummaryPills, CategoryBreakdown, CategoryPicker/CategorySelectField, TypeToggle, PrimaryButton, FormField, EmptyState/Skeleton/Error, sheets (Update/PendingEdit/RequestEdit modals restyled), ReceiptViewer. New: `TabBar` visual restyle lives in `app/(tabs)/_layout.tsx` (no separate component file currently), `Keypad` (new, for Add/Quick Add amount entry).
3. **Navigation** — `app/(tabs)/_layout.tsx`: tabs become Today · Activity · Add (center outline) · Insights · Budgets; Budgets visible; `history.tsx` file becomes Insights; `monthlyTransactions.tsx` becomes Activity; `smart-add`/`transaction-requests`/`settings` stay `href: null`.
4. **Screens**, in order: Today, Add, Smart Add, Quick Add + widget, Activity, Insights, Budgets, Requests, Settings, Auth.

## Verify when done

- [x] `npx tsc --noEmit` clean from `client/`
- [x] `yarn lint` clean
- [x] All 5 tabs render, in the new order, with the new icon set (Ionicons, `home-outline`/`home`, `calendar-clear-outline`/`calendar-clear`, `stats-chart-outline`/`stats-chart`, `pie-chart-outline`/`pie-chart`), center Add button as an outline pill
- [x] Today: avatar → Settings, tray icon w/ pending-count badge → Requests, glow net card, compact category breakdown bar, entries list with offline-queue items merged in as "waiting to sync" rows
- [x] Add: in-app keypad, no Requests button, Smart Add kept
- [x] Smart Add: compose → parsing → review-drafts-with-category-picker → saved/error, matching S1–S5
- [x] Quick Add + widget: sheet-not-screen, widget uses the updated hardcoded Nocturne palette
- [x] Activity: Month/Week segmented, no accordion (always-open day groups), daily spend strip
- [x] Insights: Year/Trend segmented (renamed from History; Trend moved out of MonthlyTransaction)
- [x] Budgets: now a visible tab, tone-based sorting/coloring
- [x] Requests: inbox card list, Reject quiet / Review opens accept sheet
- [x] Settings: profile, appearance (new persisted Dark/Light/System toggle), categories, sign out
- [x] Auth: sign in / register, verbatim server error strings preserved
- [x] Every data screen has loading/empty/error states per `StatePhone` contract, error states show the API message verbatim + "Try again" → refetch
- [x] Dark and light themes both verified (elevation/tokens are theme-driven throughout; not manually clicked through in a running app — no device/simulator available this session)
- [x] No hex values/magic numbers inside components — tokens only

## Implementation notes

Completed 2026-09-28, all four phases, code-reviewed against the design docs and `npx tsc --noEmit`/`yarn lint` (clean, whole app) after every phase. Installed one new client-only dependency, `expo-document-picker` (for Add/Quick Add's "Choose PDF" receipt option — the current app only ever picked images despite the server/types already supporting PDF receipts).

**Not manually verified in a running app or on a device this session** — no dev server/simulator/emulator available. Everything below is code-level verified (types, lint, cross-referenced against the design docs and existing hooks/endpoints) but not click-tested. Before shipping, a human pass should cover:
- Real device/simulator click-through of all 10 screens, both themes, both platforms (the app ships as an Android APK)
- The widget's actual rendering (Q1/W1) — `widgets/QuickAddWidget.tsx`'s palette was updated by inspection, not rendered
- Keypad/amount entry UX feel (Add, Quick Add, Smart Add draft edit)
- Swipe gestures on TransactionCard (left/right action mapping was swapped during the TxRow rewrite — right-swipe now reveals Edit, left-swipe reveals Delete, matching TxRow's swipe direction convention; verify this feels right, not mirrored)
- The Requests accept-then-categorize two-step flow against a real backend (only code-reviewed, not exercised)
- AsyncStorage-persisted theme preference actually surviving an app restart

**Deviations / judgment calls worth a second look:**
- CategoryBreakdown was redesigned as a single component serving both Today's read-only compact bar+legend and Activity's tappable filter (same props/behavior, no `mode` prop) — simpler than the design's two-variant framing but may need to diverge later if Today needs to *not* be tappable-looking.
- HistoryPage's year bar-chart row is a lightweight custom View-based bar strip, not `react-native-gifted-charts` — TrendTab (moved in from MonthlyTransaction) already uses gifted-charts for its line/donut so the dependency is in use; the year view didn't seem to need a charting library for 12 simple paired bars.
- Smart Add's review screen simplifies the mockup's "cards stack, one expanded" into a summary-row that expands into the full edit form in place, rather than a fixed one-open-at-a-time carousel — functionally equivalent, fewer moving parts.
