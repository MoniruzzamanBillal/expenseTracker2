# Progress Tracker — Server

> **Rule for this file**: do not restate an issue's description, impact, or suggested fix here — link to `known-issues.md` by ID. This file tracks status and ordering only.

## Current state

Core API surface is built and working: auth (register/login), transaction CRUD, four report endpoints (daily/monthly/yearly/weekly), and AI-assisted bulk transaction parsing. There is no active multi-phase build plan — this is a maintained, already-shipped personal project, not greenfield work. The `specs/` scaffolding below exists for the *next* piece of nontrivial work, not a backlog of already-completed phases.

## Spec status

| Spec | Status |
|---|---|
| `01-mongodb-to-postgres-migration.md` | Planned — not started |

## Known Gaps

- [ ] AUTH-1 — IDOR on transaction update/delete
- [ ] AUTH-2 — `manage-money` endpoint unauthenticated
- [ ] AUTH-3 — password hash returned to client
- [ ] VALID-1 — bulk-create has no validation
- [ ] ERR-1 — stack trace leaked in every error response
- [ ] AI-1 — corrupted system prompt
- [ ] AI-2 — no schema validation on AI output
- [ ] (see `known-issues.md` for the full ranked list — Medium/Low items omitted here)

## Next Up (prioritized, with why-now)

1. **AUTH-1** — cheapest to fix, highest data-integrity risk (one `transaction.user === req.user.userId` check in two service functions). Now scoped as part of `specs/01-mongodb-to-postgres-migration.md`, since that work rewrites both functions anyway — not being fixed standalone ahead of it.
2. **AUTH-2** — direct, ongoing cost exposure against your own OpenRouter key; closing it is one line (`authCheck`).
3. **AI-1** — the corrupted prompt is actively degrading the AI-parsing feature's actual output quality right now, not just a latent risk.
