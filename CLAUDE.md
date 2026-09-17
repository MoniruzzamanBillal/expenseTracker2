# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

ExpenseTracker is a full-stack mobile expense-tracking app with two **fully independent, shipped** projects — there is no root `package.json`, no workspace, and no root-level lint/build/test command. Each has its own dependencies and must be worked on from within its own directory; there is no root-level script that operates on both at once.

- `client/` — Expo (React Native) app using file-based routing (`expo-router`). This is the app that ships.
- `server/` — Express REST API, deployed to Vercel as a serverless function. Mid-migration from MongoDB/Mongoose to Postgres/Prisma — see the note below before assuming which one is authoritative for a given piece of code.

Two other top-level directories (`designbundle/`, a static design handoff bundle, and `xpnsapp/`, a non-shipping Expo app used purely as a visual reference) existed during `client/`'s visual redesign and have since been deleted from the repo (`chore: remove design handoff bundle and xpnsapp reference scaffold`) — don't expect to find them. They're referenced throughout `client/ai context/specs/06-visual-redesign-xpnsapp-design-system.md` and other specs/progress-tracker entries as the historical source for that port; treat those mentions as history, not as pointers to files that still exist.

`Expense tracker app redesign/` (note the spaces — quote the path) is a **gitignored, untracked reference snapshot**: an older working copy of `client/` (same file structure, same `ai context/specs/` convention) produced in a separate session, used as a source to diff against and port small already-implemented specs back into the real `client/`. It is not a live project, has no relationship to `server/`'s current state, and its own `ai context/progress-tracker.md` is stale (doesn't reflect which of its specs were actually ported back — check the real `client/ai context/progress-tracker.md` for that). Specs 21–24 were ported from it into `client/` on 2026-09-16; treat it as a diff source for future porting work, not as documentation of current app behavior.

`feature-plan-proposals.md`, previously referenced here as a pending, not-yet-approved set of feature proposals (categories, budgets, recurring transactions, receipt photos, charts/trends, export, AI insights), was deleted from the repo (`chore: remove plan`) after most of it was approved and built — see `client/ai context/specs/12` through `18` and their `server/ai context/specs/` counterparts. Don't look for that file; it no longer exists.

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

**In-progress DB migration (server):** the `user` and `transaction` modules' data-access code now runs on Prisma/Postgres (`server/prisma/schema.prisma`, `server/src/app/lib/prisma.ts`) — `specs/02-migrate-user-transaction-modules-to-prisma.md` is complete, `mongoose` is gone from those two modules. Mongoose still lingers in a handful of unrelated files outside that scope (`handleCatError.ts`/`handleValidationError.ts` for type-only `CastError`/`ValidationError` annotations, and the unused `Queryuilder.ts`) — don't treat that as "the migration isn't real," it's a flagged, deliberate exception, not an oversight. The real-data copy (`specs/03-migrate-mongodb-data-to-postgresql.md`, via the standalone `server/scripts/migrate-to-postgres.ts` — never imported by the app, never run automatically) is in progress; check `progress-tracker.md` for current status before assuming Postgres already holds the full, final dataset or that cutover (swapping the deployed app's `DATABASE_URL`) has happened — as of writing it has not, production is still Mongoose-backed.

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
- Password hashes are returned to the client on both register and login — no field is stripped before the response goes out (`server/ai context/known-issues.md#AUTH-3`).
- (`#AUTH-1`/IDOR on transaction update/delete, `#AUTH-10`/missing already-deleted check, `#AUTH-2`/unauthenticated `manage-money` route, and `#AI-1`/`#AI-3`/`#AI-4`/`#AI-5` on the AI prompt+call are all **resolved** — see `progress-tracker.md`'s Known Gaps for what fixed each and when. `known-issues.md` itself is a frozen backlog snapshot and doesn't get pruned as items are fixed; `progress-tracker.md` is the current-status source of truth, so check it — not just the inline gotchas here — before assuming an issue from that file is still live.)

**Client:**
- The axios response interceptor never rejects on HTTP errors (`return error`, not `Promise.reject(error)`) — every downstream `onError`/`catch` around a mutation is dead code; the interceptor's own Toast is the only real error surface today (`client/ai context/known-issues.md#FETCH-1`).
- On a 401, `AsyncStorage` is cleared but `UserProvider`'s in-memory state isn't — the UI can look "still logged in" until reload or manual logout (`#AUTH-2`).
- (`#TYPE-1`'s three-independent-copies-of-the-enum issue is **resolved** — the duplicate copies were removed during the client's visual redesign; see `progress-tracker.md`'s Known Gaps for what changed and when. Import the enum only from `constants/TransactionType.constant.ts` in new code regardless.)

## Known issues

The full ranked backlogs live in `server/ai context/known-issues.md` and `client/ai context/known-issues.md`, grouped by module with severity tags — but that file is a point-in-time snapshot, not kept in sync as items get fixed, so cross-check `progress-tracker.md`'s Known Gaps checklist for current status before treating any entry as still open. Notably absent from the inline list above but still worth knowing: server error responses leak a raw stack trace unconditionally in every environment (`server/ai context/known-issues.md#ERR-1`), and there's no schema validation on the AI-parsed transaction output before it reaches the DB (`#AI-2`). Don't fix items from these lists as a side effect of unrelated work — flag them and update `progress-tracker.md` if you do.
