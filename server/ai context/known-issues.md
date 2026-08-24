# Known Issues — Server

Ranked backlog of real bugs and inconsistencies found in this codebase, grouped by module. These are documented, not fixed — don't silently patch one while working on something else without flagging it in `progress-tracker.md`.

## Severity legend

**Critical** — data integrity or security compromise, exploitable today. **High** — real bug or live cost/leak, narrower blast radius. **Medium** — real but requires specific conditions. **Low** — cosmetic, dead code, or a nice-to-have.

## At a glance (Critical + High only)

| ID | Severity | Issue |
|----|----------|-------|
| AUTH-1 | Critical | No ownership check on transaction update/delete (IDOR) |
| AUTH-2 | Critical | `POST /transactions/manage-money` has no `authCheck` |
| AUTH-3 | High | Password hash returned to the client on register and login |
| VALID-1 | High | `POST /transactions/many-transaction` has zero request validation |
| ERR-1 | High | Stack trace returned in every JSON error response, unconditionally |
| AI-1 | High | The AI system prompt string is corrupted (broken feature output) |

## Auth, Authorization & Credentials (`AUTH-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| AUTH-1 | Critical | `updateTransaction`/`deleteTransactionData` look up a transaction by `_id` only — neither checks the caller owns it. | `transaction.service.ts:196-233`, confirmed the controllers never pass `req.user.userId` into either call (`transaction.controller.ts`) | Any authenticated user who knows/guesses another user's `transactionId` can edit or soft-delete it. |
| AUTH-2 | Critical | `router.post("/manage-money", transactionControllers.moneyManagement)` has no `authCheck`, unlike every other transaction route. | `transaction.route.ts:53` | Public, unauthenticated path to a paid OpenRouter call — a cost/abuse vector against your own API key. |
| AUTH-3 | High | `createUser`/`loginFromDb` return the raw Mongoose document (including the hashed `password`) and the controllers send it straight through as `data`. No `.select("-password")`, no `toJSON` transform. | `user.services.ts:11-15,50-53`, `user.controller.ts:7-31`, `user.model.ts` | The argon2 hash leaves the server on every register/login response. |
| AUTH-4 | Medium | `authCheck` only verifies the JWT signature/expiry (`Jwt.verify`) and does `req.user = decoded` — it never re-fetches the user from the DB. | `authCheck.ts:23,33` | A soft-deleted user (`isDeleted:true`) or a user whose data changed still has a fully valid session until the token's 10-day expiry. |
| AUTH-5 | Medium | Only a single access token is issued, `expiresIn: "10d"`, no refresh flow, rotation, or revocation/blacklist. The config field is named `jwt_secret` (env `JWT_ACCESS_SECRET`), implying a paired refresh secret was anticipated but never built. | `user.services.ts:46-48`, `config/index.ts:11` | A stolen token is valid for up to 10 days with no way to revoke it short of rotating the secret for everyone. |
| AUTH-6 | Low | Every `Jwt.verify` failure — malformed token, bad signature, or actually expired — is reported with the identical message `"Token expired , Please login to continue"`. | `authCheck.ts:24-30` | Misleading error for non-expiry failures; harmless but imprecise. |
| AUTH-7 | Low | `userRole` (`"admin" \| "user"`) exists on `TUser`/`userModel` (default `"user"`) but is never read by any middleware, never included in the JWT payload (only `userId`/`userEmail` are signed), and there are zero role-gated routes. | `user.model.ts:27-30`, `user.services.ts:41-44` | Fully dead field — don't assume any admin/role gating exists anywhere in this API. |
| AUTH-8 | Low | No email normalization anywhere — Zod doesn't `.toLowerCase()`/`.trim()`, and the Mongo `unique:true` index on `email` is case-sensitive by default. | `user.validation.ts`, `user.model.ts:11-15` | `Test@x.com` and `test@x.com` can register as two distinct accounts; login lookup is also case-sensitive. |
| AUTH-9 | Low | `loginFromDb` throws `404 "User dont exist with this email"` for a missing user vs `403 "Password don't match"` for a wrong password — the two cases are distinguishable from the response. | `user.services.ts:25-39` | Classic user-enumeration gotcha; may be an acceptable tradeoff for a personal app, but worth knowing. |
| AUTH-10 | Medium | `deleteTransactionData` fetches with a plain `findById` (no `isDeleted:false` filter) before soft-deleting, unlike `updateTransaction` which does filter on `isDeleted:false` and throws if already deleted. | `transaction.service.ts:215-220` vs `196-203` | Calling delete on an already-deleted transaction silently "succeeds" again (no-op) instead of erroring — inconsistent with update's behavior. |

## Validation (`VALID-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| VALID-1 | High | `addManyTransaction` (bulk create) has no `validateRequest` schema at all — relies solely on Mongoose schema validation inside `insertMany`. | `transaction.route.ts:46-50` | Unvalidated bulk payloads (e.g. straight from the AI parsing flow, see AI-2) can reach the DB with only loose Mongoose-level checks. |
| VALID-2 | Medium | `moneyManagement` also has no `validateRequest` — `req.body?.prompt` is read raw with no length/type check. | `transaction.route.ts:53` | An empty, absurdly long, or non-string prompt is sent to OpenRouter as-is. |
| VALID-3 | Medium | `validateRequest` only ever validates `{ body: req.body }` — `params` and `query` are never run through Zod anywhere (`transactionId` route params, `targetMonth`/`targetYear` query params are used unvalidated/uncast in the service layer). | `validateRequest.ts:7-9` | Malformed `targetMonth`/`targetYear` (e.g. non-numeric) flows straight into date construction with no guard. |
| VALID-4 | Low | Zod requires `amount.positive()` (>0) on the one route that validates, but the Mongoose model only enforces `min: 0`. | `transaction.validation.ts:8`, `transaction.model.ts:27-31` | `addManyTransaction`, which skips Zod (VALID-1), could persist `amount: 0`, which the validated single-create route blocks. |
| VALID-5 | Low | `description` is required (non-optional) on `TTransaction` the interface, not marked required in the Mongoose schema, and `.optional()` in both Zod schemas — a three-way mismatch. | `transaction.interface.ts:8`, `transaction.model.ts:24-26`, `transaction.validation.ts:7,16` | Interface promises a guarantee the schema/validation don't actually enforce. |

## Error Handling (`ERR-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| ERR-1 | High | `res.status(status).json({ ..., stack: error?.stack })` — the stack trace is returned in every error response, unconditionally, not gated on `NODE_ENV`. | `globalErrorHandler.ts:65-70` | Internal file paths and line numbers leak to every API consumer in every environment, including production on Vercel. |
| ERR-2 | Medium | `handleDuplicateError`'s regex `/\s*"([^"]+)"/` extracts the *first quoted substring* from the raw Mongo error message — for a typical `E11000 ... dup key: { email: "foo@bar.com" }` error this captures the submitted email value itself, producing `"foo@bar.com is already exist"`. It also returns `message: error?.message` — the raw Mongo driver string — directly into the response's top-level `message`. | `handleDuplicateError.ts:6-14,22` | Confusing user-facing message; also leaks raw driver/index internals in `message`. |
| ERR-3 | Low | `handleValidationError.ts` hardcodes `message: "mongoose ValidationError"` (generic) while `errorSources` carries the real per-field messages. | `handleValidationError.ts` | Top-level message is uninformative even though the detail exists elsewhere in the payload. |
| ERR-4 | Low | `AppError` uses `.status` as its property name; the global handler reads `error.status` for `AppError`/generic errors but other error types are reconciled via a local `simplifiedError.statusCode`. Two different property names (`status` vs `statusCode`) coexist across the error type hierarchy. | `AppError.ts`, `globalErrorHandler.ts:16,60` | Purely a naming inconsistency; works today because the handler reconciles it manually — a new error type must follow whichever convention it copies. |
| ERR-5 | Low | The handler is two separate `if / else-if` chains (`ZodError → else-if ValidationError`, then `CastError → else-if duplicate → else-if AppError`) rather than one chain. | `globalErrorHandler.ts:27-63` | Works today by mutual exclusivity, but a new branch added to one chain must also be excluded from the other or it can double-process/overwrite `status`/`message`. |
| ERR-6 | Low | `globalErrorHandler` is mounted before the catch-all 404 handler (`app.ts:47` then `:50`). | `app.ts` | Unconventional order; an error thrown from inside the 404 handler itself has no error middleware left to catch it. |

## AI Parsing Subsystem (`AI-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| AI-1 | High | The system prompt string sent to the model is textually corrupted: line "cashback" reads `"cashnvidia/nemotron-3-nano-30b-a3b:freeback"`, and a stray `nvidia/nemotron-3-nano-30b-a3b:free` is inserted mid-sentence between the amount-detection bullets and the "Title Generation" heading — the model id string was apparently pasted over prompt text by a find-and-replace and shipped as-is. | `transaction.service.ts:251,259` | The actual instructions the model receives are corrupted mid-sentence in two places — directly hurts extraction quality for the feature this endpoint exists to provide. |
| AI-2 | Medium | After `JSON.parse` succeeds, the parsed value is returned with **no schema validation** — no check it's an array, no check each item has valid `type`/`amount`/`title`, no check `type` is exactly `"income"`/`"expense"`, and nothing strips markdown code fences (```` ```json ... ``` ````) that LLMs commonly wrap output in despite the prompt's "NO markdown" instruction. | `transaction.service.ts:336-348` | A fenced or shape-invalid response either throws a generic 400 or — if it happens to parse — flows unvalidated into `addManyTransaction` (VALID-1). |
| AI-3 | Low | `temperature: 0.7` is used for what's meant to be deterministic structured-JSON extraction. | `transaction.service.ts:333` | Increases the odds of malformed/inconsistent JSON output for a task where determinism matters more than creativity. |
| AI-4 | Low | `response.choices[0].message?.content` is read with no check that `choices` is non-empty before indexing. | `transaction.service.ts:336` | A `choices[0]` of `undefined` throws a raw `TypeError`, surfaced as a generic 500 with a leaked stack (ERR-1). |
| AI-5 | Low | Model id is hardcoded (`"nvidia/nemotron-3-nano-30b-a3b:free"`) with two other model ids left commented out directly above it. | `transaction.service.ts:238-240` | Dead/leftover experimentation code, not a bug, but signals the model choice wasn't finalized deliberately. |

## Date / Reporting Logic (`DATE-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| DATE-1 | Medium | `getMonthlyTransactions` and `getDailyTransactions` build range boundaries with `new Date(year, month-1, 1, ...)` — the **local** `Date` constructor — even though the year/month/day components were pulled from UTC getters (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`). `getYearlySummary`/`getWeeklySummary` instead use `Date.UTC(...)`/`setUTCDate`/`setUTCHours` throughout — genuinely UTC-safe. | `transaction.service.ts:35-36,94-112` vs `143-144,355-373` | Monthly/daily boundaries are actually computed in the server process's local timezone, not UTC — inconsistent with the yearly/weekly logic and fragile if the deployment's `TZ` isn't UTC. |
| DATE-2 | Low | Month indexing is inconsistent across endpoints: `getMonthlyTransactions` builds `dateString` with a 1-indexed `month` (query param, 1-12), while `getYearlySummary`'s `monthlySummary`/`result` keys are 0-indexed (`getUTCMonth()`, 0-11, returned as-is). | `transaction.service.ts:65` vs `165-186` | A consumer must know which endpoint uses which convention — don't assume they match. |

## Config & Environment (`CFG-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| CFG-1 | Medium | Zero validation that required env vars are actually set — no schema, no startup assertion. Missing `DATABASE_URL` fails only when `mongoose.connect` is called, and `server.ts`'s catch block just `console.log`s and lets the process keep running/listening anyway. | `config/index.ts`, `server.ts` | The app can appear "up" (serving `GET /`) with a completely broken DB connection. |
| CFG-2 | Low | `openRouterApiKey` is camelCase while every other config field (`node_env`, `port`, `database_url`, `jwt_secret`) is snake_case, and the underlying env var name (`openRouterApiKey`) breaks the UPPER_SNAKE_CASE convention every other `.env` key follows. | `config/index.ts:12` | Purely a naming inconsistency to be aware of when adding new config. |
| CFG-3 | Low | `.env` contains `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `DATABASE_URL2` — none of which `config/index.ts` reads. | `.env`, `config/index.ts` | Dead env vars; line up with unused `cloudinary`/`multer`/`multer-storage-cloudinary` deps (NAME- section) — safe to ignore, not wired to anything. |
| CFG-4 | Low | The CORS allowlist in `app.ts` is a hardcoded array including `https://devmats.vercel.app` and `https://dev-mats.vercel.app` — domains that don't match this project's name at all. | `app.ts:16-30` | Almost certainly copy-pasted from a different project; adding this project's real frontend domain requires a code change + redeploy either way since there's no env-driven origin list. |

## Naming / Dead Code (`NAME-`) — cosmetic, safe to batch-clean later

| ID | Issue | Location |
|----|-------|----------|
| NAME-1 | `builder/Queryuilder.ts` — filename and class both misspelled (`Queryuilder`), and it is entirely unused anywhere in `src` (`transaction.service.ts` builds its own ad hoc filtering instead). | `builder/Queryuilder.ts` |
| NAME-2 | `modules/user/user.services.ts` (plural) vs `modules/transaction/transaction.service.ts` (singular) — inconsistent file-naming between the two modules' service layers (export names `userServices`/`transactionServices` are both plural, so only the filenames diverge). | — |
| NAME-3 | The `user` module folder is mounted at route prefix `/api/auth`, not `/api/users` — folder name and route prefix diverge (the `transaction` module's folder matches its `/transactions` prefix). | `router/index.ts:12-15` |
| NAME-4 | `deleteTransactionData` is wired to `router.patch("/delete-transaction/:transactionId", ...)` — an HTTP PATCH, not DELETE, for an endpoint literally named "delete" (consistent with soft-delete semantics, but a REST-verb/naming mismatch). | `transaction.route.ts:64-68` |
| NAME-5 | Controller local const/export is named `crateUser` (typo for `createUser`); the service method it calls is correctly spelled `createUser`. | `user.controller.ts:7,35` |
| NAME-6 | `package.json`'s `"name"` field is still `"l2-boiler"` — the project's original bootstrap-boilerplate name. | `package.json` |
| NAME-7 | `dist/` contains stale compiled artifacts (`dist/app/modules/boilerModule/*`, `dist/app/util/SendImageCloudinary.js`) with **no corresponding source anywhere in `src/`** — `dist/` is stale relative to `src/` and includes a demo module and Cloudinary upload helper that were deleted from source but never rebuilt out of `dist/`. | `dist/` |
| NAME-8 | `bcrypt` is a listed `package.json` dependency with zero usages anywhere in `src` — the actual hashing library used is `argon2`. | `package.json`, `user.model.ts:1`, `user.services.ts:1,32` |

## App Bootstrap (`APP-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| APP-1 | Low | `cookie-parser` is installed and applied, and CORS sets `credentials: true`, but no code anywhere reads or sets cookies — auth is purely Bearer-token-in-header (`authCheck.ts` reads `req.headers.authorization`). | `app.ts:5,16-30,33` | Dead boilerplate carryover; harmless but don't assume cookie-based session state exists anywhere. |
| APP-2 | Low | `morgan("dev")` request logging runs unconditionally, not gated by `NODE_ENV`. | `app.ts` | Verbose request logging runs in production/Vercel too. |
| APP-3 | Low | Routes are mounted at plain `/api` (`/api/transactions/...`, `/api/auth/...`) — not versioned under `/api/v1`. | `app.ts:36`, `router/index.ts` | If versioning is ever needed, it's a breaking route change, not additive. |
| APP-4 | Medium | `server.ts` calls `mongoose.connect()` once at module load with no guard checking `mongoose.connection.readyState` before reconnecting — typically needed on serverless platforms to avoid exhausting DB connections across cold starts/concurrent invocations. | `server.ts` | Potential connection exhaustion under concurrent Vercel invocations; not confirmed to have caused an incident, but a known serverless+Mongoose footgun. |
| APP-5 | Low | `unhandledRejection`/`uncaughtException` process handlers exist in `server.ts` but are commented out. | `server.ts:23-37` | Uncaught async errors outside Express's request cycle currently have no last-resort handler. |
