# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

ExpenseTracker is a full-stack mobile expense-tracking app with two **fully independent, shipped** projects — there is no root `package.json`, no workspace, and no root-level lint/build/test command. Each has its own dependencies and must be worked on from within its own directory; there is no root-level script that operates on both at once.

- `client/` — Expo (React Native) app using file-based routing (`expo-router`). This is the app that ships (Android APK; the `web` target is used mainly for headless verification).
- `server/` — Express REST API on Prisma + Neon Postgres, deployed to Vercel (`server/vercel.json` builds `dist/server.js` as a single serverless function) at `https://exp2server.vercel.app`.

Two other top-level directories (`designbundle/`, a static design handoff bundle, and `xpnsapp/`, a non-shipping Expo app used purely as a visual reference) existed during `client/`'s first visual redesign and have since been deleted from the repo (`chore: remove design handoff bundle and xpnsapp reference scaffold`) — don't expect to find them. They're referenced throughout `client/ai context/specs/06-visual-redesign-xpnsapp-design-system.md` and other specs/progress-tracker entries as the historical source for that port; treat those mentions as history, not as pointers to files that still exist.

`client/`'s visual system went through a **second** full redesign — "Nocturne" (`client/ai context/specs/27-nocturne-visual-redesign.md`) — sourced from `Mobile app design project/` (also gitignored/untracked, same pattern as the two directories above: don't expect it to be on disk in a fresh checkout). It replaced `theme/`'s tokens, the shared component set, the tab bar (now Today · Activity · Add · Insights · Budgets, Ionicons-based), and all ten screens. Verified with a headless-browser click-through against the live deployed server; not yet verified on a real device. See that spec's Implementation notes for exactly what's still open.

Same for two other things the docs still name as if present:

- `Expense tracker app redesign/` — a gitignored, untracked reference snapshot (an older working copy of `client/` from a separate session) that specs 21–24 were ported back from on 2026-09-16. **It is no longer on disk**, only still listed in the root `.gitignore`. `client/ai context/progress-tracker.md` cites it as the source of those ports; that's history, not a path you can read.
- `feature-plan-proposals.md` — deleted (`chore: remove plan`) after most of it was approved and built; see `client/ai context/specs/12`–`18` and their `server/ai context/specs/` counterparts.

## Common commands

### server (run from `server/`)
- `yarn dev` — run the API locally with `ts-node-dev` (auto-restart, transpile-only) on `PORT` from `.env`.
- `yarn build` — compile TypeScript to `dist/` (`tsc`). `postinstall` runs `prisma generate`.
- `yarn start:prod` — run the compiled server (`node ./dist/server.js`).
- `yarn lint` / `yarn lint:fix` — ESLint over `src`. **Baseline is not clean**: 3 pre-existing errors in `builder/Queryuilder.ts`, `interface/index.d.ts`, `middleware/globalErrorHandler.ts`, plus 4 `no-console` warnings. Compare against that baseline instead of expecting zero output. (It was 4 errors until spec 18 incidentally cleared `app.ts`'s.)
- `yarn prettier` / `yarn prettier:fix` — format `src`.
- `yarn db:migrate` — `prisma migrate deploy`. Locally, new migrations are made with `npx prisma migrate dev --name <name>`.
- There is no test suite (`yarn test` is a stub that exits 1). Every spec in `ai context/` was verified by running `yarn dev` + curl against the real Neon dev database, with throwaway users cleaned up afterward by a temporary in-tree script — that is this repo's actual verification convention.
- Typecheck without emitting: `npx tsc --noEmit`.

### client (run from `client/`)
- `yarn start` / `yarn dev` — Expo dev server; `yarn web` — web target (port 8081).
- `yarn android` / `yarn ios` — `expo start --android` / `expo start --ios`. There is **no checked-in `android/`/`ios/` directory**. The Android widget (spec 26) and `expo-dev-client` were removed, so Expo Go runs the app again; the APK is built through EAS.
- `yarn lint` — `expo lint`. Typecheck: `npx tsc --noEmit`.
- `app.json` has `experiments.typedRoutes: true` — after adding a route file, typed routes must be regenerated (run `expo start`/`expo start --web` once) or `tsc --noEmit` will fail on the new href.
- `yarn reset-project` — Expo's scaffolding reset script (moves `app/` to `app-example/`, creates a blank one); do not run unless explicitly asked.

## How the two halves connect

- `client/utils/envConfig.ts` hardcodes `baseURL` and is **toggled by hand** between `http://localhost:5000` and the deployed URL (see commits `chore(client): point baseURL at local dev server` / `...back to the deployed server`). There is no env var. Check what it currently points at before debugging "the client isn't seeing my change"; don't commit a local URL.
- API surface, all under `/api` (`server/src/app/router/index.ts`): `/auth` (user), `/transactions`, `/transaction-requests`, `/categories`, `/budgets`, `/admin/error-logs` (errorLog), `/cron` (errorLog's cleanup).
- `/api/transaction-requests/ingest` is machine-to-machine (a separate `bikelog` project posts to it), authenticated by an `x-integration-key` header against `INTEGRATION_API_KEY`, not a JWT. Every route that isn't listed as an exception below uses the JWT `authCheck` middleware.
- `/api/cron/cleanup-error-logs` is a second non-JWT route: machine-to-machine, hit daily by `.github/workflows/daily-error-log-cleanup.yml` and authenticated by an `x-cron-secret` header against **`CRON_SECRET`** (a separate secret from `INTEGRATION_API_KEY` on purpose — that one is shared with `bikelog`, a different trust boundary). It deletes `error_logs` rows older than 30 days; Postgres has no equivalent to Mongo's TTL-index sweep, so expiry must be triggered externally. Needs `CRON_SECRET` in `server/.env`, in Vercel project settings, and as a GitHub repo secret alongside `API_BASE_URL`.
- **Errors are recorded automatically** (spec 17). `globalErrorHandler` `await`s an `errorLog` insert on every error response, inside its own try/catch — a logging failure can never change the client's response. The `await` is deliberate: on Vercel an invocation can be torn down once the response flushes. Read them at `GET /api/admin/error-logs` (+ `/:id`), `authCheck` + the new `adminCheck`.
- **Login issues two tokens, and the pair is stateless** (`server/ai context/specs/18`, `client/ai context/specs/39`). `POST /api/auth/login` returns a **15-minute** access token in `token` and a **15-day** refresh token in `refreshToken`; `POST /api/auth/refresh-token` (body `{ refreshToken }`, **no `authCheck`** — that's the third non-JWT route) mints a fresh access token and returns the same refresh token unchanged. Neither token is stored server-side: there is no denylist, no `jti`, and therefore **no logout endpoint** — logging out is a client-side token wipe, and a stolen access token stays valid for up to 15 minutes. Revocation is via `isDeleted`, which `refreshAccessToken` re-reads from the DB on every refresh, so a soft-delete or a role change lands within 15 minutes without a re-login.
  - The two tokens are signed with **two independent secrets** (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — the first was renamed from `JWT_SECRET`, so an environment still carrying the old name fails loudly) **and** carry a `type: "access" | "refresh"` claim that both verify paths check. Either defence alone would do; both are there because one shared secret would let a 15-day refresh token pass `authCheck` and buy a 15-day session. The two TTLs are **literals in `user.services.ts`**, not config — `@types/jsonwebtoken` types `expiresIn` as a template-literal union that a `string | undefined` from `process.env` can't satisfy.
  - **Spec 18 is deployed** (re-probed 2026-10-14, correcting an earlier claim here that it wasn't): `POST /api/auth/refresh-token` on `https://exp2server.vercel.app` returns **401** (`"Refresh token is invalid or expired, please login again"`), not 404, and `GET /api/admin/error-logs` returns 401 — so spec 17 is live too. **One caveat:** that 401 does *not* prove `JWT_REFRESH_SECRET` is set in Vercel, because `Jwt.verify` with an `undefined` secret throws into the same catch and the same message; only a real login followed by a successful refresh distinguishes them. Deploying remains `yarn build` + a deploy from `server/`, since `server/vercel.json` serves the gitignored `dist/server.js` and a `git push` ships nothing.
- **`userRole` is live now, but only on the error-log admin routes.** The JWT payload carries it (`user.services.ts`), so a token minted before spec 17 has no claim and `adminCheck` 403s it until re-login. There is no promotion endpoint — making an admin is a direct DB write, by documented convention.
- **404s go through the error handler, not around it.** `app.ts`'s catch-all is mounted **before** `globalErrorHandler` and hands off via `next(new AppError(404, "API NOT FOUND!"))`, so unmatched routes are logged like every other failure. The previous order (handler first, 404 responding directly) is why no 404 was ever logged. The 404 body therefore carries `errorSources`, not the old `error: { path, message }`; `message` is unchanged and nothing in `client/` reads either field. 404 log rows store no `stack` — it is synthetic, and bot scans make them the highest-volume row type.
- `server/src/app.ts`'s CORS allowlist is localhost-only (5173/5174/3000/3001/8081). Native clients don't do CORS so this doesn't affect the shipped app; it does affect the web target.
- There is no shared types package — `TTransaction` and friends exist independently on both sides and have drifted; keep them in sync by hand (`client/ai context/known-issues.md#TYPE-2`).

## Database (server)

Prisma Client with `@prisma/adapter-neon` (`src/app/lib/prisma.ts`, a singleton stashed on `globalThis` outside production). Two connection strings in `.env`: runtime uses pooled `DATABASE_URL`; `prisma.config.ts` points migrations at **`DATABASE_URL_UNPOOLED`** — a migration that appears to hit the wrong database is usually that split. `prisma/schema.prisma` intentionally declares no `url` on the datasource (it comes from the adapter/config).

All six modules (`user`, `transaction`, `transactionRequest`, `category`, `budget`, `errorLog`) are Prisma-native; no Mongoose models remain anywhere in `src/`. `mongoose` is still a dependency and still imported in exactly three files — `Error/handleCatError.ts` and `Error/handleValidationError.ts` (type-only `CastError`/`ValidationError` annotations on branches Prisma can never reach) and the unused `builder/Queryuilder.ts`. That's a flagged, deliberate exception, not an oversight; removing the package means touching those files first (it's item 1 in `server/ai context/progress-tracker.md`'s Next Up).

`server/scripts/migrate-to-postgres.ts` (never imported by the app, never run automatically) is the one-off Mongo→Postgres data copy, driven by `MONGO_MIGRATION_URI`. **Status caveat:** `progress-tracker.md`'s spec-03 section still has the production cutover checkboxes unticked ("the app is still live on Mongoose", written 2026-09-03), but the code has had no Mongoose data access since that same migration — anything deployed from current `master` is necessarily Postgres-backed. Treat that section as a stale snapshot and confirm the live `DATABASE_URL` with the user rather than trusting either statement.

## Source of truth

Each side has its own `ai context/` folder (note the literal space in the folder name — quote the path in shell commands) with a written source of truth: what the code actually does today, numbered invariants, conventions, a ranked known-issues backlog, workflow rules, and spec/progress-tracker scaffolding for future work. **Read the relevant one before making architectural decisions — don't restate its content here, and don't let this file and those docs drift apart.**

Read in this order, on either side:
1. `project-overview.md` — what it does, module/screen map, domain model
2. `architecture.md` — request lifecycle / provider stack, auth model, numbered invariants
3. `code-standards.md` — naming, validation, error handling, component organization
4. `known-issues.md` — ranked bug backlog (~35 server, ~18 client findings)
5. `ai-workflow-rules.md` — scoping rules, protected files, verify-before-moving-on checklist
6. `progress-tracker.md` — current state, known gaps, next up
7. `specs/00-build-plan.md` — how to scope new work

**Known doc drift (verify against code before relying on these two):** `server/ai context/architecture.md` predates the `category`/`budget`/`transactionRequest` modules and the receipt-upload and trend endpoints. `client/ai context/architecture.md`'s routing section predates specs 14/16 **and** the Nocturne redesign (spec 27) — the tab bar is now Today (`index`) · Activity (`monthlyTransactions`) · Add (`addTransaction`) · Insights (`history`) · Budgets (`budgets`, now visible, not `href: null`); `settings`/`smart-add`/`transaction-requests` stay `href: null` but are reached differently than the doc describes (avatar → Settings and tray icon → Requests on Today, not a gear icon or an Add-screen button). `progress-tracker.md` on each side is the more current of the two.

### Working conventions worth knowing up front
- Plans go in `ai context/specs/` as numbered markdown files (`NN-kebab-title.md`) with their own "Verify when done" checklist, and get a row in that side's `progress-tracker.md`. Superseded specs are renumbered to the end and marked ⛔ rather than deleted.
- Don't fix items from `known-issues.md` as a side effect of unrelated work — flag them, and if you do fix one, say so in `progress-tracker.md`.

## Client specifics that aren't obvious from one file

- Data flow is `utils/axiosInstance.ts` → `utils/api.ts` → `hooks/useApi.ts` (TanStack Query wrappers) → screens. Use the hooks, not axios directly.
- **Tokens go through `utils/tokenStorage.ts`, never `AsyncStorage` directly.** It writes to `expo-secure-store` (Keychain/Keystore) on native and falls back to `AsyncStorage` on web, keeps an in-memory mirror so the request interceptor can read the access token synchronously instead of awaiting the Keychain per request, and clears the pre-spec-39 `"token"` key on logout. `expo-secure-store` is a native module, so **spec 39 needs a new EAS build** and signs every existing install out once (Expo Go already bundles it).
- **A 401 is routine, not a logout.** `axiosInstance`'s response interceptor refreshes once (single-flight, via `utils/refreshToken.ts`, with a `_retry` flag so one request can't loop) and replays the original request, so a 15-minute expiry is invisible. Only a refresh that comes back `null` ends the session, through `utils/authEvents.ts` → `UserProvider.logoutFunction`. A refresh that never reached a server is treated as a network failure and **keeps** the session. Worth knowing before adding rate limiting: `refreshToken.ts` reads every non-401 response (429, 500) as a dead session, so throttling `/auth/refresh-token` would log users out.
- Colors always come from `theme/`'s `useTheme()`. Since the Nocturne redesign, theme also has a manual override: `useThemePreference()` (Dark/Light/System, AsyncStorage-persisted, wired up in Settings) sits alongside `useTheme()` in the same `ThemeContext.tsx` — `useTheme()` itself still just returns the resolved `ColorScheme`, so old call sites didn't need to change.
- Icons: since the Nocturne redesign, UI chrome (tab bar, buttons, headers, empty/error states) uses `Ionicons`; `MaterialCommunityIcons` is kept only for category icons (`category.icon`, `CATEGORY_ICON_OPTIONS`) since that's what's already stored in the database. Don't reintroduce MCI for chrome or Ionicons for category pickers — that split is deliberate, not incidental.
- `types/Transaction.tyes.ts`'s filename typo is load-bearing across ~13 imports — renaming it is a full grep-and-fix change, not a rename.

## Highest-severity gotchas (full detail in the docs above)

`known-issues.md` on both sides is a **frozen point-in-time snapshot** — it is not pruned as items get fixed. `progress-tracker.md`'s Known Gaps checklist is the current-status source of truth; check it before treating any entry below (or any entry in those files) as still open.

**Server:**
- There's no schema validation on the AI-parsed transaction output before it reaches the DB (`#AI-2`, item 2 in Next Up).
- `#ERR-2` can still put a raw driver string into an error's top-level `message`, which is **not** environment-gated — so don't put sensitive detail in a `message` (it is near-unreachable in practice: its trigger is the Mongo code `11000` and no Mongoose data access remains).
- Resolved, despite still appearing in `known-issues.md`: `#AUTH-1` (IDOR on transaction update/delete), `#AUTH-10` (missing already-deleted check), `#AUTH-2` (unauthenticated `manage-money` route), `#AI-1`/`#AI-3`/`#AI-4`/`#AI-5` (AI prompt + call), and — by `server/ai context/specs/19` (2026-10-14) — `#AUTH-3` (the password hash is no longer in the register/login response; both now return an explicit allowlist, and login deliberately keeps `userRole` because it is the only place the client can learn it) and `#ERR-1` (the response `stack` is gated on `NODE_ENV === "development"`, fail-closed, and is still stored on the `error_logs` row for admins). **Spec 19 is code-complete but not yet deployed**, so the live API still leaks both until `yarn build && npx vercel --prod` runs; it also adds one per-machine action, `NODE_ENV=development` in the gitignored `server/.env`, without which local error responses carry no stack.

**Client:**
- The axios response interceptor never rejects on HTTP errors (`return error`, not `Promise.reject(error)`) — every downstream `onError`/`catch` around a mutation is dead code; the interceptor's own Toast is the only real error surface today (`#FETCH-1`, item 1 in Next Up). It is now **load-bearing**: the silent-refresh retry resolves as `{ data, meta }` only because the error path resolves rather than rejects, so fixing it means re-checking that path (client spec 39 D6a).
- **`expo-linear-gradient` is an unmet peer dep of `react-native-gifted-charts`, not dead weight.** No first-party file imports it, so a source grep says it's unused — but `gifted-charts`' `common/LinearGradient.js` `throw`s at *module scope* on `BarChart`'s import chain, so removing it crashes the app at bundle evaluation on every platform with "Gradient package was not found". It was removed once as unused (`72c7c78`) and restored under `specs/40`. Check `node_modules` consumers, not just `grep`, before pruning a dependency here.
- `Alert.alert` no-ops on the web target, so confirm dialogs silently do nothing there (`#UX-3`). `SettingsPage` uses `window.confirm` on web instead, which a headless Playwright run auto-dismisses — pass `page.on('dialog', d => d.accept())` or logout will look broken when it isn't.
- Resolved: `#TYPE-1`'s three-copies-of-the-transaction-type enum (import the enum only from `constants/TransactionType.constant.ts`), and `#AUTH-2`'s 401-doesn't-clear-in-memory-state (closed by `specs/39`, which built spec 25's logout bridge as a prerequisite — `25` is ⛔ superseded, kept for its rationale).
