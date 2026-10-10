# 17 — Error log module with automatic capture, 30-day retention, and an admin read route

**Status**: ✅ Completed 2026-10-05 — all 8 steps implemented and verified locally. Revised before
implementation after user feedback (`userRole` in the JWT payload; 404s must be recorded; no bikelog work).
**Scope**: `server/` + one repo-root file (`.github/workflows/`). **No client work. No `bikelog_server` work.**
**Reference only**: `bikelog_server`'s `errorLog` module (its specs 24 / 36 / 36a) is read as a model. Nothing in
that repo is touched by this spec.

---

## Goal

Persist **every** error this API produces — including 404s — into a new `ErrorLog` table automatically, keep
exactly 30 days of history by deleting older rows on a daily schedule, and expose an admin-only route to read
them (`GET /api/admin/error-logs` + `GET /api/admin/error-logs/:id`).

Today there is no error history at all: an error is formatted by `globalErrorHandler.ts`, sent to the client,
and gone. On Vercel there are no persisted logs to go back to, which is exactly why the recent receipt-upload
bug (specs 15/16) took a live reproduction to diagnose.

---

## Design

### What the reference system does (verified by reading `bikelog_server`)

| Piece                                                                   | bikelog location                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `ErrorLog` model, `@@index([status, createdAt])`, `@@map("error_logs")` | `prisma/schema.prisma:260-275`                                      |
| Automatic capture, `await`ed inside a self-contained try/catch          | `src/app/middleware/globalErrorHandler.ts:68-86`                    |
| `RETENTION_DAYS = 30` + `deleteMany({ createdAt: { lt: cutoff } })`     | `src/app/modules/errorLog/errorLog.service.ts:11,69-78`             |
| Admin list + by-id routes, mounted at `/api/admin/error-logs`           | `errorLog.route.ts`, `router/index.ts:88-91`                        |
| Cron route `POST /api/cron/cleanup-error-logs`, `x-cron-secret`         | `errorLog.route.ts` (second router), `errorLog.controller.ts:36-52` |
| Daily trigger, 21:00 UTC                                                | `.github/workflows/daily-error-log-cleanup.yml`                     |

### Decisions for this port

**D1 — Capture is `await`ed, not fire-and-forget.** Carried over verbatim, and the reason matters here too:
this server is a Vercel serverless function, and an invocation can be torn down the moment the response is
flushed, so an un-awaited insert issued after `res.json()` is not guaranteed to complete. The write is wrapped
in its own `try`/`catch` that only `console.error`s — **a failure to log must never block, replace, or change
the error response the client gets.**

**D2 — Admin gating reads `userRole` from the JWT payload.** Per direct user instruction: the token will carry
the role, so `adminCheck` is a pure claim check with no DB round-trip, identical to bikelog's. `loginFromDb`
already does a bare `findUnique` with no `select`, so `userData.userRole` is on hand — adding it to `jwtPayload`
is one line (Step 3a).

> **⚠️ Operational consequence — read before deploying.** Tokens issued _before_ this ships have no `userRole`
> claim, so `adminCheck` will 403 **every** caller, the real admin included. The order of operations is:
> **1)** deploy the payload change → **2)** promote the user to `admin` with a direct DB write → **3)** log out
> and back in in the app so a fresh token is minted. Promoting _before_ step 3 is required; promoting _after_
> logging in does nothing until the next login, and tokens last 15 days.
>
> Also note `loginFromDb` has **no `isDeleted: false` filter**, so a soft-deleted admin can still obtain a fresh
> admin token. Pre-existing, unrelated to this spec, and left alone — but the admin gate now rests entirely on
> the claim, so it is worth knowing. If you want it closed, say so and it becomes its own one-line spec.

**D3 — There is no promotion endpoint.** Same documented convention as bikelog: making an admin is a direct DB
write. `Role` and `User.userRole @default(user)` already exist in `prisma/schema.prisma:9-12,32` — they are
currently dead code (`known-issues.md#AUTH-7`), and this spec is what finally reads them. This spec does **not**
add role checks anywhere else.

**D4 — Query params are whitelisted and coerced, not passed through.** bikelog's `buildPrismaListQuery` spreads
every unrecognised query param into Prisma's `where` as an equality filter. That would be a 500 on this model:
`status` is an `Int`, so `?status=500` arrives as the **string** `"500"` and Prisma throws
`PrismaClientValidationError`; an unknown param like `?foo=bar` throws for the same reason. Since this server has
**no pagination helper at all today** (grep for `skip`/`take`/`meta` across `src/app/modules/` returns nothing),
there is nothing to stay compatible with — so use an explicit allowlist:

| Param           | Handling                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `page`, `limit` | `Number(...)`, defaults `1` / `20`, `limit` clamped to `1..100`                                  |
| `sort`          | only `createdAt` / `-createdAt` / `status` / `-status`; anything else falls back to `-createdAt` |
| `status`        | `Number(...)`; ignored if `NaN`                                                                  |
| `method`        | uppercased string, exact match                                                                   |
| `path`          | `contains`, case-insensitive (substring search is what's actually useful here)                   |
| anything else   | **ignored**, never forwarded to Prisma                                                           |

_(The same fragility exists in `bikelog_server`'s live error-log endpoint. Out of scope — noted only so the
difference between the two implementations is deliberate and recorded, not drift.)_

**D5 — Retention is a rolling 30×24h window, evaluated once a day.** `cutoff = now − 30 days`, delete
`createdAt < cutoff`. Against the example in the request ("on January 31, the log from January 1 is deleted"):
a row written 2026-01-01 10:00 is older than the cutoff from 2026-01-31 10:00 onward, so the 03:00-Dhaka run on
**Feb 1** is the one that removes it — i.e. **retention is "at least 30 days", up to ~31**. That is bikelog's
behaviour and is the safe direction to err. If strict calendar-day semantics are wanted instead, the one-line
change is to floor the cutoff to UTC midnight (`cutoff.setUTCHours(0,0,0,0)`); say so and it goes in.

**D6 — The cron route reuses this repo's existing shared-secret shape.** `transactionRequest.controller.ts:10-14`
already checks a secret header inside the controller (`x-integration-key` vs `config.integrationApiKey`). The
cleanup controller mirrors it exactly with `x-cron-secret` vs a new `config.cronSecret` — a **separate** secret,
because the existing one is shared with the `bikelog` project and these are unrelated trust boundaries.

**D7 — The workflow file lives at the repo root, not under `server/`.** The git repo root is
`expenseTracker2/`, holding both `client/` and `server/`, and there is **no `.github/` directory yet** — this
spec creates it.

**D8 — 404s are recorded, which requires reordering `app.ts`.** Per direct user instruction ("I want to record
404 and all error"). Today `app.ts:46` mounts `globalErrorHandler` **before** the catch-all 404 at `:49`, and the
404 handler writes its own response directly. Express only invokes 4-arity error middleware on an error, so an
unmatched route never reaches the logger. The fix (Step 5b) is to put the 404 handler **first** and have it
`next(new AppError(404, "API NOT FOUND!"))` so it flows through the one logging path like every other error.

This **closes `known-issues.md#ERR-6`** (handler mounted before the 404 catch-all). `ai-workflow-rules.md`
forbids fixing known-issues entries as a _side effect_ of unrelated work — here it is a direct requirement of the
request, not a drive-by, so it is in scope and must be recorded in `progress-tracker.md` (Step 9).

**Response-shape change, and why it's safe**: the 404 body goes from
`{ success, message: "API NOT FOUND!", error: { path, message } }` to `globalErrorHandler`'s standard
`{ success, message: "API NOT FOUND!", errorSources, stack }`. `message` is preserved exactly. A grep across
`client/` for `API NOT FOUND`, `data.error` and `response.data.error` returns **zero hits**, so nothing consumes
the `error` field. The requested path is not lost — it is recorded as the log row's `path` (`req.originalUrl`).

**D9 — 404 rows store no stack, to keep bot noise cheap.** This API is on a public Vercel URL, so unmatched-route
404s include automated scans (`/wp-admin`, `/.env`, …) and will be the highest-volume row type by far. The
`stack` of a 404 is synthetic — it just points at the handler that minted the `AppError` — so storing it is pure
waste. Step 5a drops `stack` when `status === 404`, which keeps those rows small while still recording method,
path, timestamp and user. Everything else is unchanged. If 404 volume still becomes a problem, the next lever is
a shorter retention for 404s specifically; not built now.

**D10 — Known limitations, accepted deliberately (write them into the code as comments):**

- **A thrown non-`Error` logs a degraded row.** Per `known-issues.md#ERR-7` (opened by spec 16), the handler's
  own `status`/`message` fallbacks lose the cause of a thrown string/object. Step 5a mitigates this _for the log
  row only_ by also recording the raw thrown value; it does **not** change the HTTP response, so ERR-7 stays open.
- **`ERR-1` is untouched.** The response keeps returning a stack trace in every environment. Storing stacks in
  the DB is fine (server-side); fixing the response leak is a separate spec.
- **Process-level crashes still aren't logged.** `server.ts`'s `unhandledRejection`/`uncaughtException` handlers
  are commented out, and those never pass through Express anyway. Out of scope — and on serverless, a write from
  a dying process isn't reliable regardless.

---

## Implementation

### Step 1 — Prisma model + migration

In `prisma/schema.prisma`, mirroring bikelog's model and this repo's conventions (`id String @id` with **no
`@default`** — ids are app-generated, see `CLAUDE.md`; snake_case `@@map`):

```prisma
model ErrorLog {
  id           String   @id
  status       Int
  message      String
  errorName    String?
  errorSources Json?
  stack        String?
  method       String
  path         String
  userId       String?
  userEmail    String?
  createdAt    DateTime @default(now())

  @@index([status, createdAt])
  @@index([createdAt])
  @@map("error_logs")
}
```

Two notes: `userId` is a **plain nullable column with no relation/FK** — an error can happen on an
unauthenticated request, and a log must survive its user being deleted. The extra `@@index([createdAt])` is for
the daily `deleteMany` range scan and the default `-createdAt` sort, which the composite index can't serve alone.

Create with `npx prisma migrate dev --name add_error_log`. Remember the split in `CLAUDE.md`: migrations run
against **`DATABASE_URL_UNPOOLED`** via `prisma.config.ts`.

### Step 2 — `config` + env

- `src/app/config/index.ts` — add `cronSecret: process.env.CRON_SECRET`.
- `server/.env` — add `CRON_SECRET=<a long random string>`.
- Document it in `CLAUDE.md`'s env notes. There is no `.env.example` here; `ai-workflow-rules.md` warns that
  adding a config field without documenting it is exactly how the dead-env-var drift (`CFG-3`) happened.
- The same value must be set in **Vercel project settings** and as a **GitHub repo secret** (Step 8).

### Step 3a — Put `userRole` in the JWT payload

`src/app/modules/user/user.services.ts`, in `loginFromDb` (~line 93):

```ts
const jwtPayload = {
  userId: userData.id,
  userEmail: userData.email,
  userRole: userData.userRole, // ! read by middleware/adminCheck.ts (spec 17)
};
```

`userData` comes from a `findUnique` with no `select`, so `userRole` is already loaded — no query change. Register
issues no token, so nothing else needs touching. See **D2**'s warning about existing tokens.

### Step 3b — `adminCheck` middleware

New `src/app/middleware/adminCheck.ts`, modelled on `authCheck.ts`'s `catchAsync` + `next(new AppError(...))`
shape:

```ts
// ! must run after authCheck — reads req.user, which authCheck populates.
// ! Role comes from the JWT (user.services.ts's jwtPayload), so a token minted before
// ! spec 17 shipped has no userRole claim and is correctly rejected until re-login.
const adminCheck = catchAsync(async (req, res, next) => {
  if (req.user?.userRole !== Role.admin) {
    return next(new AppError(httpStatus.FORBIDDEN, "Admin access required"));
  }

  next();
});
```

`Role` is imported from `@prisma/client`. `req.user` is typed as `JwtPayload`
(`src/app/interface/index.d.ts`), so the property access needs no cast.

### Step 4 — The module: `src/app/modules/errorLog/`

Follow this repo's module convention (`code-standards.md`): singular `.service.ts`, `.controller.ts`,
`.route.ts`, `.interface.ts`.

**`errorLog.interface.ts`** — `TErrorLog` with `status`, `message`, optional `errorName`, `errorSources`
(`TerrorSource` from `src/app/interface/error.ts`), `stack`, required `method`/`path`, nullable
`userId`/`userEmail`.

**`errorLog.service.ts`** — four functions, exported as `errorLogServices`:

1. `createErrorLog(payload)` — `prisma.errorLog.create` with `id: generateObjectId()`.
2. `getErrorLogsFromDB(query)` — builds `where`/`orderBy`/`skip`/`take` per **D4** (module-local helper, not a
   shared builder — there is exactly one consumer, and `src/app/builder/Queryuilder.ts` is dead Mongoose-era code
   that must not be imported). Returns `{ result, meta: { page, limit, total, totalPages } }`, mapping each row
   through a `toApiShape` that adds `_id` — the same convention `transaction.service.ts:13-17` uses.
3. `getErrorLogByIdFromDB(id)` — `findUnique`, `AppError(404, "Error log not found")` when missing.
4. `cleanupExpiredErrorLogsFromDB()` — `RETENTION_DAYS = 30` as a module const, `deleteMany` per **D5**, returns
   `{ deletedCount, cutoff }` so the cron response is auditable.

**`errorLog.controller.ts`** — `catchAsync` + `sendResponse(res, { status, success, message, data })`. Note the
key is **`status`**, not `statusCode` (`util/sendResponse.ts`). `cleanupExpiredErrorLogs` checks
`req.headers["x-cron-secret"]` against `config.cronSecret` and throws `AppError(401, ...)` on a mismatch,
mirroring `transactionRequest.controller.ts`'s `ingest`.

**`errorLog.route.ts`** — **two** routers from one file, as bikelog does:

```ts
router.get("/", authCheck, adminCheck, errorLogController.getErrorLogs);
router.get("/:id", authCheck, adminCheck, errorLogController.getErrorLogById);
export const errorLogRouter = router;

// ! no authCheck/adminCheck — machine-to-machine, guarded by x-cron-secret in the controller
cronRouter.post(
  "/cleanup-error-logs",
  errorLogController.cleanupExpiredErrorLogs,
);
export const errorLogCronRouter = cronRouter;
```

No Zod schema: there is no request body on any of the three endpoints, and `validateRequest` only ever validates
`{ body: req.body }` (`known-issues.md#VALID-3`), so it cannot cover the list route's query params — which is why
D4 handles them in the service.

### Step 5a — Wire the capture into `globalErrorHandler`

In `src/app/middleware/globalErrorHandler.ts`, after the existing branch chain computes `status`/`message`/
`errorSources` and **before** `res.status(status).json(...)`:

```ts
try {
  await errorLogServices.createErrorLog({
    status,
    message,
    errorName: error?.name,
    errorSources,
    // ! 404s are the highest-volume row on a public URL (bot scans) and their stack is
    // ! synthetic — it only points at app.ts's catch-all. Skip it (D9).
    // ! For a thrown non-Error (#ERR-7) `stack` is undefined and `message` is the generic
    // ! fallback, so keep the raw value instead or the cause is lost entirely.
    stack:
      status === httpStatus.NOT_FOUND
        ? undefined
        : (error?.stack ?? (error == null ? undefined : String(error))),
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.userId ?? null,
    userEmail: req.user?.userEmail ?? null,
  });
} catch (logError) {
  console.error("Failed to persist error log:", logError);
}
```

`req.user` is typed as a non-optional `JwtPayload` but is genuinely absent on unauthenticated requests — keep the
`?.` / `?? null`.

### Step 5b — Reorder `app.ts` so 404s reach the logger (D8)

Replace the current `app.use(globalErrorHandler)` (`:46`) → 404 handler (`:49-58`) ordering with the 404 handler
first, handing off via `next()`:

```ts
// ! not-found: must sit BEFORE globalErrorHandler and hand off via next(), so an unmatched
// ! route is formatted and LOGGED by the one error path like every other failure (spec 17 D8,
// ! closes known-issues.md#ERR-6). Responding directly here is what kept 404s out of the logs.
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(httpStatus.NOT_FOUND, "API NOT FOUND!"));
});

// ! global error handler — last, so nothing can be registered after it and be skipped
app.use(globalErrorHandler);
```

Keep the message string `"API NOT FOUND!"` byte-identical so no client copy changes.

### Step 6 — Mount both routers

In `src/app/router/index.ts`'s `routeArray`:

```ts
{ path: "/admin/error-logs", route: errorLogRouter },
{ path: "/cron",             route: errorLogCronRouter },
```

### Step 7 — The daily trigger

New `.github/workflows/daily-error-log-cleanup.yml` at the **repo root** (D7), ported from bikelog's:

```yaml
name: Daily Error Log Cleanup
on:
  schedule:
    - cron: "0 21 * * *" # 03:00 Asia/Dhaka (UTC+6) = 21:00 UTC the previous day
  workflow_dispatch: {}
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -f -X POST "${{ secrets.API_BASE_URL }}/cron/cleanup-error-logs" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

Needs two **GitHub repo secrets**: `API_BASE_URL` (`https://exp2server.vercel.app/api`) and `CRON_SECRET`
(byte-identical to the server's). `-f` makes curl exit non-zero on an HTTP error so a failed run is visible.

Deliberately **not** Vercel Cron: `vercel.json` here uses the legacy `builds`/`routes` format, and a `crons`
block against that format is unverified on a real deploy.

### Step 8 — Docs

- `CLAUDE.md` — add `errorLog` to the module/API list; document `CRON_SECRET`, the `/api/admin/error-logs` and
  `/api/cron/cleanup-error-logs` routes, that the cron route bypasses `authCheck` by design, that admin is
  granted by a direct DB write, and that the JWT now carries `userRole`.
- `ai context/progress-tracker.md` — a row for this spec; tick **`AUTH-7`** (`userRole` stops being dead code)
  and **`ERR-6`** (handler ordering, closed by Step 5b) in Known Gaps, and note the items deliberately left open
  (`ERR-1`, `ERR-7`, and `loginFromDb`'s missing `isDeleted` filter).
- `ai context/architecture.md` — its module list already predates `category`/`budget`/`transactionRequest`; add
  `errorLog`, the retention job, and the corrected middleware order.

---

## Dependencies

**No new npm packages.** Everything needed is already installed and wired:

| Need              | Already available                                                           |
| ----------------- | --------------------------------------------------------------------------- |
| Id generation     | `generateObjectId()` — `src/app/util/generateObjectId.ts` (`bson-objectid`) |
| Status codes      | `http-status`                                                               |
| Errors            | `AppError` — `src/app/Error/AppError.ts`                                    |
| Async wrapper     | `catchAsync` — `src/app/util/catchAsync.ts`                                 |
| Response envelope | `sendResponse` — `src/app/util/sendResponse.ts`                             |
| DB client         | `prisma` singleton — `src/app/lib/prisma.ts`                                |
| Error-source type | `TerrorSource` — `src/app/interface/error.ts`                               |
| Auth              | `authCheck` — `src/app/middleware/authCheck.ts`                             |
| Role enum         | `Role` from `@prisma/client` (already in the schema, currently unused)      |

**Non-package prerequisites:** `CRON_SECRET` in `server/.env` **and** Vercel project settings; `CRON_SECRET` +
`API_BASE_URL` as GitHub repo secrets; one user promoted to `admin` by direct DB write **then re-logged-in** (see
D2); and a deploy, since `vercel.json` points at the gitignored, untracked `dist/` — `yarn build && npx vercel
--prod`, as a `git push` alone ships nothing.

---


## Implementation notes (2026-10-05)

All 8 steps applied as written; **no deviations from the spec were needed**, and no new npm packages. Files:
`prisma/schema.prisma` + migration `20261005092223_add_error_log`, `src/app/config/index.ts`, `server/.env`,
`src/app/modules/user/user.services.ts`, new `src/app/middleware/adminCheck.ts`, new
`src/app/modules/errorLog/` (4 files), `src/app/middleware/globalErrorHandler.ts`, `src/app.ts`,
`src/app/router/index.ts`, new `.github/workflows/daily-error-log-cleanup.yml`.

**One gotcha worth recording**: `npx prisma migrate dev` applied the migration but did **not** regenerate the
client, so `prisma.errorLog` and the `Prisma.ErrorLog*` types didn't exist and `tsc` failed with 7 errors. A
separate `npx prisma generate` fixed it. `postinstall` runs `generate`, but a migration inside an existing
install doesn't — run `generate` explicitly after adding a model.

**Lint baseline improved from 4 errors to 3.** `app.ts`'s `'next' is defined but never used` disappeared
because Step 5b's 404 handler actually calls `next()`. The other three are untouched
(`builder/Queryuilder.ts`, `interface/index.d.ts`, `middleware/globalErrorHandler.ts`). The new
`console.error` carries an `eslint-disable-next-line no-console`, so it adds no warning either.

**Closed as a required part of this work, not a drive-by**: `known-issues.md#AUTH-7` (`userRole` was dead code)
and `#ERR-6` (handler mounted before the 404 catch-all — reordering it is what makes 404s loggable).
Recorded in `progress-tracker.md`'s Known Gaps per `ai-workflow-rules.md`.

**Still open, deliberately**: `#ERR-1` (stack in every response — note the 404 response now carries one too,
since it is a real `AppError`), `#ERR-7` (thrown non-`Error` loses its cause; mitigated for the log row only),
and `loginFromDb`'s missing `isDeleted: false` filter.

## Verify when done

Local `yarn dev` + curl against the dev Neon database, cleaning up throwaway rows afterwards — this repo's
convention, since `yarn test` is a stub.

**Build/static**

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` — compare against the **4 pre-existing** errors (`app.ts`, `builder/Queryuilder.ts`,
      `interface/index.d.ts`, `middleware/globalErrorHandler.ts`); the new `console.error` in
      `globalErrorHandler.ts` is an accepted `no-console` **warning**, matching `util/cloudinary.ts`
- [x] `npx prisma migrate dev` applied; `error_logs` exists with both indexes

**Automatic capture**

- [x] Trigger a known 400 (e.g. `PUT /api/transactions/receipt-file/<bad-id>` with a file) → a row appears with
      the right `status`, `message`, `method`, `path`
- [x] Trigger an error while **unauthenticated** → row written with `userId`/`userEmail` `null`, no crash
- [x] Trigger an error while **authenticated** → `userId`/`userEmail` populated from the JWT
- [x] A 500 carries a non-empty `stack`; a thrown non-`Error` still records the raw value (D10 mitigation)
- [x] **Logging failure is non-fatal**: temporarily point `createErrorLog` at a bad table/column, trigger an
      error, and confirm the client still receives the original error response unchanged, with
      `"Failed to persist error log:"` on the console
- [x] For non-404s, the response body is byte-identical to before this spec (no new/removed fields)

**404 capture (D8) — the part this revision added**

- [x] `GET /api/does-not-exist` → **404**, `message` still exactly `"API NOT FOUND!"`, and **a row is written**
      with `status: 404`, `method: "GET"`, `path: "/api/does-not-exist"`
- [x] A non-`/api` unmatched path (e.g. `GET /wp-admin`) → also 404 and also logged
- [x] `POST`/`PATCH`/`DELETE` to an unmatched path → logged with the right `method`
- [x] The 404 row's `stack` is **null** (D9), while a 500 row's is populated
- [x] A **wrong method on a real path** (e.g. `GET /api/transactions/receipt-file/x`) is logged too
- [x] `GET /` still returns `200 {"message":"server is running  !! "}` and writes **no** row
- [x] A successful request writes **no** row (sanity check that the handler isn't on the happy path)

**Admin read routes**

- [x] `GET /api/admin/error-logs` with **no token** → 401
- [x] …with a token minted **before** the Step 3a change → **403** (proves D2's re-login requirement, and that
      a missing claim fails closed rather than open)
- [x] …with a fresh **non-admin** token → **403 "Admin access required"**, no leakage of the list
- [x] …with a fresh **admin** token → 200, newest first, `meta` totals correct against a raw `COUNT(*)`
- [x] `?page=2&limit=5` pages correctly with no repeated or skipped rows across pages
- [x] `?status=404`, `?method=get`, `?path=does-not-exist` all filter as specified in **D4**
- [x] `?foo=bar` and `?status=notanumber` are **ignored** → still 200, not a 500
- [x] `?sort=createdAt` ascends; `?sort=garbage` falls back to `-createdAt`
- [x] `GET /api/admin/error-logs/:id` → 200 for a real id, **404** for a syntactically valid unknown id — and
      note that this 404 is itself logged, which is expected, not a loop

**Retention**

- [x] `POST /api/cron/cleanup-error-logs` with no header → 401; with a wrong secret → 401 (both logged)
- [x] Seed rows at `createdAt` = now, −29d, −31d (direct DB insert); run with the correct secret → only the −31d
      row is deleted, response reports `deletedCount: 1` and the `cutoff`
- [x] Re-run immediately → `deletedCount: 0` (idempotent)
- [x] The −29d row is still readable through the admin list

**Deployed**

- [ ] `yarn build && npx vercel --prod`; `CRON_SECRET` present in Vercel env (`vercel env ls production`)
- [ ] Promote the admin user in the DB, then **log out and back in** in the app, then repeat the admin route
      checks against `https://exp2server.vercel.app`
- [ ] GitHub Actions → "Daily Error Log Cleanup" → **Run workflow** succeeds by hand before relying on the
      schedule (both repo secrets set; `-f` means a bad secret fails the run loudly)
- [ ] After ~a day of real traffic, check 404 row volume (`SELECT count(*) ... WHERE status = 404`) against the
      Neon storage budget — D9 keeps rows small, but confirm the assumption rather than trusting it

**Cleanup**

- [x] Throwaway users/transactions and all seeded `error_logs` rows removed; admin promotion either kept
      deliberately or reverted
