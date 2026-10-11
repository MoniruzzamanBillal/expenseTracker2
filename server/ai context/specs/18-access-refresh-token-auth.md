# 18 — Access + refresh token auth (stateless, no token storage in the DB)

**Status**: ✅ **Completed 2026-10-11** — Steps 1–8 + 10 implemented and verified locally (`yarn dev` + curl
against the real dev Neon database, throwaway user cleaned up afterwards). Step 9 is the optional
`#AUTH-3`/`isDeleted` work and is **not** built — it still needs an explicit go-ahead. Both open questions were
resolved by taking this spec's own recommendations: **D3 option 1** (TTLs as literals, so `JWT_REFRESH_SECRET`
is the only new env var) and **D10** (require the `type` claim, accept one forced re-login). No deviations from
the plan, no errors hit during implementation.
**Scope**: `server/` only. Companion client spec: `client/ai context/specs/39-access-refresh-token-auth.md` —
the two must ship together (see **D10 — Rollout**).
**Closes**: `known-issues.md#AUTH-5` (single 15-day token, no refresh/rotation/revocation). Partially closes
`#AUTH-4` (no DB re-read of the user) — see **D4**.

---

## Goal

Replace the single 15-day JWT with a two-token flow:

| Token         | Lifetime    | Signed with          | Sent as                               |
| ------------- | ----------- | -------------------- | ------------------------------------- |
| Access token  | **15 min**  | `JWT_ACCESS_SECRET`  | `Authorization: Bearer <...>`         |
| Refresh token | **15 days** | `JWT_REFRESH_SECRET` | request body of `/auth/refresh-token` |

`POST /api/auth/login` returns both. When the access token expires, `authCheck` 401s as it already does; the
client posts the refresh token to a new `POST /api/auth/refresh-token`, gets a **new access token only** (the
refresh token is unchanged, per direct user instruction), and retries. When the refresh token is invalid or
expired, that endpoint 401s and the client logs the user out.

**No token is persisted server-side** — per direct user instruction, there is no `RefreshToken` table, no
denylist, no `jti` tracking. Everything is verified by signature + `exp`. Read **D8 — What "no DB storage"
costs you** before approving; it is the one decision in this spec with a security consequence that cannot be
engineered away.

---

## Scope

**In:**

- `src/app/config/index.ts` — 3 new env-backed fields; rename `jwt_secret` → `jwt_access_secret`.
- `src/app/modules/user/user.services.ts` — `loginFromDb` issues both tokens; new `refreshAccessToken`.
- `src/app/modules/user/user.controller.ts` — new `refreshToken` handler.
- `src/app/modules/user/user.route.ts` — new `POST /refresh-token` (no `authCheck`).
- `src/app/modules/user/user.validation.ts` — new `refreshTokenSchema`.
- `src/app/middleware/authCheck.ts` — verify with the access secret, reject a non-access token, distinguish
  "expired" from "invalid" (closes `#AUTH-6` as a direct requirement — see **D5**).
- `src/app/util/sendResponse.ts` — carry `refreshToken` alongside the existing `token`.
- `.env` / Vercel env — `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.

**Out (explicitly not touched):**

- **`#AUTH-3` (password hash in the login/register response).** This spec rewrites `loginFromDb`'s return value,
  so it is tempting — but `ai-workflow-rules.md` forbids fixing a known issue as a side effect of unrelated work.
  Written up as **Optional Step 9** below; say the word and it goes in the same session, otherwise it stays open.
- `#AUTH-8` (email normalisation), `#AUTH-9` (user enumeration on login), `#AUTH-1`'s client-side twin.
- Logout as a server endpoint. With nothing stored, "log out" is deleting the two tokens on the device; a
  `POST /auth/logout` would be a no-op that implies a guarantee this design can't give. **D8** covers this.
- Rate limiting on `/auth/refresh-token` (and on `/auth/login`). This repo has no rate limiter at all today;
  adding one is its own spec. Noted in **D8** as the main thing missing around this endpoint.
- Refresh-token **rotation**. Per direct user instruction the refresh token is returned unchanged. **D7**
  records what that forgoes so it isn't mistaken for an oversight.
- `/api/transaction-requests/ingest` (`x-integration-key`) and `/api/cron/cleanup-error-logs` (`x-cron-secret`)
  — not JWT routes, completely unaffected.

---

## Design

### D1 — Two **different** secrets, and a `type` claim on top. Non-negotiable.

The refresh token must not be usable as an access token. With a single secret it _would_ be: `authCheck` does a
bare `Jwt.verify(token, secret)` and accepts any payload that verifies, so a 15-day refresh token pasted into an
`Authorization` header would sail straight through and give a 15-day session — defeating the entire point of a
15-minute access token.

Two independent defences, both cheap:

1. **Separate secrets.** `JWT_ACCESS_SECRET` (already exists) and a new, independently random
   `JWT_REFRESH_SECRET`. A refresh token simply fails signature verification in `authCheck`.
2. **A `type` claim** (`"access"` | `"refresh"`) checked after verification on both sides. This is what protects
   you if the two secrets are ever accidentally set to the same value in some environment — a realistic
   copy-paste mistake when adding one env var next to another in the Vercel dashboard.

```ts
// user.services.ts
type TTokenType = "access" | "refresh";

const signToken = (
  payload: { userId: string; userEmail: string; userRole: Role },
  type: TTokenType,
) =>
  Jwt.sign(
    { ...payload, type },
    (type === "access"
      ? config.jwt_access_secret
      : config.jwt_refresh_secret) as string,
    {
      expiresIn: (type === "access"
        ? config.jwt_access_expires_in
        : config.jwt_refresh_expires_in) as never,
    },
  );
```

### D2 — Config shape

```ts
// src/app/config/index.ts
jwt_access_secret: process.env.JWT_ACCESS_SECRET,       // renamed from jwt_secret, same env var
jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,     // new
jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN ?? "15d",
```

The rename is a 3-line change — `grep -rn jwt_secret src/` hits exactly `config/index.ts:11`,
`authCheck.ts:23`, `user.services.ts:101`. Worth doing: leaving a field called `jwt_secret` next to a
`jwt_refresh_secret` is precisely the ambiguity that leads someone to reuse one secret for both.

Defaults are inline so a missing env var doesn't silently produce a token with **no expiry at all** (which is
what `expiresIn: undefined` does — `Jwt.sign` omits `exp` and the token is valid forever). The secrets have no
default on purpose: a missing secret must fail loudly, not fall back to a guessable string.

> **Generate the refresh secret as a genuinely random value**, not a memorable phrase:
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. It must differ from
> `JWT_ACCESS_SECRET`.

### D3 — `expiresIn` typing gotcha

`@types/jsonwebtoken@^9.0.10` types `SignOptions["expiresIn"]` as `number | ms.StringValue` — a **template
literal union** (`"15m" | "15 min" | ...`), not `string`. Passing a value read from `process.env` (type
`string | undefined`) is a compile error even though the value is correct at runtime. Options, in order of
preference:

1. Keep the expiries as **literals in `user.services.ts`** (`"15m"` / `"15d"`) and skip the env vars entirely.
   Simplest, fully type-safe, and these values aren't per-environment in practice.
2. Keep them in config and cast at the call site (`as SignOptions["expiresIn"]`).

**Recommendation: option 1** — drop `JWT_ACCESS_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` from **D2** and define
`const ACCESS_TOKEN_TTL = "15m"` / `const REFRESH_TOKEN_TTL = "15d"` at the top of `user.services.ts`. Only
`JWT_REFRESH_SECRET` is then a new env var, so there's one new thing to set in `.env` and in Vercel instead of
three. Confirm which you want; the rest of the spec reads the same either way.

### D4 — Refresh re-reads the user from the DB

The refresh token carries `userId`/`userEmail`/`userRole`, but `refreshAccessToken` does **not** mint the new
access token from those claims. It does a `findUnique` on `userId` and builds the new access token from the
**current** row:

```ts
const refreshAccessToken = async (refreshToken: string) => {
  let decoded: JwtPayload;
  try {
    decoded = Jwt.verify(
      refreshToken,
      config.jwt_refresh_secret as string,
    ) as JwtPayload;
  } catch {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Refresh token is invalid or expired, please login again",
    );
  }

  if (decoded?.type !== "refresh") {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid token type");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, userRole: true, isDeleted: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User no longer has access, please login again",
    );
  }

  return {
    accessToken: signToken(
      { userId: user.id, userEmail: user.email, userRole: user.userRole },
      "access",
    ),
  };
};
```

Why the DB read, when the whole point of a JWT is to avoid one:

- **It is the only revocation lever this design has.** With no stored tokens, flipping `isDeleted = true` is the
  one way to end someone's access without rotating the secret for every user, and it now takes effect within 15
  minutes instead of 15 days. This is the part of `#AUTH-4` this spec closes. (`authCheck` itself still does
  **not** read the DB — that would be a query on every single request, and 15 minutes of stale authority is the
  deliberate trade. `#AUTH-4` therefore stays open, with its window cut from 15 days to 15 minutes.)
- **It fixes spec 17's role-change problem.** Today, promoting a user to `admin` by direct DB write does nothing
  until they log out and back in, because `userRole` is baked into a 15-day token. With this change the new role
  lands on the next refresh — ≤15 minutes, no user action.
- **The cost is trivially small**: one indexed primary-key lookup per user per 15 minutes.

One consequence worth naming: `loginFromDb` has no `isDeleted: false` filter (flagged in spec 17's D2), so a
soft-deleted user can still _log in_ and get a fresh pair. The refresh path above closes the back half of that
hole but not the front. Adding the filter to `loginFromDb` is one line and is **out of scope here** for the same
known-issues rule as `#AUTH-3`; it is listed as **Optional Step 9b**.

### D5 — `authCheck` changes

```ts
const token = header.split(" ")[1]; // unchanged — see note below

let decoded: JwtPayload;
try {
  decoded = Jwt.verify(token, config.jwt_access_secret as string) as JwtPayload;
} catch (error) {
  // The client's interceptor keys its refresh attempt off the 401 status, not this string —
  // but an accurate message is what makes a real 401 debuggable in error_logs (spec 17).
  const expired = error instanceof Jwt.TokenExpiredError;
  return next(
    new AppError(
      httpStatus.UNAUTHORIZED,
      expired ? "Access token expired" : "Access token is invalid",
    ),
  );
}

if (decoded?.type !== "access") {
  return next(new AppError(httpStatus.UNAUTHORIZED, "Invalid token type"));
}

req.user = decoded;
```

The two distinct messages close `known-issues.md#AUTH-6` (every verify failure reported as
`"Token expired , Please login to continue"`). That is a **direct requirement** of this spec, not a drive-by: the
whole flow now depends on 401s being readable in `error_logs` to tell "the client's clock drifted" from "someone
is probing with a garbage token", and a 15-minute token means routine expiry 401s will be by far the most common
row in that table.

`header.split(" ")[1]` is `undefined` for a header like `"Bearer"` with no token, and `Jwt.verify(undefined)`
throws, so the existing code already fails closed through the `catch`. Left as is — not this spec's business.

> **Volume warning.** Routine access-token expiry now produces a logged 401 **per user per 15 minutes**,
> every one of them written to `error_logs` by `globalErrorHandler`. With a handful of users that's noise;
> it is still the single biggest row-count change this spec causes. If it becomes a problem, the lever is to
> skip the log write for `status === 401 && message === "Access token expired"` — the same shape as spec 17's
> D9 404 carve-out. **Not built now**; flagged so it isn't a surprise.

### D6 — The new endpoint

```
POST /api/auth/refresh-token          (no authCheck, validateRequest(refreshTokenSchema))
body: { "refreshToken": "<the refresh token>" }
```

```ts
// user.validation.ts
const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string({ required_error: "Refresh token is required" })
      .min(1),
  }),
});
```

Success — `200`:

```json
{
  "success": true,
  "message": "Access token refreshed successfully",
  "data": null,
  "token": "<new access token>"
}
```

Failure — `401` (expired, bad signature, wrong `type`, unknown or soft-deleted user), via the standard
`globalErrorHandler` body (`success`, `message`, `errorSources`, `stack`).

Two shape notes:

- **The new access token goes in the top-level `token` field**, matching what `/auth/login` already does
  (`sendResponse`'s `Tresponse.token`) rather than inventing `data.accessToken` for one endpoint. One place to
  look for "the access token" on both endpoints.
- **A malformed body is a `400`, not a `401`** (that's `validateRequest` + Zod). The client must treat only
  **401** as "refresh token is dead, log out" — a 400 means the client sent the wrong field name, and logging the
  user out would hide the bug. Called out explicitly because it is the easiest thing to get wrong on the client
  side, and the companion spec repeats it.

`sendResponse` gains one optional field so login can return both tokens:

```ts
type Tresponse<T> = {
  status: number;
  success: boolean;
  message: string;
  data: T;
  token?: string;
  refreshToken?: string;
};
```

`res.json` already always emits `token` (as `undefined` when unset, which `JSON.stringify` drops); `refreshToken`
behaves the same way, so no existing response changes shape.

**Login response after this spec:**

```json
{ "success": true, "message": "User logged in successfully!!!", "data": { ...user }, "token": "<access, 15m>", "refreshToken": "<refresh, 15d>" }
```

`POST /auth/register` is **unchanged** — it still returns no token at all and the client still sends the user to
the login screen afterwards. Changing register to auto-login is a product decision, not part of this.

### D7 — The refresh token is not rotated

Per direct user instruction: a successful refresh returns a new access token and the client keeps the same
refresh token. What that forgoes, recorded so it reads as a decision and not a gap:

- **No reuse detection.** With rotation (each refresh returns a new refresh token and burns the old one), a
  second use of an already-spent refresh token is a strong signal it was stolen, and the family can be killed.
  Detecting that requires remembering which tokens were spent — i.e. DB storage, which is explicitly excluded.
  So rotation without storage would buy almost nothing anyway: **this constraint and "no DB storage" point the
  same way**, which is why honouring the instruction costs little here.
- **A fixed 15-day ceiling per login.** The refresh token's `exp` never moves, so a session ends 15 days after
  login regardless of activity, and the user re-logs in. Sliding expiry would need a new refresh token on each
  refresh (i.e. rotation).

### D8 — What "no DB storage" costs you. Read this before approving.

Per direct user instruction nothing is stored, so:

1. **A stolen refresh token is valid for up to 15 days and cannot be revoked individually.** The only levers are
   `isDeleted = true` on that user (**D4**, kills _all_ their sessions, ≤15 min), or rotating
   `JWT_REFRESH_SECRET` (logs out **every** user on the next refresh). There is no "sign out my other devices".
2. **"Log out" is client-side only.** Deleting the tokens on the device is the whole of it; a copy taken off the
   device beforehand keeps working until `exp`. This is why no `POST /auth/logout` is in scope — it would be a
   no-op dressed up as a guarantee.
3. **`/auth/refresh-token` is an unauthenticated, unthrottled endpoint that mints credentials.** It is the
   natural target for offline brute-forcing of the refresh secret, and this repo has no rate limiter anywhere.
   A random 48-byte secret makes that infeasible in practice, which is why **D2** insists on one — but the
   endpoint deserves a rate limit eventually, and that's a separate spec.

A single stored row (`userId`, `tokenHash`, `expiresAt`) would fix 1 and 2 and is ~40 lines. You've ruled it out;
this section exists so that's a recorded choice with its consequences written down, not something to rediscover
after an incident. Say so if you want it and it becomes spec 19.

### D9 — Why not cookies on the server side

The companion client spec covers device storage, but the choice constrains the server, so the server-side half
belongs here. The app is an Expo **native** app; the `web` target exists for headless verification only
(`CLAUDE.md`). Keeping tokens in the request body + `Authorization` header means:

- `src/app/app.ts`'s CORS allowlist, `credentials: true`, `allowedHeaders` and `cookie-parser` all stay exactly
  as they are. No `Set-Cookie`, no `SameSite`/`Secure`/domain matrix to get right across localhost and
  `exp2server.vercel.app`.
- Native clients don't do CORS and React Native's `fetch`/XHR cookie jar behaviour differs by platform —
  an httpOnly-cookie design would be the _worse_ fit for the thing that actually ships.

If a real browser client ever lands, the server change is additive (`res.cookie` next to the existing JSON
fields) and doesn't invalidate this spec.

### D10 — Rollout, and the breaking change

Shipping the server alone **breaks every installed APK**, for two reasons, and the order matters:

1. Tokens minted before this spec have **no `type` claim**, so **D5**'s check 401s them. Every user is signed
   out once, the moment this deploys. (Precedent: spec 17's `userRole` change already required exactly this.)
   The alternative — treating a missing `type` as `"access"` for a grace period — buys 15 days of continuity at
   the cost of shipping the weaker check as the default and needing a follow-up to remove it.
   **Recommendation: require the claim.** One forced re-login is cheap for a personal app.
2. Worse: an **old APK that logs in after the server deploys** gets a 15-minute access token in the `token`
   field and has no idea how to refresh it, so it breaks every 15 minutes. It can't be made to work.

So the order is: **merge both sides together → deploy the server → build and install the new APK**, and
expect one forced re-login. There is no safe window where only the server is updated. If you need one, the
only way is to keep the current 15-day expiry on the access token for a release — which is the feature, undone.

---

## Implementation steps

1. ✅ **Config** — rename `jwt_secret` → `jwt_access_secret`, add `jwt_refresh_secret`; add the TTL constants per
   **D3**'s recommendation (or the two env fields, if you pick option 2). Update the two call sites the rename
   touches.
2. ✅ **`.env`** — add `JWT_REFRESH_SECRET` (fresh random 48 bytes, different from the access secret).
3. ✅ **`user.services.ts`** — add `signToken` (**D1**) + the TTL constants; rewrite `loginFromDb`'s tail to return
   `{ userData, accessToken, refreshToken }`; add `refreshAccessToken` (**D4**); export it.
4. ✅ **`user.validation.ts`** — add `refreshTokenSchema` (**D6**).
5. ✅ **`user.controller.ts`** — `signIn` passes `token: accessToken` **and** `refreshToken` to `sendResponse`; new
   `refreshToken` handler returning `{ data: null, token: accessToken }`.
6. ✅ **`user.route.ts`** — `router.post("/refresh-token", validateRequest(userValidations.refreshTokenSchema), userController.refreshToken)`,
   with **no `authCheck`** (the access token is expired by definition when this is called).
7. ✅ **`sendResponse.ts`** — add optional `refreshToken` to `Tresponse` and to the `res.json` body.
8. ✅ **`authCheck.ts`** — **D5**.
9. ⬜ **NOT BUILT — still needs an explicit go-ahead.** _(Optional, each item independent.)_
   - **9a — `#AUTH-3`**: strip `password` from the register and login responses. `loginFromDb` currently returns
     the bare `findUnique` row. Keep that row for the `argon2.verify` + claims, then return an explicit
     `select`-shaped object (reuse `getMe`'s field list + `userRole`, which the client's login handler reads for
     the admin gate). Client-visible shape change, so it needs the companion spec's awareness.
   - **9b**: add `isDeleted: false` to `loginFromDb`'s `where` (**D4**'s tail).
10. ✅ **Docs** — `progress-tracker.md`: mark the spec row, tick `#AUTH-5` and `#AUTH-6` as resolved in Known Gaps,
    note `#AUTH-4`'s window narrowed from 15 days to 15 minutes, and record the new `JWT_REFRESH_SECRET`
    user-side action (`.env` + Vercel project settings) in Next Up. `architecture.md`'s auth section needs the
    two-token model — it's already flagged as drifted in `CLAUDE.md`, so fix the auth part while in there.

---

---

## Implementation notes (filled in 2026-10-11)

**Both open questions resolved by taking this spec's own recommendations**, as approved implicitly by "execute as
specified": **D3 option 1** (TTLs as `ACCESS_TOKEN_TTL`/`REFRESH_TOKEN_TTL` literals at the top of
`user.services.ts`, so `JWT_ACCESS_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` were never added and
**`JWT_REFRESH_SECRET` is the only new env var**) and **D10** (the `type` claim is required, so every
pre-spec-18 token is rejected and every existing session is signed out once).

**Files touched** (8): `config/index.ts`, `middleware/authCheck.ts`, `modules/user/user.services.ts`,
`user.controller.ts`, `user.route.ts`, `user.validation.ts`, `util/sendResponse.ts`, plus `.env` (gitignored,
so `JWT_REFRESH_SECRET` is a user-side action for Vercel — see `progress-tracker.md`'s Next Up).

**No errors or deviations.** `npx tsc --noEmit` was clean on the first run and every checklist item passed
first time, so no fix-spec was needed. Notes worth keeping:

- **The documented lint baseline is now 3 errors, not 4.** `CLAUDE.md` and this spec's checklist both say 4
  (`app.ts`, `builder/Queryuilder.ts`, `interface/index.d.ts`, `middleware/globalErrorHandler.ts`); `app.ts`'s
  is gone, apparently fixed incidentally by an earlier commit. The remaining 3 are untouched by this spec, and
  this spec adds none. Not corrected in `CLAUDE.md` here — that's a root-level doc and outside this unit's
  scope; flagged for whoever next touches it.
- **Port 5000 was occupied by another OS user's stale `node dist/server.js`**, so verification ran on
  `PORT=5055 yarn dev`. `dotenv.config()` does not override an already-set shell variable, so a one-off
  `PORT=` override is the clean way to do this without editing `.env`.
- **`PORT= 5000` in `.env` has a leading space** in its value. Harmless (Express coerces), pre-existing, left
  alone.
- **Two `argon2`/`prisma` behaviours confirmed unchanged**: `POST /auth/register` still returns no token at all,
  and the login response still contains the password hash (`#AUTH-3`, deliberately out of scope — step 9a).
- **The `type` check in `authCheck` runs before any DB work**, so a pre-spec-18 token is rejected on the claim
  alone. That made the D10 check independent of which `userId` the test token carried.
- **Verified that `loginFromDb` still lets a soft-deleted user log in** (`200`), i.e. D4's tail is real: the
  refresh path is closed to them but the login path is not. Step 9b, awaiting go-ahead.
- All four distinct 401 messages (`Access token expired`, `Access token is invalid`, `Invalid token type`,
  `Authorization header missing or malformed`) were confirmed landing as separate `error_logs` rows — which is
  exactly what D5's `#AUTH-6` fix was for, and confirms spec 17's capture survived the `authCheck` rewrite.

## Verify when done

Run locally (`yarn dev`) + curl against the dev Neon DB, this repo's verification convention. Use a throwaway
user and clean it up afterwards.

- [x] `npx tsc --noEmit` clean; `yarn lint` shows **only** the 4 known baseline errors (`app.ts`,
      `builder/Queryuilder.ts`, `interface/index.d.ts`, `middleware/globalErrorHandler.ts`).
- [x] `POST /api/auth/login` returns both `token` and `refreshToken`. Decode both at jwt.io: access has
      `"type":"access"` and `exp - iat === 900`; refresh has `"type":"refresh"` and `exp - iat === 1296000`.
- [x] `GET /api/auth/me` with the access token → `200`.
- [x] `GET /api/auth/me` with the **refresh** token in the `Authorization` header → **401** (`"Access token is
  invalid"`). This is **D1**'s whole point — do not skip it.
- [x] `POST /api/auth/refresh-token` with `{ "refreshToken": "<valid>" }` → `200` + a new `token`; it differs
      from the first access token and `GET /api/auth/me` accepts it.
- [x] Same call with a garbage string → `401`. With `{}` → **`400`** (Zod), not 401 — **D6**.
- [x] An **access** token posted to `/auth/refresh-token` → `401` (wrong secret), not 200.
- [x] Expiry actually bites: temporarily set the access TTL to `"5s"`, log in, wait, hit `/auth/me` → `401`
      `"Access token expired"`; refresh → `200`; retry `/auth/me` → `200`. Restore `"15m"`.
- [x] Soft-delete the throwaway user (`isDeleted = true` via direct DB write), then refresh → `401`
      `"User no longer has access, please login again"` (**D4**).
- [x] Role change lands on refresh: promote the throwaway user to `admin` by direct DB write, refresh, then
      `GET /api/admin/error-logs` with the **new** access token → `200` with no re-login (**D4**).
- [x] A token minted **before** this change → `401` (`type` claim missing, **D10**). Confirms the forced-logout
      expectation rather than finding it in production.
- [x] `error_logs` has rows for the 401s above with the right `path`/`method`, and `GET /api/admin/error-logs`
      still reads them — i.e. the `authCheck` rewrite didn't break spec 17's capture.
- [x] `grep -rn "jwt_secret" src/` returns nothing (the rename is complete).
- [x] Throwaway user and its rows deleted.
