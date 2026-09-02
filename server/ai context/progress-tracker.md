# Progress Tracker — Server

> **Rule for this file**: do not restate an issue's description, impact, or suggested fix here — link to `known-issues.md` by ID. This file tracks status and ordering only.

## Current state

Core API surface is built and working: auth (register/login), transaction CRUD, four report endpoints (daily/monthly/yearly/weekly), and AI-assisted bulk transaction parsing. There is no active multi-phase build plan — this is a maintained, already-shipped personal project, not greenfield work. The `specs/` scaffolding below exists for the _next_ piece of nontrivial work, not a backlog of already-completed phases.

## Spec status

| Spec                                               | Status                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `01-mongodb-to-postgres-migration.md`              | Decisions/background record + Prisma config — done. Execution split into `02` and `03`. |
| `02-migrate-user-transaction-modules-to-prisma.md` | Completed 2026-09-02, with 2 flagged exceptions — see spec's "Verify when done" note below. |
| `03-migrate-mongodb-data-to-postgresql.md`         | **Blocked — needs a decision from the user, see below.**                                |

## Spec 02 — Verify when done (checked against the empty Postgres tables, via local `yarn dev` + curl)

- [x] `mongoose` removed from the `user`/`transaction` modules' data-access code (services + models).
- [x] `yarn build` (tsc) passes with no errors.
- [x] Register → `_id` present, hash present (AUTH-3 unchanged, out of scope).
- [x] Login → working JWT.
- [x] Create transaction → `_id` present, `amount` is a JSON number, not a string.
- [x] Bulk-add 2-3 items → succeeds, confirmed via follow-up `GET`.
- [x] All four summary endpoints → correct totals, `amount` numeric throughout, including nested arrays.
- [x] Update own transaction → succeeds.
- [x] Update/delete another user's transaction → 400, not a success — confirms **AUTH-1** fixed.
- [x] Delete a transaction twice → second call now errors instead of silently succeeding — confirms **AUTH-10** fixed.
- [ ] `mongoose` fully removed from `package.json` — **not done**. `handleCatError.ts`/`handleValidationError.ts` (outside spec 02's scope — global error handling, not `user`/`transaction`) still import `mongoose` for `CastError`/`ValidationError` type annotations on otherwise-dead branches (Prisma never throws these; dispatch in `globalErrorHandler.ts` is by `error.name` string, not `instanceof`). Removing the package breaks `yarn build` unless those two files are also touched, which is out of this spec's listed scope. Flagging rather than silently expanding scope or silently leaving `package.json` un-flagged.
- [ ] Full Expo client manual walkthrough — **not done**. No device/simulator available in this (headless, unattended-loop) environment; the equivalent API-level checks above were run instead via direct HTTP calls against the running server.
- [x] `yarn lint` — clean on every file this spec touched; 4 pre-existing errors remain elsewhere (`app.ts`, `Queryuilder.ts`, `interface/index.d.ts`, `globalErrorHandler.ts` — all untouched by this spec, confirmed via `git status`), not introduced by this work.

## Spec 03 — status as of 2026-09-02 21:34 (blocked, awaiting a decision)

Done so far, all per the spec:
- `git tag pre-postgres-migration` created (before spec 02's implementation began).
- `mongodump` backup of the live Atlas cluster taken to `~/expensetracker-mongo-backups/20260902-212437/` (outside the repo — real financial data, not committed).
- `server/scripts/migrate-to-postgres.ts` + `server/scripts/tsconfig.json` written; `server/tsconfig.json` updated to exclude `scripts/`; `MONGO_MIGRATION_URI` added to `server/.env`.
- **Important correction while implementing**: the spec's own text describes the source DB as "`expenseTrackerNative`", but the *actual* database name on the Atlas cluster has a literal trailing `>` character — `expenseTrackerNative>` — confirmed via `listDatabases()` (4 users / 1838 transactions, matches "a year of real financial data") vs. the never-read `DATABASE_URL2`'s `expTracker>` (1 user / 8 transactions, clearly stale/test). `MONGO_MIGRATION_URI` is correctly URL-encoded (`%3E`) for this. Don't "fix" this trailing `>` as a typo in any future work — it's real.
- Migration script run for real against live Mongo → Neon Postgres: **4/4 users migrated, 1820/1838 transactions migrated.**

**Blocked on**: 18 transactions in Mongo have no `user` field at all (confirmed via direct query, not a script bug — `db.transactions.countDocuments({ user: { $exists: false } })` → 18, matches the failed-ID list exactly). These can't be assigned a Postgres `userId` (NOT NULL FK) without guessing an owner. Pattern observed: all 18 are dated 2025-07-07 through 2025-07-22 (the app's earliest ~2 weeks — before the one real user account, "Moniruzzaman", was even created on 2025-07-21), half are already `isDeleted: true`, and several have placeholder/gibberish titles ("asdfas", "sadfsa", "ggh", `http://localhost:8081/addTransaction`) — this strongly looks like early dev/testing data from before `user` became a required field, not real financial history. But that's a read of the data, not a decision this session should make unilaterally on a year of someone's real financial records — full list of 18 IDs is in the background task log referenced in this session's transcript, easy to re-derive with the query above.

Formal verification (`VERIFICATION PASSED`) was **not run** — it would fail on the transaction-count check by design (1820 ≠ 1838) until this is resolved, so running it now wouldn't add information beyond what's already known.

**Options for the user, next time this is picked up:**
1. Treat the 18 as acceptable dev/test noise, exclude them permanently, proceed to verification with 1820 as the expected transaction count.
2. Investigate further (e.g. check `updatedAt`/context) to see if an owner can be inferred for any of them.
3. Something else the user prefers.

Script is idempotent — safe to re-run as-is once a decision is made (already-migrated rows are untouched via `upsert`/no-op `update: {}`).

## Known Gaps

- [x] AUTH-1 — IDOR on transaction update/delete — resolved by `specs/02-migrate-user-transaction-modules-to-prisma.md` (2026-09-02).
- [x] AUTH-10 — `deleteTransactionData` missing already-deleted check — resolved by `specs/02-migrate-user-transaction-modules-to-prisma.md` (2026-09-02).
- [ ] AUTH-2 — `manage-money` endpoint unauthenticated
- [ ] AUTH-3 — password hash returned to client
- [ ] VALID-1 — bulk-create has no validation
- [ ] ERR-1 — stack trace leaked in every error response
- [ ] AI-1 — corrupted system prompt
- [ ] AI-2 — no schema validation on AI output
- [ ] (see `known-issues.md` for the full ranked list — Medium/Low items omitted here)

## Next Up (prioritized, with why-now)

1. **AUTH-2** — direct, ongoing cost exposure against your own OpenRouter key; closing it is one line (`authCheck`).
2. **AI-1** — the corrupted prompt is actively degrading the AI-parsing feature's actual output quality right now, not just a latent risk.
3. Small follow-up (not yet scoped as a spec): remove the two remaining `mongoose` type-only imports in `handleCatError.ts`/`handleValidationError.ts` so `mongoose` can actually be dropped from `package.json` — see the flagged exception above.
