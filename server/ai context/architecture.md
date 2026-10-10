# Architecture — Server

## Stack

| Layer | Choice |
|---|---|
| Runtime/framework | Node.js + Express 4, TypeScript |
| Database | MongoDB via Mongoose |
| Hosting | Vercel serverless function (`dist/server.js` via `@vercel/node`, see `vercel.json`) |
| Auth | JWT bearer token, `argon2` for password hashing |
| AI provider | OpenRouter (`openai` SDK pointed at `https://openrouter.ai/api/v1`) |
| Validation | Zod, body-only |

## Request lifecycle

`route.ts` (wires `authCheck` + `validateRequest`) → `controller.ts` (thin, wrapped in `catchAsync`, replies via `sendResponse`) → `service.ts` (business logic + all Mongoose queries) → `model.ts`.

`validateRequest` only ever validates `{ body: req.body }` — route `params` and query strings are never run through Zod anywhere in this codebase (→ `known-issues.md#VALID-3`).

## Module boundaries

Two modules under `src/app/modules/`: `transaction` and `user`. `src/app/router/index.ts` mounts them:

- `transaction` → `/api/transactions` (folder name matches route prefix)
- `user` → `/api/auth`, i.e. `/api/auth/register`, `/api/auth/login` (folder name does **not** match route prefix — → `known-issues.md#NAME-3`)

## Auth model — as it actually behaves today

- Bearer JWT only. `middleware/authCheck.ts` reads `Authorization: Bearer <token>`, verifies it with `Jwt.verify`, and attaches the raw decoded payload as `req.user` (`{ userId, userEmail }`) — it does **not** re-fetch the user from the database on every request (→ `known-issues.md#AUTH-4`).
- A single access token is issued at login, `expiresIn: "10d"`. There is no refresh token, rotation, or revocation mechanism, even though the config field name (`JWT_ACCESS_SECRET`) implies a paired refresh secret was once planned (→ `known-issues.md#AUTH-5`).
- Every transaction route requires `authCheck` **except** `POST /transactions/manage-money`, which is intentionally left open in the route file but has no compensating rate-limit or cost guard (→ `known-issues.md#AUTH-2`).
- `user.route.ts`'s `/register` and `/login` correctly have no `authCheck` (they can't — that's how you get a token).
- There is no role/permission model enforced anywhere. `userRole` exists on the schema but is dead code (→ `known-issues.md#AUTH-7`).

## AI parsing subsystem

`POST /transactions/manage-money` → `transactionServices.moneyManagement` (`transaction.service.ts`) sends a free-text prompt plus a large system prompt to a hardcoded OpenRouter model id, parses the JSON response, and returns the parsed array to the caller — it does **not** persist anything itself. The client is expected to review/edit the result and then call `/new-transaction` or `/many-transaction` separately to actually save it.

The system prompt currently shipped has a text-corruption bug and the parsed output receives no schema validation before being returned — full detail at `known-issues.md#AI-1` and `#AI-2`. Don't restate those specifics here; if you touch this function, read that section first.

## Configuration

`config/index.ts` loads `.env` via `dotenv` and exposes:

| Field | Env var | Notes |
|---|---|---|
| `node_env` | `NODE_ENV` | |
| `port` | `PORT` | |
| `database_url` | `DATABASE_URL` | no startup validation that this is set — → `known-issues.md#CFG-1` |
| `jwt_secret` | `JWT_ACCESS_SECRET` | |
| `openRouterApiKey` | `openRouterApiKey` | camelCase env var name, inconsistent with the rest — → `known-issues.md#CFG-2` |

`.env` also holds `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`/`DATABASE_URL2`, none of which `config/index.ts` reads — dead (→ `known-issues.md#CFG-3`).

## Serverless considerations

`server.ts` connects to MongoDB once at module load and calls `app.listen()`; there's no `mongoose.connection.readyState` guard before reconnecting, which is the standard pattern needed to avoid connection exhaustion across Vercel cold starts/concurrent invocations (→ `known-issues.md#APP-4`). A failed DB connection doesn't stop the process from starting (→ `known-issues.md#CFG-1`).

## Soft delete & data model

Soft-delete is used throughout `Transaction` (`isDeleted` flag; all four report queries filter `isDeleted:false`; the "delete" endpoint just flips the flag to `true` via `PATCH`, not a real HTTP DELETE — → `known-issues.md#NAME-4`). There's no restore or list-deleted functionality. `User` also carries `isDeleted` but nothing currently reads/writes it outside the schema default.

Date-range logic for the four report endpoints (monthly/daily/yearly/weekly) is computed by hand in `transaction.service.ts`, not through `builder/Queryuilder.ts` (which is unused — → `known-issues.md#NAME-1`). The "week" is Friday–Thursday, anchored via `getUTCDay()` and a `diffToFriday` offset in `getWeeklySummary` — not the ISO Monday-start week.

## Error logging & retention (spec 17)

Every error response is also persisted. `globalErrorHandler` `await`s `errorLogServices.createErrorLog`
inside its own `try`/`catch` before replying — the `await` is deliberate (a Vercel invocation can be torn
down once the response flushes) and the local catch guarantees a logging failure never alters the client's
response. `app.ts`'s catch-all 404 is mounted **before** the error handler and hands off via
`next(new AppError(404, ...))`, so unmatched routes are logged too; the old order (handler first, 404
responding directly) is why no 404 was ever recorded, and that reordering resolves `known-issues.md#ERR-6`.
404 rows deliberately store no `stack` (synthetic, and bot scans make them the highest-volume row).

`error_logs` is read via `GET /api/admin/error-logs` (+ `/:id`), gated by `authCheck` + `adminCheck`.
`adminCheck` reads `userRole` from the JWT, which `user.services.ts`'s `jwtPayload` now carries — so a token
minted before spec 17 has no claim and is rejected until re-login. This is the only place `userRole` is
enforced; there is no promotion endpoint (admin is a direct DB write).

Retention is 30 days, deleted by `POST /api/cron/cleanup-error-logs` — no `authCheck`, guarded by an
`x-cron-secret` header against `CRON_SECRET`, driven daily by `.github/workflows/daily-error-log-cleanup.yml`
at the repo root. Postgres has no equivalent to Mongo's TTL-index sweep, so expiry must be externally
triggered. The window is rolling 30x24h evaluated once a day, i.e. retention is "at least 30 days, up to ~31".

The list endpoint **allowlists and coerces** its query params (`page`/`limit`/`sort`/`status`/`method`/`path`)
rather than spreading them into Prisma's `where`; `status` is an `Int` column, so a passed-through
`?status=500` string — or any unknown key — would be a `PrismaClientValidationError`, i.e. a 500.

## Numbered invariants

1. **Transactions have no ownership check on mutation.** `updateTransaction`/`deleteTransactionData` key off `_id` alone — do not assume any endpoint here scopes writes to the caller. → `known-issues.md#AUTH-1`
2. **A valid JWT does not guarantee a currently-valid user.** `authCheck` never re-queries the DB — a soft-deleted user's token still works until it expires. → `known-issues.md#AUTH-4`
3. **`manage-money` is unauthenticated by design, not by oversight — but has no other cost guard.** Treat any call to it as coming from an anonymous caller. → `known-issues.md#AUTH-2`
4. **A password hash currently leaves the server on register and login.** Don't assume the `User` document is ever safe to return as-is to a client. → `known-issues.md#AUTH-3`
5. **Every error response includes a raw stack trace, in every environment.** Don't add sensitive detail to an error's `message` assuming it's server-side-only. → `known-issues.md#ERR-1`
6. **`Transaction.description` is required in the TypeScript interface but not enforced by the Mongoose schema or Zod.** Don't trust `TTransaction`'s type as a runtime guarantee. → `known-issues.md#VALID-5`

Server TS has no `@/*` path alias — imports are relative. `dist/` is committed build output and is currently stale relative to `src/` (→ `known-issues.md#NAME-7`); don't hand-edit it.
