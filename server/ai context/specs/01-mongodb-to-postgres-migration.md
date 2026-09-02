# 01: Migrate the database from MongoDB to PostgreSQL (Prisma + Neon)

## Goal

Replace MongoDB/Mongoose with PostgreSQL (via Prisma, hosted on Neon) as the server's database, carrying over a year of real personal transaction/user data with zero loss. The user has decided MongoDB was the wrong original choice and wants off it, but this is their real financial history — correctness of the migration matters more than speed.

## Scope

**In scope:**
- New Prisma schema modeling the existing `User` and `Transaction` shapes (only two collections exist — confirmed, no other entities).
- A one-off, safely re-runnable migration script that copies every row from MongoDB Atlas into the new Postgres database, preserving IDs, timestamps, and soft-deleted rows.
- A verification step (counts + sums + spot-checks) that must pass before cutover.
- Rewriting `user.services.ts` and `transaction.service.ts` (and deleting the Mongoose `.model.ts` files) to use Prisma instead of Mongoose, preserving existing route/controller contracts and JSON response shape (including keeping the `_id` key name, since the client reads that everywhere).
- A serverless-safe Prisma client singleton (`server/src/app/lib/prisma.ts`), replacing the old bare `mongoose.connect()` call in `server/src/server.ts`.
- Bundled into this same rewrite, since the query layer is being touched anyway and the user explicitly approved both:
  - **Fix AUTH-1** — thread `req.user.userId` through to `updateTransaction`/`deleteTransactionData` and filter by owner, closing the IDOR.
  - **Fix AUTH-10** — add the missing `isDeleted: false` check to delete's lookup so it errors on an already-deleted transaction instead of silently no-op'ing, matching update's behavior.
- New rows created after cutover keep using ObjectId-shaped string IDs (via a small `bson-objectid` helper), so every row — old and new — has one consistent ID format forever.

**Out of scope — port behavior verbatim, do not drive-by fix:**
- DATE-1/DATE-2 (UTC vs local / month-indexing quirks in the daily/monthly/yearly/weekly summary functions).
- AI-1 (corrupted AI system prompt) — `moneyManagement` has no DB access at all and should be copied unchanged.
- AUTH-2 (unauthenticated `manage-money` endpoint), AUTH-3 (password hash returned to client), ERR-1 (stack trace leakage), CFG-1 (no `DATABASE_URL` startup validation), CFG-3 (dead `DATABASE_URL2`), the unused `Queryuilder` class.
- Any client (`client/`) code changes — verified the client needs none (see Design, "Client compatibility").

## Design

### Data model (verified against actual schema/interface/validation files, not just the TS interfaces, which are known to lie in one place — VALID-5)

- **`User`**: `name` (required), `email` (required, unique, case-sensitive — keep as-is, don't add citext), `password` (argon2 hash — storage-agnostic, copy as-is, no rehash), `profilePicture` (optional), `isDeleted` (bool, default false), `userRole` (string in Mongo, tightened to a real Postgres enum `admin|user` here since nothing in the app ever writes an out-of-set value), `createdAt`/`updatedAt`.
- **`Transaction`**: `user`/`userId` (FK → User), `type` (enum `income|expense`, already schema-enforced in Mongo), `title` (required), `description` (genuinely optional at runtime despite the TS interface claiming required — VALID-5; model as nullable, matching real behavior, not the interface), `amount` (Mongo `Number` → Postgres `Decimal(12,2)`, better precision for money), `isDeleted` (bool, default false), `createdAt`/`updatedAt`.

### ID strategy

Preserve every existing Mongo ObjectId hex string as the new Postgres primary key (`String @id`, no `@default`). This makes the migration a direct 1:1 row copy, keeps the `Transaction.userId` foreign key valid with zero remapping, and needs no client changes — the client already treats `_id` as a fully opaque string (proven by the offline-queue feature, which already pushes `crypto.randomUUID()` and `local-<ts>-<rand>` strings through the exact same `_id`-consuming code paths in `TransactionCard.tsx`, `UpdateTransactionModal.tsx`, etc.). New rows created after cutover generate a fresh ObjectId-shaped string via a small helper (`bson-objectid`), so the format stays uniform forever rather than mixing in UUIDs.

### Response shape compatibility

The client's `TTransaction`/`IUser` types (`client/types/Transaction.tyes.ts`, `client/types/global.types.ts`) expect `_id`, not `id`. Controllers today do no response shaping (`sendResponse` just serializes whatever the service returns — `_id` appears today purely because Mongoose auto-serializes it). So the `_id` mapping has to happen inside each rewritten service function, right before returning: `{ ...row, _id: row.id }` (or `.map(...)` for arrays) — not a global middleware layer.

Prisma's `Decimal` type serializes to a **JSON string** by default (`"150.00"`), which would silently change `amount` from a JSON number to a string on the wire. Every transaction-returning function must convert back with `Number(...)` before returning, so the response is byte-for-byte the same shape the client already handles.

### Client compatibility (confirmed, no client changes needed)

- `_id` is used only as an opaque string: interpolated into REST paths (`UpdateTransactionModal.tsx`, `TransactionCard.tsx`), used as a React list `key`, and round-tripped through `AsyncStorage` (`app/auth.tsx`). No format/length validation anywhere, no `ObjectId`/`bson`/`mongoose` import in the client.
- `createdAt`/`updatedAt` are only ever passed to `new Date(...)`/`date-fns format()` — any parseable ISO string works; the offline queue already generates its own `new Date().toISOString()` values for pending items today.
- The bulk-add endpoint (`POST /transactions/many-transaction`, called from `SmartAdd.tsx`) — confirmed the client only reads `result.success`/`result.message` from the response, never the created-rows array, and relies entirely on React Query's `invalidateQueries` to refetch fresh data afterward. So Postgres `createMany` (which doesn't return created rows, unlike Mongo's `insertMany`) is a non-issue — no follow-up refetch needs to be added.

### Prisma schema (`server/prisma/schema.prisma`, new file)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  admin
  user
}

enum TransactionType {
  income
  expense
}

model User {
  id             String   @id
  name           String
  email          String   @unique
  password       String
  profilePicture String?
  isDeleted      Boolean  @default(false)
  userRole       Role     @default(user)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  transactions Transaction[]

  @@map("users")
}

model Transaction {
  id          String          @id
  userId      String
  type        TransactionType
  title       String
  description String?
  amount      Decimal         @db.Decimal(12, 2)
  isDeleted   Boolean         @default(false)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("transactions")
}
```

### Serverless connection setup

`server/src/app/lib/prisma.ts` (new):

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

This structurally fixes the existing serverless connection-exhaustion footgun (APP-4) as a side effect of switching stacks — Prisma connects lazily per query, Neon's own PgBouncer pooler absorbs concurrent Vercel invocations. No bespoke `readyState`-guard logic needed like Mongoose would require. Use Neon's pooled connection string (the default recommended one) — no need for the `@neondatabase/serverless` WebSocket driver-adapter, that exists for Edge runtimes; this app runs on Vercel's normal Node runtime per `vercel.json`.

`server/src/server.ts` — remove `mongoose.connect(...)` entirely; nothing replaces it at module load, Prisma connects lazily on first query.

### Migration script logic (`server/scripts/migrate-to-postgres.ts`, new — one-off, never wired into app/CI lifecycle)

1. Connect **read-only** to Mongo Atlas via a temporary `MONGO_MIGRATION_URI` env var (distinct from the app's `DATABASE_URL`, which now points at Postgres) — never call a write/delete method on this connection.
2. Instantiate `PrismaClient` against the real target `DATABASE_URL` (Postgres).
3. Migrate **all** `User` docs first (including soft-deleted ones — `isDeleted` is just a flag, not real absence), via `prisma.user.upsert({ where: { id: mongoUser._id.toString() }, create: {...}, update: {} })`. Upsert, not create, so the script is safely re-runnable if interrupted partway.
4. Migrate **all** `Transaction` docs the same way (`userId: tx.user.toString()`), preserving `createdAt`/`updatedAt` from the original documents verbatim (not regenerated). Wrap each row in try/catch so one bad row doesn't abort the run; collect and print failed IDs at the end.
5. Print a final summary (inserted / already-existed / failed counts, elapsed time); disconnect both clients in a `finally` block.

Needs its own `server/scripts/tsconfig.json` (`extends` the main config, `rootDir: ".."`, `noEmit: true`) since the main `tsconfig.json` has `rootDir: "./src"` and `scripts/` sits outside it — run via `ts-node --transpile-only` (or reuse the `ts-node-dev` dependency already installed) with that scoped config. Add `scripts/` to the main `tsconfig.json`'s `exclude` so `yarn build` never tries to compile it into `dist/`.

### Verification step (must PASS before cutover)

Compare Mongo (source of truth) against the freshly migrated Postgres:
- `User`/`Transaction` row counts match exactly (`countDocuments()` vs `prisma.count()`).
- Sum of `amount` grouped by `type` matches within a small epsilon (float-vs-Decimal comparison).
- Spot-check 5 random transaction IDs field-by-field (title, amount, type, description, isDeleted, createdAt) between the two databases.
- Print a clear PASS/FAIL; do not proceed to cutover on a FAIL.

### Service-layer rewrite

- `server/src/app/modules/user/user.model.ts` — **delete** (Prisma has no per-module model file; `prisma.user` from the schema replaces it).
- `server/src/app/modules/user/user.interface.ts` — keep `TUserRole`/`UserRole`; keep a slim `TUser` describing the create-payload shape only (distinct from Prisma's generated `User` row type, which now also carries `id`/timestamps/etc).
- `server/src/app/modules/user/user.services.ts` — rewrite `createUser`/`loginFromDb` against `prisma.user`. Password hashing moves from the old Mongoose `pre("save")` hook — which had no `isModified` guard, a latent double-hash bug — to one explicit `argon2.hash(...)` call inside `createUser`, the only place a user is ever created. Map `{ ...result, _id: result.id }` before returning.
- `server/src/app/modules/transaction/transaction.model.ts` — **delete**.
- `server/src/app/modules/transaction/transaction.interface.ts` — fix `description` to be genuinely optional (resolves VALID-5, matches real runtime behavior); `user?: ObjectId` becomes `userId?: string`.
- `server/src/app/modules/transaction/transaction.service.ts` — rewrite every function against `prisma.transaction`, same business logic:
  - `addNewTransaction`, `addManyTransaction` (`createMany` — confirmed non-issue per "Client compatibility" above).
  - `getDailyTransactions`, `getMonthlyTransactions`, `getYearlySummary`, `getWeeklySummary` — same fetch-then-reduce-in-JS pattern; swap the Mongoose query for `prisma.transaction.findMany({ where: { userId, createdAt: { gte, lte }, isDeleted: false } })`. Leave the date-range construction and grouping logic (including its existing quirks) untouched.
  - `updateTransaction` / `deleteTransactionData` — thread `userId` through (controller already receives `req.user.userId`, it's just not being passed today — confirmed in `transaction.controller.ts`) and filter `where: { id: transactionId, userId, isDeleted: false }` (fixes AUTH-1). Also add the missing `isDeleted: false` check to delete's lookup so it matches update's behavior (fixes AUTH-10).
  - `moneyManagement` — copy verbatim, no DB access, don't touch the AI prompt.
  - Every function returning transaction data runs its result through a small `toApiShape` helper (`{ ...t, _id: t.id, amount: Number(t.amount) }`, or `.map(...)` for arrays) so response shape stays identical to today.
- `server/src/app/util/generateObjectId.ts` — new, small helper (`bson-objectid`) for generating IDs for rows created after cutover.

### Dependencies / config

- `server/package.json`: remove `mongoose`; add `prisma` (dev dependency), `@prisma/client`, `bson-objectid`. Add `"postinstall": "prisma generate"` (needed so `tsc` sees the generated client, and so Vercel's build has a fresh one) and `"db:migrate": "prisma migrate deploy"` for future schema changes.
- `.env` / `.env.local`: `DATABASE_URL` → the Neon pooled Postgres connection string. Add a temporary `MONGO_MIGRATION_URI` (copy of the current Mongo Atlas URI), used only by the migration script. Both files are already gitignored.
- `server/vercel.json`: no expected change (the `postinstall` script handles `prisma generate` on Vercel), but verify against a real deploy — this project uses the older `builds`/`routes` config format, and some older-format setups skip `postinstall`, so don't assume without checking.

### Cutover sequence (short downtime — acceptable, this is solo use, not a live multi-user service)

1. `mongodump` the live Atlas database to local disk — full backup, kept indefinitely; the Atlas cluster itself is never modified/deleted at any point in this process.
2. Provision Neon, finalize and `prisma migrate deploy` the schema.
3. Take a **final** fresh export from the live Mongo Atlas connection immediately before cutover (captures any last-minute writes from the still-live app).
4. Run the migration script against that final source and the real Neon database.
5. Run verification — must PASS.
6. Run the Prisma-backed server locally against the new `DATABASE_URL`, hit every endpoint, and run the actual Expo client against it end-to-end (register/login with a real migrated account, view daily/weekly/monthly/yearly summaries, add/edit/soft-delete a transaction, exercise the offline-queue path) — per this repo's convention of verifying UI-affecting changes in a running app, not just type-checking.
7. Swap Vercel's production `DATABASE_URL` env var to the Neon connection string, deploy the Prisma-backed code.
8. Smoke-test the live production URL.
9. Keep the Mongo Atlas cluster running (paused or otherwise preserved, not deleted/canceled) as a rollback safety net for a self-chosen confidence period — no rush to decommission real financial data's old home.

### Rollback plan

Mongo is never modified during any of the above, so rollback is a deploy + env-var revert only: tag the last pre-migration commit (`git tag pre-postgres-migration`) before starting; if something looks wrong post-cutover, redeploy that tag and point `DATABASE_URL` back at the Mongo Atlas URI. Anything created after cutover but before a rollback decision would only exist in Postgres — acceptable given step 6's thorough pre-cutover testing keeps that window small.

## Implementation notes

- New files: `server/prisma/schema.prisma`, `server/src/app/lib/prisma.ts`, `server/src/app/util/generateObjectId.ts`, `server/scripts/migrate-to-postgres.ts`, `server/scripts/tsconfig.json`.
- Deleted files: `server/src/app/modules/user/user.model.ts`, `server/src/app/modules/transaction/transaction.model.ts`.
- Rewritten: `server/src/app/modules/user/user.services.ts`, `server/src/app/modules/user/user.interface.ts`, `server/src/app/modules/transaction/transaction.service.ts`, `server/src/app/modules/transaction/transaction.interface.ts`, `server/src/server.ts`, `server/package.json`, `server/tsconfig.json` (add `scripts/` to `exclude`).
- `server/src/app/modules/transaction/transaction.controller.ts` needs one small change: pass `req?.user?.userId` as a second argument to `updateTransaction`/`deleteTransactionData` (currently only passes `transactionId`) — required for the AUTH-1 fix.
- Confirm during implementation whether Vercel's builder for this project (older `builds`/`routes` format) actually needs `app.listen()` to still exist in `server.ts` for anything in production, or whether it's local-dev-only — don't assume, check against how `dist/server.js` is invoked.

## Verify when done

- [ ] `mongodump` backup taken and stored before any schema/data work begins.
- [ ] `npx prisma migrate deploy` succeeds against the real Neon database with the schema above.
- [ ] Migration script run against a final Mongo export; verification script (counts + sums + spot-checks) prints PASS.
- [ ] Local server (Prisma-backed) responds correctly on all endpoints: register, login, new-transaction, many-transaction, daily/monthly/yearly/weekly summaries, update-transaction, delete-transaction, manage-money.
- [ ] Expo client run against the local Prisma-backed server end-to-end: login with a real migrated account, view all four summary screens, add/edit/soft-delete a transaction, confirm displayed `amount` values are correct numbers (not `"150.00"`-style strings — catches a missed `Number(...)` conversion), confirm the offline-queue flow still works.
- [ ] AUTH-1 fix confirmed: an authenticated user cannot update/delete a transaction that isn't theirs (test with two accounts).
- [ ] AUTH-10 fix confirmed: deleting an already-soft-deleted transaction now returns an error instead of silently succeeding.
- [ ] Production `DATABASE_URL` swapped on Vercel, deployed, smoke-tested live.
- [ ] Verification script re-run one final time against the production Neon database post-cutover.
- [ ] `git tag pre-postgres-migration` created before starting, as the rollback point.
- [ ] Mongo Atlas cluster left running/preserved (not deleted) after cutover.
