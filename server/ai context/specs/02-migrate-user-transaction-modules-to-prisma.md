# 02: Migrate the `user` and `transaction` modules from Mongoose to Prisma

## Goal

Rewrite the `user` and `transaction` modules' data-access code to query Postgres via Prisma instead of MongoDB via Mongoose, with **zero change** to route contracts, request/response shapes, or business logic the client depends on. This is the "code" half of the MongoDB→Postgres migration (`01-mongodb-to-postgres-migration.md` covers the full picture and the decisions this spec builds on — read its Design section first, especially "ID strategy", "Response shape compatibility", and "Client compatibility", which are not re-derived here). The data-copy half is a separate spec, `03-migrate-mongodb-data-to-postgresql.md` — this spec is code-only and does not touch any real data.

Prisma itself is already configured and connected (`01`'s "Dependencies / config" section, done 2026-09-02): `server/prisma/schema.prisma`, `server/prisma.config.ts`, and `server/src/app/lib/prisma.ts` all exist, `prisma generate`/`migrate dev` have been run, and `server/src/server.ts` already connects via `prisma.$connect()` instead of `mongoose.connect()`. What's _not_ done yet, and what this spec covers, is every Mongoose query in the two modules.

## Scope

**In scope:**

- `server/src/app/modules/user/user.services.ts` — rewrite `createUser`, `loginFromDb` against `prisma.user`.
- `server/src/app/modules/user/user.interface.ts` — narrow `TUser` to an accurate create-payload shape.
- `server/src/app/modules/user/user.model.ts` — delete.
- `server/src/app/modules/transaction/transaction.service.ts` — rewrite every exported function against `prisma.transaction`.
- `server/src/app/modules/transaction/transaction.interface.ts` — fix `description`/`user` field typing to match reality.
- `server/src/app/modules/transaction/transaction.model.ts` — delete.
- `server/src/app/modules/transaction/transaction.controller.ts` — thread `req.user.userId` into `updateTransaction`/`deleteTransactionData` (currently only passes `transactionId`).
- `server/src/app/util/generateObjectId.ts` — new helper so IDs created after this migration stay in the same ObjectId-hex-string shape as pre-migration rows (approved in `01`).
- Bundled fixes, both explicitly approved by the user in the `01` planning discussion since this rewrite touches every line of `transaction.service.ts` anyway:
  - **AUTH-1** (IDOR) — `updateTransaction`/`deleteTransactionData` currently look up a transaction by id alone; filter by `userId` too.
  - **AUTH-10** — `deleteTransactionData` currently skips the "already soft-deleted" check that `updateTransaction` has; add it so both behave the same way.
- `server/package.json` — remove `mongoose`, add `bson-objectid`.

**Out of scope:**

- Copying real data — that's `03`. This spec can be fully implemented and tested against an **empty** Postgres database (the tables already exist from `01`); use freshly-registered test users/transactions to verify, not real migrated data.
- DATE-1/DATE-2 (UTC vs. local / month-indexing quirks in the summary functions) — port verbatim.
- AI-1 (corrupted AI prompt in `moneyManagement`) — copy that function unchanged, it has no DB access at all.
- AUTH-2, AUTH-3, ERR-1, CFG-1, CFG-3, the unused `Queryuilder` class — untouched.
- Any client (`client/`) changes — none needed, see `01`'s "Client compatibility".

## Design

### `user.interface.ts`

Current `TUser` is misleading — it types `isDeleted`/`userRole` as required, but `user.validation.ts`'s Zod schema (`createUserSchema`) only validates `name`/`email`/`password`, and the controller passes `req.body` straight through untyped. In practice `isDeleted`/`userRole` are never supplied by a caller; Mongoose's schema `default: false`/`default: "user"` silently filled the gap. Prisma's `@default(false)`/`@default(user)` on the schema will do the same, so the create-payload type should reflect what a caller actually sends:

```ts
export type TUserRole = "admin" | "user";

export type TUser = {
  name: string;
  email: string;
  password: string;
  profilePicture?: string;
};

export const UserRole = {
  admin: "admin",
  user: "user",
} as const;
```

### `user.services.ts`

```ts
import argon2 from "argon2";
import httpStatus from "http-status";
import Jwt from "jsonwebtoken";
import AppError from "../../Error/AppError";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { generateObjectId } from "../../util/generateObjectId";
import { TUser } from "./user.interface";

// ! for creating a user
const createUser = async (payload: TUser) => {
  const hashedPassword = await argon2.hash(payload.password);

  const result = await prisma.user.create({
    data: {
      id: generateObjectId(),
      name: payload.name,
      email: payload.email,
      password: hashedPassword,
      profilePicture: payload.profilePicture,
    },
  });

  return { ...result, _id: result.id };
};

// ! for login a user
type Tlogin = {
  email: string;
  password: string;
};

const loginFromDb = async (payload: Tlogin) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User dont exist with this email !!!",
    );
  }

  const isPasswordMatch = await argon2.verify(
    userData.password,
    payload.password,
  );

  if (!isPasswordMatch) {
    throw new AppError(httpStatus.FORBIDDEN, "Password don't match !!");
  }

  const jwtPayload = {
    userId: userData.id,
    userEmail: userData.email,
  };

  const token = Jwt.sign(jwtPayload, config.jwt_secret as string, {
    expiresIn: "15d",
  });

  return {
    userData: { ...userData, _id: userData.id },
    token,
  };
};

export const userServices = { createUser, loginFromDb };
```

Notes:

- Password hashing moves here from the old Mongoose `pre("save")` hook (`user.model.ts`), which had no `isModified("password")` guard — a latent bug where any future update-via-`.save()` would re-hash an already-hashed password. Prisma has no hook equivalent, so hashing now happens explicitly at the one place a user is created. If an "update user" service is ever added later, it must remember to conditionally hash only when `password` is present in the payload — there's no hook to enforce that automatically anymore.
- `{ ...result, _id: result.id }` is the `_id` compatibility shim from `01` — the client reads `_id`, not `id`. Both `createUser`'s and `loginFromDb`'s returned user objects still carry the raw `password` hash (matches today's behavior exactly — AUTH-3 is explicitly out of scope, don't strip it as a drive-by fix).
- `email` lookup uses `findUnique` (requires the `@unique` constraint already on `schema.prisma`'s `User.email` — already in place).

### `transaction.interface.ts`

```ts
export interface TTransaction {
  userId?: string;
  type: keyof typeof transactionConstants;
  title: string;
  description?: string;
  amount: number;
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}
```

`description` becomes optional (resolves VALID-5 — the interface claimed required while the Mongoose schema and Zod validation both already treated it as optional; this makes the type honest, not a behavior change). `user?: ObjectId` becomes `userId?: string`, dropping the `mongoose` import from this file entirely.

### `transaction.service.ts`

Every function moves from `transactionModel` to `prisma.transaction`. A shared shape-mapping helper goes at the top of the file:

```ts
const toApiShape = (t: {
  id: string;
  amount: unknown;
  [key: string]: unknown;
}) => ({ ...t, _id: t.id, amount: Number(t.amount) });
```

`amount: Number(t.amount)` matters: Prisma's `Decimal` (used for `amount` in `schema.prisma`, chosen for money precision) serializes to a JSON **string** by default (`"150.00"`), which would silently change the wire shape from what Mongoose sent (a JSON number). Every function below that returns transaction data (single object or array) must pipe its result through `toApiShape` (or `.map(toApiShape)`), with no exceptions — a missed spot is the one class of bug in this rewrite that won't show up as a thrown error, only as a wrong-looking number in the client UI.

Function-by-function:

- **`addNewTransaction(payload, userId)`**

  ```ts
  const result = await prisma.transaction.create({
    data: {
      id: generateObjectId(),
      userId,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      amount: payload.amount,
    },
  });
  return toApiShape(result);
  ```

- **`addManyTransaction(payload, userId)`** — Mongo's `insertMany` returns the created docs; Prisma's `createMany` does not (Postgres/Prisma limitation). Confirmed in `01`'s research this is a non-issue: the client (`SmartAdd.tsx`) only reads `result.success`/`result.message` from this endpoint's response and relies on React Query's `invalidateQueries` to refetch, never the created-rows array. So:

  ```ts
  const formattedPayload = payload.map((data) => ({
    id: generateObjectId(),
    userId,
    type: data.type,
    title: data.title,
    description: data.description,
    amount: data.amount,
  }));
  const result = await prisma.transaction.createMany({
    data: formattedPayload,
  });
  return result; // { count: number } — controller/client never inspects the shape beyond truthiness
  ```

- **`getMonthlyTransactions`, `getDailyTransactions`, `getYearlySummary`, `getWeeklySummary`** — identical date-range construction and JS-side reduce/grouping logic (leave untouched, including their existing UTC/local inconsistencies — out of scope). Only the fetch changes, e.g. for monthly:

  ```ts
  const transactions = await prisma.transaction.findMany({
    where: { userId, createdAt: { gte: start, lte: end }, isDeleted: false },
    orderBy: { createdAt: "desc" },
  });
  ```

  Then map with `.map(toApiShape)` _before_ the existing `.filter()`/`.reduce()`/grouping code runs, since that code reads `t.type`/`t.amount` off plain objects and doesn't care about Prisma vs. Mongoose beyond that.

- **`updateTransaction(transactionId, userId, payload)`** — **signature gains a `userId` parameter** (AUTH-1 fix):

  ```ts
  const updateTransaction = async (
    transactionId: string,
    userId: string,
    payload: Partial<TTransaction>,
  ) => {
    const transactionData = await prisma.transaction.findFirst({
      where: { id: transactionId, userId, isDeleted: false },
    });

    if (!transactionData) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid transaction id !!!");
    }

    const result = await prisma.transaction.update({
      where: { id: transactionId },
      data: payload,
    });

    return toApiShape(result);
  };
  ```

  Filtering the existence-check by `userId` is what closes the IDOR — a transaction that exists but belongs to someone else now looks identical to a transaction that doesn't exist, which is the correct behavior (don't leak existence to a non-owner).

- **`deleteTransactionData(transactionId, userId)`** — same `userId` parameter, **and** add the `isDeleted: false` check the current Mongo version is missing (AUTH-10 fix — today it's a bare `findById`, letting a second delete on an already-deleted transaction silently "succeed" again as a no-op, unlike `updateTransaction` which already errors on this):

  ```ts
  const deleteTransactionData = async (
    transactionId: string,
    userId: string,
  ) => {
    const transactionData = await prisma.transaction.findFirst({
      where: { id: transactionId, userId, isDeleted: false },
    });

    if (!transactionData) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid transaction id !!!");
    }

    const result = await prisma.transaction.update({
      where: { id: transactionId },
      data: { isDeleted: true },
    });

    return toApiShape(result);
  };
  ```

- **`moneyManagement`** — copy verbatim, byte-for-byte including the corrupted system prompt (AI-1, out of scope). This function has no DB access at all.

### `transaction.controller.ts`

Two one-line changes — `req.user.userId` is already available on both handlers, it's just not being passed through today:

```ts
const updateTransaction = catchAsync(async (req, res) => {
  const result = await transactionServices.updateTransaction(
    req.params?.transactionId,
    req?.user?.userId,
    req?.body,
  );
  // ... unchanged
});

const deleteTransactionData = catchAsync(async (req, res) => {
  const result = await transactionServices.deleteTransactionData(
    req.params?.transactionId,
    req?.user?.userId,
  );
  // ... unchanged
});
```

### `generateObjectId.ts` (new)

```ts
import ObjectID from "bson-objectid";

export const generateObjectId = () => new ObjectID().toHexString();
```

A 12-byte-timestamp-based hex ID generator, matching Mongo's `ObjectId.toString()` format exactly — so every row created after this migration (and after `03`'s data copy) looks identical in shape to every migrated row. `bson-objectid` is a ~2kb dependency with no other transitive baggage.

### Model deletion

`user.model.ts` and `transaction.model.ts` are deleted outright — Prisma has no per-module model file, `prisma.user`/`prisma.transaction` from `schema.prisma` replace them. Nothing else in the codebase imports these two files except the services being rewritten here (confirmed in `01`'s original research pass — narrow surface, only `.create()`/`.find()`/`.findOne()`/`.findById()`/`.findByIdAndUpdate()`/`.insertMany()` calls, all inside the two service files).

### `package.json`

Remove `mongoose` (nothing left in the codebase will import it after this spec — verify with a repo-wide grep before removing, in case something outside these two modules still references a Mongoose type). Add `bson-objectid`.

## Implementation notes

- Files touched: `server/src/app/modules/user/user.services.ts`, `user.interface.ts` (rewrite), `user.model.ts` (delete); `server/src/app/modules/transaction/transaction.service.ts`, `transaction.interface.ts` (rewrite), `transaction.model.ts` (delete), `transaction.controller.ts` (two-line change); `server/src/app/util/generateObjectId.ts` (new); `server/package.json` (dependency swap).
- Do this work against the **existing empty** Postgres tables from `01` — do not run `03`'s data migration first. Register a couple of fresh test accounts and transactions through the rewritten endpoints to verify; real data migration is a separate, later step.
- Watch for the `toApiShape`/`Number(amount)` conversion specifically — it's the one place a bug here won't throw, just silently render wrong.
- After this spec is done, `server/ai context/known-issues.md`'s AUTH-1 and AUTH-10 entries should be marked resolved (with a note pointing at this spec / the commit that lands it), and `mongoose` should no longer appear anywhere under `server/src/`.

## Verify when done

- [ ] `mongoose` fully removed from `package.json` and no longer imported anywhere in `server/src/`.
- [ ] `yarn build` (tsc) passes with no errors.
- [ ] Register a new user through `POST /api/auth/register` — response still has `_id`, no `id` field leaking through unexpectedly, password hash present (matches current AUTH-3 behavior, not fixed here).
- [ ] Login with that user via `POST /api/auth/login` — returns a working JWT.
- [ ] Create a transaction via `POST /api/transactions/new-transaction` — response has `_id` and `amount` as a JSON **number**, not a string.
- [ ] Bulk-add via `POST /api/transactions/many-transaction` with 2-3 items succeeds; confirm via a follow-up `GET` that all were actually created.
- [ ] Daily/monthly/yearly/weekly summary endpoints all return correct totals for the test transactions created above, with `amount` as numbers throughout (including inside nested `transactionData`/`transactions` arrays).
- [ ] `PATCH` update-transaction on your own transaction succeeds.
- [ ] `PATCH` update-transaction or delete-transaction on a transaction belonging to a **second** test account returns an error, not a success — confirms the AUTH-1 fix.
- [ ] Delete a transaction, then delete it again — second call now errors instead of silently succeeding — confirms the AUTH-10 fix.
- [ ] Run the Expo client against this locally-running rewritten server and exercise the full app manually (register/login, view all summary screens, add/edit/soft-delete a transaction, confirm displayed amounts look correct, exercise the offline-queue path) — per this repo's convention of verifying UI-affecting changes in a running app, not just type-checking.
