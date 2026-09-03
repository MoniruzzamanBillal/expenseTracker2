# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

ExpenseTracker is a full-stack mobile expense-tracking app with two **fully independent** projects — there is no root `package.json`, no workspace, and no root-level lint/build/test command. Each has its own dependencies and must be worked on from within its own directory; there is no root-level script that operates on both at once.

- `client/` — Expo (React Native) app using file-based routing (`expo-router`).
- `server/` — Express + Mongoose REST API, deployed to Vercel as a serverless function. A Postgres/Prisma migration is in progress but not yet live in app code — see the note below.

## Common commands

### server (run from `server/`)
- `yarn dev` — run the API locally with `ts-node-dev` (auto-restart, transpile-only).
- `yarn build` — compile TypeScript to `dist/` (`tsc`).
- `yarn start:prod` — run the compiled server (`node ./dist/server.js`).
- `yarn lint` / `yarn lint:fix` — ESLint over `src`.
- `yarn prettier` / `yarn prettier:fix` — format `src`.
- `yarn db:migrate` — apply Prisma migrations (`prisma migrate deploy`); `postinstall` runs `prisma generate` automatically. These operate on the Postgres schema, not the live Mongoose models — see the migration note below.
- There is no real test suite (`yarn test` is a stub that exits with an error).

### client (run from `client/`)
- `yarn start` or `yarn dev` — start the Expo dev server.
- `yarn android` / `yarn ios` / `yarn web` — start targeting a specific platform.
- `yarn lint` — `expo lint`.
- `yarn reset-project` — Expo's scaffolding reset script (moves current `app/` to `app-example/` and creates a blank one); do not run this unless explicitly asked.

## Source of truth

Each side has its own `ai context/` folder (note the literal space in the folder name — quote the path in shell commands) with a written source of truth: what the code actually does today, numbered invariants, conventions, a ranked known-issues backlog, workflow rules, and spec/progress-tracker scaffolding for future work. **Read the relevant one before making architectural decisions — don't restate its content here, and don't let this file and those docs drift apart.**

### Source of truth — Server (`server/ai context/`)

Read in this order:
1. `project-overview.md` — what the API does, module map, domain model
2. `architecture.md` — request lifecycle, auth model, AI parsing subsystem, numbered invariants
3. `code-standards.md` — naming/validation/error-handling conventions, what not to silently normalize
4. `known-issues.md` — ranked bug backlog (~35 findings)
5. `ai-workflow-rules.md` — scoping rules, protected files, verify-before-moving-on checklist
6. `progress-tracker.md` — current state, known gaps, next up
7. `specs/00-build-plan.md` — how to scope new work

**In-progress DB migration (server):** `server/prisma/schema.prisma`, `neon.ts`, `.neon`, and `prisma.config.ts` are scaffolding for a MongoDB→Postgres migration — Prisma is configured and can connect, but all request-handling code still reads/writes through Mongoose (`server/src/app/modules/*/*.model.ts`). Don't assume Prisma is live, and don't treat Mongoose as being phased out mid-task. The full plan is `specs/01-mongodb-to-postgres-migration.md` (decisions/config — done) split into `specs/02-migrate-user-transaction-modules-to-prisma.md` and `specs/03-migrate-mongodb-data-to-postgresql.md` (both planned, not started per `progress-tracker.md`).

### Source of truth — Client (`client/ai context/`)

Read in this order:
1. `project-overview.md` — what the app does, screen list, tech stack
2. `architecture.md` — provider stack, data-fetching pipeline, auth flow, numbered invariants
3. `code-standards.md` — component organization, which hooks are actually used, styling
4. `known-issues.md` — ranked bug backlog (~18 findings)
5. `ai-workflow-rules.md` — scoping rules, protected files, verify-before-moving-on checklist
6. `progress-tracker.md` — current state, known gaps, next up
7. `specs/00-build-plan.md` — how to scope new work

## Highest-severity gotchas (full detail in the docs above)

**Server:**
- IDOR — transaction update/delete has no ownership check; any authenticated user can edit/delete another user's transactions (`server/ai context/known-issues.md#AUTH-1`).
- `POST /transactions/manage-money` (the AI-parsing endpoint) has no auth at all — a live, unauthenticated cost/abuse vector against your own OpenRouter key (`#AUTH-2`).
- Password hashes are returned to the client on both register and login — no field is stripped before the response goes out (`#AUTH-3`).

**Client:**
- The axios response interceptor never rejects on HTTP errors (`return error`, not `Promise.reject(error)`) — every downstream `onError`/`catch` around a mutation is dead code; the interceptor's own Toast is the only real error surface today (`client/ai context/known-issues.md#FETCH-1`).
- On a 401, `AsyncStorage` is cleared but `UserProvider`'s in-memory state isn't — the UI can look "still logged in" until reload or manual logout (`#AUTH-2`).
- Three independent copies of the income/expense enum exist across the codebase, with two different casings of the constant name — import the enum only from `constants/TransactionType.constant.ts` in new code (`#TYPE-1`).

## Known issues

The full ranked backlogs live in `server/ai context/known-issues.md` and `client/ai context/known-issues.md`, grouped by module with severity tags. Notably absent from the inline list above but still worth knowing: server error responses leak a raw stack trace unconditionally in every environment (`server/ai context/known-issues.md#ERR-1`), and the AI system prompt sent to OpenRouter is currently textually corrupted, degrading extraction quality (`server/ai context/known-issues.md#AI-1`). Don't fix items from these lists as a side effect of unrelated work — flag them and update `progress-tracker.md` if you do.
