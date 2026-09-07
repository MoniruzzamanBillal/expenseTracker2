# Progress Tracker — Client

> **Rule for this file**: do not restate an issue's description, impact, or suggested fix here — link to `known-issues.md` by ID. This file tracks status and ordering only.

## Current state

Core screens are built and working: home, add-transaction, history, monthly+weekly (merged into one tab with an in-page segmented control, spec 06 Decision 8), smart-add (AI-assisted entry, reached via a button on Add Transaction rather than its own tab, spec 06 Decision 7), auth/register. The app now has a custom `theme/` design-system (colors/typography/spacing, light+dark) replacing bare `react-native-paper` defaults — `architecture.md`/`code-standards.md`/`project-overview.md` have been updated to reflect this. There is no active multi-phase build plan — this is a maintained, already-shipped personal project, not greenfield work. The `specs/` scaffolding below exists for the _next_ piece of nontrivial work, not a backlog of already-completed phases.

## Spec status

| Spec                                                                                                | Status                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-monthly-daily-average-expense](specs/01-monthly-daily-average-expense.md)                       | Completed — implemented, not yet manually verified against live data in a running app                                                                    |
| [02-offline-transaction-support](specs/02-offline-transaction-support.md)                           | Completed — implemented (Home-only pending display, see spec's scope-deviation note), not yet manually verified against a running app with airplane mode |
| [03-pending-transaction-date-visibility](specs/03-pending-transaction-date-visibility.md)           | Completed — implemented, not yet manually verified against a running app                                                                                 |
| [04-edit-delete-pending-transaction](specs/04-edit-delete-pending-transaction.md)                   | Completed — implemented, not yet manually verified against a running app                                                                                 |
| [05-fix-blank-error-toast-on-network-failure](specs/05-fix-blank-error-toast-on-network-failure.md) | Completed — implemented, not yet manually verified against a running app                                                                                 |
| [06-visual-redesign-xpnsapp-design-system](specs/06-visual-redesign-xpnsapp-design-system.md)       | Completed 2026-09-07 — implemented and manually verified (headless-browser click-through, light+dark) against a mocked-but-real backend; see spec's Implementation notes for what remains for a human pass (real device, real login) |
| [07-fix-accordion-crash-on-empty-day-bucket](specs/07-fix-accordion-crash-on-empty-day-bucket.md)   | Completed — fixed a crash found while manually verifying spec 06 |
| [08-discoverable-logout](specs/08-discoverable-logout.md)                                           | Completed 2026-09-07 — Option A implemented, avatar removed per user's follow-up instruction; also fixed a related bug where the logout button did nothing on web (`known-issues.md#UX-3`) |
| [09-fix-deprecated-safeareaview](specs/09-fix-deprecated-safeareaview.md)                            | Completed 2026-09-07 — swapped `SafeAreaView` to `react-native-safe-area-context` in all 7 affected screens; Android safe-area behavior change flagged for a human device check |
| [10-pre-production-manual-checklist](specs/10-pre-production-manual-checklist.md)                   | Drafted — a human-run checklist (real device: swipe gestures, offline queue, real login, production build) that automated headless-browser testing couldn't cover; not yet run |

## Known Gaps

- [ ] FETCH-1 — axios interceptor never rejects on HTTP errors
- [ ] AUTH-1 — `AuthGuard`'s logged-in-redirect branch is dead in practice
- [ ] AUTH-2 — 401 handling doesn't sync in-memory session state
- [ ] TYPE-2 — client/server `TTransaction` shape drift
- [ ] UX-3 — `Alert.alert` no-ops on the web target; fixed for Home's logout button, still open for TransactionCard/PendingTransactionEditModal/SmartAdd's delete/remove confirms
- [x] FETCH-7 — error toast shows blank text on a no-response (offline/timeout) failure — fixed via spec 05
- [x] TYPE-1 — three independent copies of the transaction-type enum — resolved via spec 06 (the two duplicate copies were removed as an incidental result of rewriting `AddTransactionPage.tsx`/`TransactionCard.tsx`, not a dedicated cleanup pass)
- [ ] (see `known-issues.md` for the full ranked list — Low items omitted here)

## Next Up (prioritized, with why-now)

1. **FETCH-1** — root cause of a whole chain of dead error-handling code; fixing it (uncomment the `Promise.reject`) unblocks meaningfully improving user-facing error messages everywhere else.
2. **AUTH-1** — a real (if narrow) navigation bug; fix by mounting `AuthGuard` above `(tabs)` instead of inside it, or restructuring the redirect logic to run regardless of which top-level route is active.
