# Progress Tracker — Server

> **Rule for this file**: do not restate an issue's description, impact, or suggested fix here — link to `known-issues.md` by ID. This file tracks status and ordering only.

## Current state

Core API surface is built and working: auth (register/login), transaction CRUD, four report endpoints (daily/monthly/yearly/weekly), and AI-assisted bulk transaction parsing. There is no active multi-phase build plan — this is a maintained, already-shipped personal project, not greenfield work. The `specs/` scaffolding below exists for the _next_ piece of nontrivial work, not a backlog of already-completed phases.

## Spec status

| Spec                                               | Status                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `01-mongodb-to-postgres-migration.md`              | Decisions/background record + Prisma config — done. Execution split into `02` and `03`. |
| `02-migrate-user-transaction-modules-to-prisma.md` | Completed 2026-09-02, with 2 flagged exceptions — see spec's "Verify when done" note below. |
| `03-migrate-mongodb-data-to-postgresql.md`         | In Progress                                                                              |

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
