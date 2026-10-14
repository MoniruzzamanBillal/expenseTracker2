# 19 — Strip the password hash from auth responses, gate the stack trace on the environment

**Status**: ✅ **Completed 2026-10-14** — all 6 steps implemented and verified against the real Neon database
(`yarn dev` + curl, two throwaway users deleted afterwards). No deviations from the plan and no errors hit, so
no fix-spec was needed. Both bugs were **reproduced on the pre-change build first**, so the before/after is a
measurement rather than an assertion. Not yet deployed — see **Deployment**.
**Scope**: `server/` only. Three source files (`user.services.ts`, `middleware/globalErrorHandler.ts`,
`.env`) plus docs. No client change is required — see **D4** for why, and read it before assuming otherwise.
**Closes**: `known-issues.md#AUTH-3` (password hash in the register/login response) and `#ERR-1`
(unconditional stack trace in every error response). These are `specs/18`'s deferred **optional step 9a**
and the second-oldest open High item respectively.

---

## Request

The two findings that came out of the "is my app ready for deployment?" review, quoted:

> 1. Your login response includes the password hash. `loginFromDb` does a `findUnique` with no `select`
>    and returns `{ ...userData }` — the argon2 hash goes over the wire on every login, and register does
>    the same. One `select` or a delete before the response fixes it.
> 2. Every error response leaks a full stack trace, in production, right now. I pulled this off your live
>    URL — file paths, line numbers, `/var/task/dist/...` internals. This is `#ERR-1`, and it's a free map
>    of your server for anyone poking at it.

Both were confirmed against the **live** deployment (`https://exp2server.vercel.app`) on 2026-10-14, not
just read out of `known-issues.md`.

---

## Goal

Stop two pieces of information leaving the server that never should:

| # | Today | After |
| --- | --- | --- |
| `#AUTH-3` | `POST /api/auth/register` and `POST /api/auth/login` return the whole `users` row as `data`, argon2 `password` hash included | both return an explicit allowlist of public fields; the hash never enters a response object |
| `#ERR-1` | every error response carries `stack: error?.stack` — real file paths and line numbers, in production | the key is present only when `NODE_ENV === "development"`; in production the key is absent entirely |

Neither fix changes a status code, a `message`, or any field the client reads. Both are small; they are
specced together because they are the same class of bug (a response boundary with no allowlist), they
ship in the same build, and they are the two things standing between this API and a deploy.

---

## Scope

**In:**

- `src/app/modules/user/user.services.ts` — `createUser`, `loginFromDb`, and a shared select constant
  that `getMe`/`updateProfile` adopt without changing their output.
- `src/app/middleware/globalErrorHandler.ts` — the `stack` field on the response body only.
- `server/.env` — add `NODE_ENV=development` (gitignored, so also a **user-side action** on every other
  machine and on Vercel-by-default; see **D6**).
- Docs: `progress-tracker.md` (spec row + two Known Gaps boxes), and the two stale claims in the root
  `CLAUDE.md` found during the same review (**step 6**, optional).

**Out (deliberately, each one flagged rather than folded in):**

- **`#AUTH-3`'s sibling, spec 18's optional step 9b** — adding `isDeleted: false` to `loginFromDb`'s
  `where`. It is one line, it is in the same function this spec rewrites, and it is tempting. It is still
  out: it is a **behaviour** change (a soft-deleted user can log in today and would stop being able to),
  not an information-leak fix, and it was not what was asked for. `specs/18` D4 already documents the
  hole; it stays open and stays flagged in Known Gaps.
- **`#ERR-2`** — `handleDuplicateError` puts the raw driver error string into the top-level `message`.
  That is a *second* leak of internals in the same error path, so "the leak is fixed" must not be
  over-claimed after this spec. It is near-unreachable in practice (its trigger is `error.code === 11000`,
  a **Mongo** code, and no Mongoose data access remains), which is exactly why it is not worth bundling
  here. Left open.
- **`#ERR-7`** (a thrown non-`Error` loses its cause) and **`#ERR-5`** (the handler's two parallel
  `if/else-if` chains). `#ERR-7` is already Next Up item 7 with its own rationale; touching the handler's
  control flow while making a one-line security change would make this spec impossible to review.
- **`#AUTH-8`** (email normalisation), **`#AUTH-9`** (user enumeration via the two distinct login
  errors), **`#AUTH-4`** (`authCheck` never re-reads the row). All unrelated to what leaves in a response
  body.
- Rate limiting, a logout endpoint, the CORS allowlist, and anything on the client side.

---

## Design

### D1 — Strip in the service, not the controller, and by allowlist, not by deletion

The controllers (`user.controller.ts`) just hand whatever the service returns to `sendResponse` as `data`.
Three ways to fix that, in increasing order of safety:

1. `delete result.password` in the controller — the hash still travels through the service return value
   and lives in one more variable; a future second controller re-leaks it.
2. `select: { ..., password: true }` on the query and strip afterwards — narrower, but the stripping is
   still a step someone can forget.
3. **Return only an explicit list of public fields from the service.** The hash never enters the object
   that becomes `data`.

Take **3**. The fix should be structural: the response-shaped object is an allowlist, so the failure mode
of forgetting something is a *missing* field (loud, caught by the client immediately) rather than an
*extra* one (silent, which is precisely how this bug survived since the Mongoose era).

### D2 — One shared `PUBLIC_USER_SELECT`

`getMe` and `updateProfile` already each carry a hand-written `select`, and the two field lists are
**already byte-identical**:

```ts
{ id: true, name: true, email: true, profilePicture: true, createdAt: true, updatedAt: true }
```

Hoist that to a module-level constant and have `createUser`, `getMe` and `updateProfile` all use it.
Because the list is identical to what those two already select, **`GET /api/auth/me` and
`PATCH /api/auth/update-profile` change by exactly nothing** — same fields, same order, same JSON. The
gain is that the next `prisma.user` read in this file has an obvious safe default to copy, instead of a
bare `findUnique` being the path of least resistance. (There are only five `prisma.user.*` call sites in
the entire `src/` tree, all in this one file — verified — so this constant genuinely covers the surface.)

### D3 — `loginFromDb` keeps its unselected read

`loginFromDb` cannot use the constant on its query: it needs `password` for `argon2.verify` and
`userRole` for the JWT claims. So the query stays as it is and **only the return value changes** — the
row is used locally for verification and claims, and an explicit object is built for the response:

```ts
const userData = await prisma.user.findUnique({ where: { email: payload.email } });
// ... existing not-found / argon2.verify / jwtPayload code, unchanged ...

return {
  userData: {
    _id: userData.id,
    id: userData.id,
    name: userData.name,
    email: userData.email,
    profilePicture: userData.profilePicture,
    userRole: userData.userRole,
    createdAt: userData.createdAt,
    updatedAt: userData.updatedAt,
  },
  accessToken: signToken(jwtPayload, "access"),
  refreshToken: signToken(jwtPayload, "refresh"),
};
```

Note `id` **and** `_id` are both kept — every other endpoint in this module returns `{ ...row, _id: row.id }`,
i.e. both, and this is not the spec to start trimming that Mongo-era compatibility field.

### D4 — What the client actually reads, so this cannot break login

Checked in `client/`, not assumed:

| Field | Read at | Required? |
| --- | --- | --- |
| `data._id` | `app/auth.tsx:56` | **yes** |
| `data.name` | `app/auth.tsx:57` | **yes** |
| `data.email` | `app/auth.tsx:58` | **yes** |
| `data.userRole` | `app/auth.tsx:62` | **yes — see below** |
| `token`, `refreshToken` | `app/auth.tsx:44-45` | yes, untouched by this spec |
| anything from register's `data` | — | **no**: `app/register.tsx:46-51` reads only `success` and `message` |

**`userRole` is the trap.** Login is the *only* place the client can learn it — `getMe`'s select omits it
(there is a load-bearing comment saying so at `auth.tsx:59-62`), so dropping it from the login response
would not fail loudly: the user would simply log in fine and the admin error-log screen would quietly
never appear again. It must be in the allowlist. `password` is read nowhere, on either side.

### D5 — Gate the stack **fail-closed**: expose on `development`, not on "not production"

```ts
return res.status(status).json({
  success: false,
  message,
  errorSources,
  stack: config.node_env === "development" ? error?.stack : undefined,
});
```

The obvious alternative, `config.node_env !== "production"`, is **rejected**. Both expressions hide the
stack on Vercel (which sets `NODE_ENV=production` for production *and* preview deployments), but they
differ in the case that matters: an environment where `NODE_ENV` is unset, misspelled, or lost. `!==
"production"` leaks there; `=== "development"` does not. The whole point of this change is that a
misconfiguration should fail towards silence, and a missing env var is the single most likely
misconfiguration in a project whose `.env` is gitignored and hand-synced to Vercel.

`undefined` rather than `null` so `res.json` drops the key entirely — the same mechanism `sendResponse`
already relies on for its optional `token`/`refreshToken`.

### D6 — The one real cost: `NODE_ENV` is not set anywhere today

`server/.env` has no `NODE_ENV` key (verified) and `yarn dev` (`ts-node-dev --respawn --transpile-only`)
does not set one, so `config.node_env` is `undefined` locally **right now**. With D5's gate and nothing
else, local development would also lose stack traces — a real regression in day-to-day debugging.

Fix: add `NODE_ENV=development` to `server/.env`. `config/index.ts` calls `dotenv.config()` at import
time, before anything reads `config.node_env`, so this is enough; and because dotenv never overrides an
already-set variable, a one-off `NODE_ENV=production yarn dev` still works for testing the production
branch (that is how **step 5**'s checklist verifies it).

Rejected alternative: `"dev": "NODE_ENV=development ts-node-dev ..."` in `package.json`. It would need no
user-side action per machine, but inline env assignment is not portable to a Windows shell without adding
`cross-env`, and this repo keeps environment in `.env`.

`.env` is gitignored, so this is also a **user-side action** on any other checkout. On Vercel nothing is
needed: `NODE_ENV=production` is set there by the platform, which is the behaviour this spec wants.

### D7 — Nothing is lost in production by removing the stack

This is the part worth being sure of before shipping, and it is already handled: `globalErrorHandler`
**persists the stack on the `error_logs` row** (`specs/17`, the `await`ed insert immediately above the
response), the admin API serves it at `GET /api/admin/error-logs/:id` behind `authCheck` + `adminCheck`,
and the client already renders it — `components/main/ErrorLogs/ErrorLogDetailSheet.tsx:78-84`. That
component reads the **stored row**, never a response body; a repo-wide grep of `client/` found no read of
a response `stack` at all.

So after this change the stack is available to an authenticated admin and to nobody else, which is the
entire intent. The one deliberate exception stays as `specs/17` D9 left it: a **404** stores no stack,
because it is synthetic and 404s are the highest-volume row on a public URL.

### D8 — Response shape, before and after

```
POST /api/auth/register
- data: { id, name, email, password, profilePicture, isDeleted, userRole, createdAt, updatedAt, _id }
+ data: { id, name, email, profilePicture, createdAt, updatedAt, _id }

POST /api/auth/login
- data: { id, name, email, password, profilePicture, isDeleted, userRole, createdAt, updatedAt, _id }
+ data: { id, name, email, profilePicture, userRole, createdAt, updatedAt, _id }

any error response, NODE_ENV=production
- { success, message, errorSources, stack: "Error: ...\n    at /var/task/dist/..." }
+ { success, message, errorSources }
```

`isDeleted` is dropped from both and is **not** re-added: nothing on either side reads it, and an
account's deletion state is not the client's business. `password` is gone from both. No field that any
caller reads is removed.

---

## Implementation steps

1. **`src/app/modules/user/user.services.ts`**
   - Add the `PUBLIC_USER_SELECT` constant (**D2**) at module level, near the TTL constants, with a
     one-line comment saying why it exists (`#AUTH-3`: the default for any `prisma.user` read that feeds
     a response).
   - `createUser` — add `select: PUBLIC_USER_SELECT` to the `prisma.user.create` call. Return value stays
     `{ ...result, _id: result.id }`.
   - `getMe`, `updateProfile` — replace each inline `select` object with `PUBLIC_USER_SELECT`. No output
     change (**D2**).
   - `loginFromDb` — leave the query, the not-found throw, the `argon2.verify` and the `jwtPayload`
     exactly as they are; replace only the returned `userData` with **D3**'s explicit object. Comment it
     with `#AUTH-3` and why `userRole` has to stay (**D4**).
2. **`src/app/middleware/globalErrorHandler.ts`**
   - `import config from "../config";` (not currently imported in this file — check before adding).
   - Change the response's `stack` to **D5**'s gated expression, with a comment recording `#ERR-1`, the
     fail-closed choice, and that the stack is still on the `error_logs` row (**D7**) so the next reader
     doesn't "restore" it for debuggability.
   - Touch nothing else in the file. In particular its existing lint error (`'next' is defined but never
     used`, line 16) **must stay**: Express only treats a 4-arity function as error middleware, so
     removing the parameter would silently unmount the whole error handler. It is part of the documented
     3-error baseline.
3. **`server/.env`** — add `NODE_ENV=development` (**D6**).
4. **Typecheck + lint** — `npx tsc --noEmit` clean, `yarn lint` still exactly the documented baseline:
   **3 errors** (`builder/Queryuilder.ts`, `interface/index.d.ts`, `middleware/globalErrorHandler.ts`) and
   **4 `no-console` warnings** (`helper/openRouter.ts` ×1, `util/cloudinary.ts` ×3). Confirmed as the
   pre-change baseline on 2026-10-14. Note `CLAUDE.md` and `specs/18`'s checklist both still say 4 errors
   — `app.ts`'s was fixed incidentally; the number to match is **3**.
5. **Verify** per the checklist below — `yarn dev` + curl against the dev Neon database with a throwaway
   user, cleaned up afterwards, this repo's convention.
6. **Docs.**
   - `progress-tracker.md`: add this spec's row to the Spec status table; tick **AUTH-3** and **ERR-1** in
     Known Gaps with the date and a pointer here; add the `NODE_ENV` user-side note to Next Up; leave
     `AUTH-4`, `ERR-2`, `ERR-7` and spec 18's step 9b explicitly open.
   - *Optional but recommended, and not strictly this unit's scope* — the root `CLAUDE.md` carries two
     claims this review found to be **stale**, both about the live deployment being older than the code:
     it says `POST /api/auth/refresh-token` "still 404s on `https://exp2server.vercel.app`" and that the
     error-log routes 404 too. Re-probed 2026-10-14: refresh-token returns **401**
     (`"Refresh token is invalid or expired, please login again"`) and `GET /api/admin/error-logs`
     returns **401** (`"Authorization header missing or malformed"`), so **specs 17 and 18 are already
     deployed**. Correct both, or hand them to whoever next edits that file — but do not leave them
     saying the opposite of what the live API does, because the next session will plan a deploy around it.

---

## Dependencies

None. No new package, no migration (the `User` model is unchanged — this is about what is *selected*, not
what is *stored*), no new config field (`config.node_env` already exists), and no client release. Every
change is inside `server/src` plus one gitignored `.env` line.

---

## Deployment

Both fixes are only real once the deployed build carries them, and this repo does **not** deploy on push:
`server/vercel.json` uses the legacy `builds` format pointing at `dist/server.js`, and `dist/` is
gitignored and untracked. So shipping is `yarn build && npx vercel --prod` from `server/`, as Next Up
items 6 and 7 already record for `specs/15`/`16`/`17`.

Two notes for whoever runs it:

- **No forced logout, no client coordination.** Unlike `specs/18`, nothing here invalidates a token or
  changes a field the client reads, so this can deploy on its own, ahead of or behind any client release.
- **The live 401 from `/auth/refresh-token` does not prove `JWT_REFRESH_SECRET` is set in Vercel.**
  `Jwt.verify` with an `undefined` secret throws, and that throw is caught and reported as the *same*
  401 as a genuinely invalid token — so the only real proof is a live login followed by a successful
  refresh. Worth doing in the same session as this deploy, since Next Up item 4 lists that secret as a
  deploy blocker and the probe can't distinguish the two cases.

---

## Implementation notes (filled in 2026-10-14)

**Implemented exactly as planned.** No deviations, no surprises, no fix-spec needed. Files touched (3 +
docs): `modules/user/user.services.ts` (5 edits), `middleware/globalErrorHandler.ts` (2 edits), `.env`
(1 line), plus `progress-tracker.md`, `code-standards.md` and the root `CLAUDE.md`.

**The baseline was captured first.** Rather than trusting the plan's description of current behaviour, the
two changed files were `git stash`ed, the old build was run, and both bugs were reproduced against it:
register and login both returned a `password` starting `$argon2id$v=19`, and every error body carried a
stack. The same requests were then replayed on the new build. Everything below is a diff between those two
runs, not a reading of the new one alone.

**`as const` on `PUBLIC_USER_SELECT` is load-bearing**, as **D2** anticipated: without it the object
literal widens from `{ id: true }` to `{ id: boolean }` and Prisma can no longer infer which fields the
payload contains, which would have broken `{ ...result, _id: result.id }` at the type level. `tsc` was
clean on the first run with it.

**`globalErrorHandler.ts` did not import `config`** before this change — the import is new. Its existing
lint error (`'next' is defined but never used`) simply moved from line 16 to line 17 as a result; it is
**still there and must stay**, since Express only recognises a 4-arity function as error middleware.
Lint is unchanged at the documented **3 errors + 4 warnings**.

**Two findings about the verification environment, worth recording:**

- **`server/.env` points at `NEON_BRANCH=production`** — there is no separate dev branch in this `.env`,
  so "the dev Neon database" in this repo's convention (and in specs 17/18's notes) is in fact the
  production database. Verification therefore ran against live data with two clearly-named throwaway
  users (`spec19-probe*@example.invalid`), both hard-deleted afterwards (`usersDeleted: 2`,
  `probeUsersRemaining: 0`) by a temporary script that was then removed. The 7 `/api/nope` `error_logs`
  rows the probes created were deleted too; the handful of login-failure rows were left alone, since they
  are indistinguishable from real traffic and expire on their own in 30 days. **Worth fixing properly
  before the next verification session:** a real Neon dev branch, so this convention stops meaning
  "write to production".
- **`pkill -f "ts-node-dev…"` kills its own shell**, because the pattern matches the invoking command
  line. Stop the dev server by the PID holding the port (`ss -ltnp | grep :5055`) instead. Also, port
  5000 is still occupied by another OS user's stale process, so this ran on `PORT=5055` exactly as
  spec 18's notes describe.

### Verified by execution

Old build → new build, same requests:

| Check | Old build | New build |
| --- | --- | --- |
| `POST /auth/register` → `data` keys | 10, incl. **`password`** (`$argon2id$v=19`), `isDeleted`, `userRole` | 7: `_id, id, name, email, profilePicture, createdAt, updatedAt` |
| `POST /auth/login` → `data` keys | 10, incl. **`password`**, `isDeleted` | 8: the above **+ `userRole`** (**D4**) |
| `GET /auth/me` | 7 keys | **identical** — every field equal, the one `updatedAt` delta traced to the probe's own intervening `PATCH` (old `PATCH` wrote `11:41:00.689Z`, new `GET` returned exactly that) |
| `PATCH /auth/update-profile` | 7 keys | same 7 keys |
| access / refresh token claims | — | `type: "access"` ttl **900**, `type: "refresh"` ttl **1296000**, `userRole` present — **D3**'s rewrite left the tokens untouched |
| wrong password | `403 "Password don't match !!"` | **unchanged** — `argon2.verify` still runs against the real hash |
| unknown email | `404 "User dont exist with this email !!!"` | **unchanged** |

`#ERR-1`, same error on the same build under three environments:

| `NODE_ENV` | `has("stack")` in the body |
| --- | --- |
| `development` (from the new `.env` line, no shell var) | **true** — local debugging intact |
| `production` (shell var; dotenv does not override it) | **false** — key absent entirely, not `null` |
| **unset** (the `.env` line commented out) | **false** — **D5**'s fail-closed property, the one check that `!== "production"` would have failed |

And the two supporting facts:

- `success`, `message`, `errorSources` and the status code are **byte-identical** between the development
  and production runs — a `jq` diff of the bodies with `.stack` deleted comes back empty for both a 404
  and a 403. Only the stack moved.
- **D7 holds**: for the production-mode `403`, the response carried no stack while the `error_logs` row
  for that same request **did** (`stackStored: true`). The `404` row still stores none, exactly as
  `specs/17` D9 intends. So the stack is now visible to an authenticated admin and to nobody else.

---

## Verify when done

Local, `yarn dev` + curl against the dev Neon database, throwaway user cleaned up afterwards.

**Static**

- [x] `npx tsc --noEmit` clean.
- [x] `yarn lint` shows exactly the baseline **3 errors + 4 warnings** of step 4 — no new ones, and
      `globalErrorHandler.ts`'s unused-`next` error still present (it must be).
- [x] `grep -rn "prisma\.user\." src/` — every call site either carries `PUBLIC_USER_SELECT` or is
      `loginFromDb`/`refreshAccessToken`, whose own narrow selects are deliberate.

**`#AUTH-3`**

- [x] `POST /api/auth/register` with a throwaway user → `200`, and `data` has **no `password`** key.
      Check the raw body, not a pretty-printer that might hide it: `| jq 'has("data") and (.data|has("password"))'`
      → `false`.
- [x] Same response still has `_id`, `name`, `email` — register's own contract is unchanged even though
      the client reads none of it.
- [x] `POST /api/auth/login` → `200`, `data` has **no `password`** and **no `isDeleted`**, and **does**
      have `_id`, `id`, `name`, `email`, `profilePicture`, `userRole`, `createdAt`, `updatedAt`
      (**D4** — `userRole` is the one whose absence would fail silently).
- [x] `token` and `refreshToken` are both still present and still decode with `"type":"access"` /
      `"type":"refresh"` — proof that **D3**'s rewrite of the return value didn't disturb the tokens.
- [x] `GET /api/auth/me` and `PATCH /api/auth/update-profile` return **byte-identical** bodies to before
      the change (**D2** claims zero delta — diff them, don't assume). *Diffed against the stashed old
      build: identical. The single `updatedAt` difference is the probe's own intervening `PATCH`, proven
      by that value matching what the old `PATCH` wrote; with `updatedAt` excluded the bodies are equal.*
- [x] A wrong password still → `403 "Password don't match !!"`, and an unknown email still → `404`:
      `argon2.verify` still runs against the real hash, which is the thing the allowlist must not break.
- [~] Log in from the real client (`client/` on web is enough) and confirm the session establishes and
      Settings still shows the user — the end-to-end check that `_id`/`name`/`email` survived.
      **Still open, deliberately.** The client's `baseURL` points at the deployed server, which does not
      carry this change yet, so logging in from it would exercise the *old* build; pointing it at
      localhost is a client edit this spec rules out (and `CLAUDE.md` warns against committing a local
      URL). The substance — that no field the client reads disappeared — is covered at the API level
      above: `_id`, `name`, `email` and `userRole` were each asserted present in the login response.
      Do this once the deploy lands, together with the two probes below.

**`#ERR-1`**

- [x] With `NODE_ENV=development` (the new `.env` line): any error response — e.g. `GET /api/nope` →
      404, or a bad login → 403 — **still includes** `stack`. Local debugging is intact.
- [x] With `NODE_ENV=production yarn dev` (dotenv does not override a shell variable): the same two calls
      return **no `stack` key at all** — `| jq 'has("stack")'` → `false`, not `"stack": null`.
- [x] `message`, `success`, `status` code and `errorSources` are identical between the two runs — only
      `stack` differs.
- [x] With `NODE_ENV` **absent** (comment the line out): no `stack`. This is **D5**'s fail-closed
      property and the reason `=== "development"` was chosen over `!== "production"`; it is the one check
      that distinguishes the two.
- [x] The `error_logs` row for that production-mode error **still has its `stack`** (`GET /api/admin/error-logs/:id`
      as an admin, or read the row directly) — **D7**. A 404's row still has none, per `specs/17` D9.
      *Read the rows directly with a temporary script rather than promoting a throwaway user to admin on a
      production database; the admin route itself is already covered by `specs/17`'s verification.*

**After deploying** (needs the Vercel deploy of the **Deployment** section above) — ⬜ **not done: not deployed yet**

- [ ] `curl -s https://exp2server.vercel.app/api/nope | jq 'has("stack")'` → `false`. This is the exact
      probe that found the leak on 2026-10-14; it is the one that proves it closed.
- [ ] A live login against the deployed API returns no `password`, and a subsequent
      `POST /api/auth/refresh-token` with the returned refresh token → `200` (which also settles the
      `JWT_REFRESH_SECRET` question in **Deployment**).

**Docs**

- [x] Row in `progress-tracker.md`'s Spec status table; **AUTH-3** and **ERR-1** ticked in Known Gaps with
      a pointer to this spec; `NODE_ENV` added to Next Up as a user-side action.
- [x] `known-issues.md` itself left as-is (frozen snapshot, per `ai-workflow-rules.md`).
