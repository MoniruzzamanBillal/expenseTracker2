# Progress Tracker — Client

> **Rule for this file**: do not restate an issue's description, impact, or suggested fix here — link to `known-issues.md` by ID. This file tracks status and ordering only.

## Current state

Core screens are built and working: home, add-transaction, history, monthly, weekly, smart-add (AI-assisted entry), auth/register. There is no active multi-phase build plan — this is a maintained, already-shipped personal project, not greenfield work. The `specs/` scaffolding below exists for the _next_ piece of nontrivial work, not a backlog of already-completed phases.

## Spec status

| Spec                                                                          | Status                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------- |
| [01-monthly-daily-average-expense](specs/01-monthly-daily-average-expense.md) | Completed — implemented, not yet manually verified against live data in a running app |

## Known Gaps

- [ ] FETCH-1 — axios interceptor never rejects on HTTP errors
- [ ] AUTH-1 — `AuthGuard`'s logged-in-redirect branch is dead in practice
- [ ] AUTH-2 — 401 handling doesn't sync in-memory session state
- [ ] TYPE-1 — three independent copies of the transaction-type enum
- [ ] TYPE-2 — client/server `TTransaction` shape drift
- [ ] (see `known-issues.md` for the full ranked list — Low items omitted here)

## Next Up (prioritized, with why-now)

1. **FETCH-1** — root cause of a whole chain of dead error-handling code; fixing it (uncomment the `Promise.reject`) unblocks meaningfully improving user-facing error messages everywhere else.
2. **TYPE-1** — silent correctness risk if the three enum copies are ever changed inconsistently; consolidating to one import is low-risk and mechanical.
3. **AUTH-1** — a real (if narrow) navigation bug; fix by mounting `AuthGuard` above `(tabs)` instead of inside it, or restructuring the redirect logic to run regardless of which top-level route is active.
