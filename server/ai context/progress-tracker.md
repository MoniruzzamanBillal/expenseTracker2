# Progress Tracker — Server

> **Rule for this file**: do not restate an issue's description, impact, or suggested fix here — link to `known-issues.md` by ID. This file tracks status and ordering only.

## Current state

Core API surface is built and working: auth (register/login), transaction CRUD, four report endpoints (daily/monthly/yearly/weekly), and AI-assisted bulk transaction parsing. There is no active multi-phase build plan — this is a maintained, already-shipped personal project, not greenfield work. The `specs/` scaffolding below exists for the _next_ piece of nontrivial work, not a backlog of already-completed phases.

## Spec status

| Spec                                               | Status                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `01-mongodb-to-postgres-migration.md`              | Decisions/background record + Prisma config — done. Execution split into `02` and `03`.     |
| `02-migrate-user-transaction-modules-to-prisma.md` | Completed 2026-09-02, with 2 flagged exceptions — see spec's "Verify when done" note below. |
| `03-migrate-mongodb-data-to-postgresql.md`         | Completed through verification 2026-09-03 — **cutover not yet done**, see below.            |
| `04-openrouter-resilient-ai-integration.md`        | Completed 2026-09-03 — see `05` for a follow-up fix hit during its own verification.        |
| `05-fix-stale-free-model-list.md`                  | Completed 2026-09-03, same session as `04`.                                                 |
| `06-fix-free-model-list-latency-and-broken-entry.md` | Completed 2026-09-03 — found during a full-backend regression pass, after the model list was manually edited to 8 entries. |
| `07-bikelog-transaction-request-sync.md`             | Completed 2026-09-09 — server side of the 3-spec cross-repo feature; see spec's "Verify when done" note below. |

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

## Spec 03 — status as of 2026-09-03 11:05 (verification passed, cutover not started)

Done, all per the spec, through its "Verification (must PASS before cutover)" step:

- `git tag pre-postgres-migration` created (before spec 02's implementation began).
- `mongodump` backup of the live Atlas cluster taken to `~/expensetracker-mongo-backups/20260902-212437/` (outside the repo — real financial data, not committed).
- `server/scripts/migrate-to-postgres.ts` + `server/scripts/tsconfig.json` written; `server/tsconfig.json` updated to exclude `scripts/`; `MONGO_MIGRATION_URI` added to `server/.env`.
- **Important correction made while implementing**: the spec's own text describes the source DB as "`expenseTrackerNative`", but the _actual_ database name on the Atlas cluster has a literal trailing `>` character — `expenseTrackerNative>` — confirmed via `listDatabases()` and document counts vs. the never-read `DATABASE_URL2`'s stale `expTracker>` db. `MONGO_MIGRATION_URI` is correctly URL-encoded (`%3E`) for this. Don't "fix" this trailing `>` as a typo in any future work — it's real.
- **18 orphaned transactions** (no `user` field in Mongo at all — dated 2025-07-07 to 2025-07-22, the app's first ~2 weeks, before `user` became a required field) could not be assigned a Postgres `userId` automatically. Asked the user rather than guessing; **user decision (2026-09-03): attach all 18 to the abc@d.com account** ("Moniruzzaman", Mongo `_id` 687e0a886b065df2d20c168c). Implemented as an explicit, reviewed `KNOWN_ORPHAN_TRANSACTION_IDS` list in the script (not a blanket rule) so any different/future orphan still fails loud instead of being silently absorbed.
- Migration script run for real against live Mongo → Neon Postgres, multiple times (idempotent, safe to re-run): the live app is still Mongoose-backed and actively used, so a couple of re-runs were needed to catch up with new transactions arriving mid-run (~500s per run, since each row is a separate network round-trip) — this is expected behavior of migrating from a live source, not a bug. Final run: **4/4 users, 1841/1841 transactions, 0 failures.**
- Verification run and printed **`VERIFICATION PASSED`**: user count, transaction count, income sum, expense sum, and 5 random spot-checks all matched.

**Not done, by design (per this session's standing boundary — stop before touching production)**: the entire Cutover sequence, including its non-production-touching step 6 (run the `02`-rewritten server locally against the real migrated data, log in with the real account, exercise the Expo client end-to-end) through its production-touching steps 7-9 (swap Vercel's `DATABASE_URL`, deploy, live smoke-test). The app is still live on Mongoose. Because the live app keeps writing, whoever picks up cutover should treat "run the migration script one more time, then verify, then swap the env var" as one tight sequence (per the spec's own cutover step 3) rather than trusting this session's verification pass to still hold days later — more real transactions will have arrived by then.

### Spec 03 — Verify when done (up through Verification, per this session's boundary)

- [x] `mongodump` backup taken and stored before running the migration script for real.
- [x] Migration script run against the live Mongo Atlas connection; prints final counts with zero entries in `failed`.
- [x] Verification script prints `VERIFICATION PASSED`.
- [ ] Local server (from `02`) running against the real migrated Postgres data, logged in with the real account, history/summaries manually confirmed — **not done, first step of the Cutover sequence, deferred to when the user is present.**
- [ ] Expo client run against that local server end-to-end with the real account — **not done, same reason.**
- [ ] Production `DATABASE_URL` confirmed/swapped on Vercel, code deployed, live smoke-test passed — **not done, same reason.**
- [x] `git tag pre-postgres-migration` exists, created before `02`'s implementation began.
- [x] Mongo Atlas cluster confirmed still running/preserved (not deleted) — untouched throughout, script only ever reads from it.

## Spec 07 — Verify when done (checked via local `yarn dev` + curl against real Neon Postgres)

- [x] `npx prisma migrate dev --name add_transaction_request` ran clean (`20260909061550_add_transaction_request`).
- [x] `POST /api/transaction-requests/ingest` with a valid `x-integration-key` and well-formed body returns `201` and a `pending` row.
- [x] The same curl payload sent twice does not create a duplicate row (idempotency via the `@@unique([sourceApp, sourceRecordId])` constraint, `P2002` caught and existing row returned).
- [x] A missing/wrong `x-integration-key` returns `401`.
- [x] `GET /api/transaction-requests` with a valid user JWT returns only that user's `pending` rows.
- [x] `PATCH /:id/accept` with an edited `amount` creates a real `Transaction` reflecting the edited value (verified it shows up correctly in `GET /transactions/daily-transaction`'s totals), and the request row flips to `status: "accepted"` with `transactionId` set.
- [x] `PATCH /:id/accept` on someone else's request, or on an already-reviewed request, returns `404`.
- [x] `PATCH /:id/reject` flips status to `rejected` and the row stops appearing in `GET /api/transaction-requests` but still exists in the DB.

All exercised live against the real dev Neon database (adapter is `@prisma/adapter-neon`, no separate test DB exists) with one throwaway registered user (`spec07test@example.com`) plus one throwaway `TransactionRequest` row tied to the real account for the initial ingest/idempotency check — all test fixtures (throwaway user, its 1 accepted `Transaction`, and both throwaway/real-account test `TransactionRequest` rows) were deleted afterward via a temporary in-tree script (`src/scripts/__tmpSpec07Cleanup.ts`, reusing the app's own `prisma` client, deleted immediately after running — same pattern as bikelog's own spec-cleanup convention). `npx tsc --noEmit` and `yarn build` both clean; `yarn lint` shows the same 4 pre-existing errors in untouched files (`app.ts`, `Queryuilder.ts`, `interface/index.d.ts`, `globalErrorHandler.ts`) as spec 02's baseline — none new.

**Scope note**: this is the server piece only. The client inbox screen is `client/ai context/specs/11-bikelog-transaction-requests-inbox.md` (separate progress tracker); the bikelog-side outbound caller is `bikelog_server/context/specs/30-sync-spend-logs-to-expense-tracker.md`.

## Known Gaps

- [x] AUTH-1 — IDOR on transaction update/delete — resolved by `specs/02-migrate-user-transaction-modules-to-prisma.md` (2026-09-02).
- [x] AUTH-10 — `deleteTransactionData` missing already-deleted check — resolved by `specs/02-migrate-user-transaction-modules-to-prisma.md` (2026-09-02).
- [x] AUTH-2 — `manage-money` endpoint unauthenticated — resolved by `specs/04-openrouter-resilient-ai-integration.md` (2026-09-03).
- [ ] AUTH-3 — password hash returned to client
- [ ] VALID-1 — bulk-create has no validation
- [ ] ERR-1 — stack trace leaked in every error response
- [x] AI-1 — corrupted system prompt — resolved by `specs/04-openrouter-resilient-ai-integration.md` (2026-09-03).
- [ ] AI-2 — no schema validation on AI output
- [x] AI-3 — non-deterministic temperature for structured extraction — resolved by `specs/04-openrouter-resilient-ai-integration.md` (2026-09-03).
- [x] AI-4 — unsafe `choices[0]` indexing — resolved incidentally by `specs/04-openrouter-resilient-ai-integration.md` (2026-09-03), via the shared helper's empty-content guard.
- [x] AI-5 — hardcoded model id with dead commented-out alternatives — resolved by `specs/04-openrouter-resilient-ai-integration.md` (2026-09-03), superseded by the `FREE_MODELS` fallback list.
- [ ] (see `known-issues.md` for the full ranked list — Medium/Low items omitted here)

## Next Up (prioritized, with why-now)

1. Small follow-up (not yet scoped as a spec): remove the two remaining `mongoose` type-only imports in `handleCatError.ts`/`handleValidationError.ts` so `mongoose` can actually be dropped from `package.json` — see the flagged exception above.
2. **AI-2** — no schema validation on the AI-parsed transaction output — natural next step now that the AI integration itself (`04`/`05`) is resilient; not bundled into `04` since it's a downstream-of-the-call concern, not integration/transport.
