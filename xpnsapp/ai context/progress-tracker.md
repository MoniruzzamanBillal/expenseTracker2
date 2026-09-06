# Progress Tracker — xpns

> **Rule for this file**: do not restate an issue's description, impact, or suggested fix here — link to `known-issues.md` by ID. This file tracks status and ordering only.

## Current state

Initial build, implementing the Claude Design handoff (`project/Expense Tracker Design.dc.html`) end to end: auth, register, home, add-transaction, smart-add, history, monthly, weekly all exist and are wired to the `useApi` data-fetching hooks. Not yet run against a live API or manually verified on-device — `utils/envConfig.ts`'s base URL is still a placeholder (`known-issues.md#CFG-1`).

## Known Gaps

- [ ] CFG-1 — base URL in `utils/envConfig.ts` is a placeholder, app can't reach a real API yet
- [ ] AUTH-1 — no token-refresh mechanism, only 401-triggered logout
- [ ] AUTH-2 — 401 handling doesn't sync `UserProvider`'s in-memory state
- [ ] UX-1 — "Forgot password?" on the login screen is visual only, no flow behind it
- [ ] SCOPE-1 — offline/pending-transaction queue from the prior app was intentionally not carried over (see `known-issues.md`)

## Next Up (prioritized, with why-now)

1. **CFG-1** — nothing else can be manually verified end-to-end until this is set.
2. **AUTH-2** — small, contained fix (call `logoutFunction()`-equivalent from the interceptor's 401 branch) that removes a stale-session edge case.
3. **AUTH-1** — larger scope; only worth picking up once the app has real usage that exposes how often sessions actually expire mid-use.
