# Architecture — Server

## Stack

| Layer | Choice |
|---|---|
| Runtime/framework | Node.js + Express 4, TypeScript |
| Database | MongoDB via Mongoose |
| Hosting | Vercel serverless function (`dist/server.js` via `@vercel/node`, see `vercel.json`) |
| Auth | JWT: 15-minute access token (bearer) + 15-day refresh token, separate secrets (spec 18); `argon2` for password hashing |
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

- Bearer JWT only. `middleware/authCheck.ts` reads `Authorization: Bearer <token>`, verifies it against the
  **access** secret, requires a `type: "access"` claim, and attaches the decoded payload as `req.user`
  (`{ userId, userEmail, userRole, type }`) — it does **not** re-fetch the user from the database on every
  request (→ `known-issues.md#AUTH-4`, still open but narrowed to ≤15 minutes by the refresh path below).
- **Two tokens since spec 18** (`specs/18-access-refresh-token-auth.md`), issued together by `POST /api/auth/login`:
  a **15-minute access token** in the response's top-level `token` field, and a **15-day refresh token** in a new
  `refreshToken` field. `POST /api/auth/register` still issues neither. This resolves `known-issues.md#AUTH-5`.
- **The two are signed with different secrets** (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`) **and** carry a
  `type` claim (`"access"` | `"refresh"`) that both verifying paths check. Either defence alone would do; both are
  present because with one shared secret a refresh token sent as a bearer token would verify in `authCheck` and
  buy a 15-day session. **Never set these two env vars to the same value.**
- `POST /api/auth/refresh-token` (**no `authCheck`** — the access token is expired by definition when it's
  called; the refresh token's signature *is* the authentication) takes `{ refreshToken }` and returns a new
  access token in `token`. The **refresh token is not rotated** — the client keeps it, so a session has a hard
  15-day ceiling from login. A malformed body is a **400** (Zod), only a dead/expired/wrong-type token is a
  **401**; the client must only log the user out on the 401.
- That endpoint **re-reads the user row** and refuses a missing or `isDeleted` user, so it is the one place a
  user's current DB state gates access. Two consequences: flipping `isDeleted` ends access within 15 minutes
  instead of 15 days, and a `userRole` change (admin promotion, still a direct DB write) takes effect on the next
  refresh with no re-login — which spec 17's 15-day token made impossible.
- **Nothing about either token is stored server-side**: no token table, no denylist, no `jti`. Validity is
  signature + `exp` only. So an individual stolen refresh token **cannot be revoked** — the only levers are
  `isDeleted` on that user or rotating `JWT_REFRESH_SECRET` (which signs out everyone), and there is deliberately
  **no `POST /auth/logout`**: logging out is the client deleting its two tokens. See `specs/18`'s D8.
- `authCheck` reports expiry (`"Access token expired"`), a bad signature (`"Access token is invalid"`) and a
  wrong `type` (`"Invalid token type"`) as **distinct** messages (resolves `known-issues.md#AUTH-6`). With a
  15-minute token, routine expiry 401s are now the highest-volume `error_logs` row after 404s, so telling them
  apart from a probe matters when reading that table.
- Every transaction route requires `authCheck` **except** `POST /transactions/manage-money`, which is intentionally left open in the route file but has no compensating rate-limit or cost guard (→ `known-issues.md#AUTH-2`).
- `user.route.ts`'s `/register`, `/login` and `/refresh-token` correctly have no `authCheck` (they can't — that's how you get a token, or a replacement for an expired one).
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
| `jwt_access_secret` | `JWT_ACCESS_SECRET` | signs/verifies the 15-minute access token (renamed from `jwt_secret` by spec 18) |
| `jwt_refresh_secret` | `JWT_REFRESH_SECRET` | signs/verifies the 15-day refresh token — **must differ from the access secret**; no default, a missing value must fail loudly |
| `openRouterApiKey` | `openRouterApiKey` | camelCase env var name, inconsistent with the rest — → `known-issues.md#CFG-2` |

The two token lifetimes are **not** config: they are `ACCESS_TOKEN_TTL`/`REFRESH_TOKEN_TTL` literals at the top of `user.services.ts`, because `@types/jsonwebtoken` types `expiresIn` as a template-literal union that a `string | undefined` from `process.env` can't satisfy (→ `specs/18`'s D3).

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
2. **A valid JWT does not guarantee a currently-valid user.** `authCheck` never re-queries the DB — a soft-deleted user's access token still works until it expires. Since spec 18 that window is ≤15 minutes rather than 15 days, because the refresh endpoint *does* re-read the row and refuses them; but `loginFromDb` still has **no `isDeleted` filter**, so a soft-deleted user can obtain a fresh token pair by logging in again. → `known-issues.md#AUTH-4`
3. **`manage-money` is unauthenticated by design, not by oversight — but has no other cost guard.** Treat any call to it as coming from an anonymous caller. → `known-issues.md#AUTH-2`
4. **A password hash currently leaves the server on register and login.** Don't assume the `User` document is ever safe to return as-is to a client. → `known-issues.md#AUTH-3`
5. **Every error response includes a raw stack trace, in every environment.** Don't add sensitive detail to an error's `message` assuming it's server-side-only. → `known-issues.md#ERR-1`
6. **`Transaction.description` is required in the TypeScript interface but not enforced by the Mongoose schema or Zod.** Don't trust `TTransaction`'s type as a runtime guarantee. → `known-issues.md#VALID-5`

Server TS has no `@/*` path alias — imports are relative. `dist/` is committed build output and is currently stale relative to `src/` (→ `known-issues.md#NAME-7`); don't hand-edit it.
