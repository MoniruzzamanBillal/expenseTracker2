# 03: Migrate real data from MongoDB Atlas to PostgreSQL (Neon)

## Goal

Copy every real `User` and `Transaction` document out of the live MongoDB Atlas cluster into the new Postgres database, with a verification step that proves nothing was lost or corrupted, before ever pointing the live app at Postgres. This is a year of the user's actual personal financial data — correctness and safety matter more than speed. See `01-mongodb-to-postgres-migration.md` for the full background (why Postgres, ID strategy, data model decisions) — this spec only covers the data-copy mechanics and cutover.

**Prerequisite**: `02-migrate-user-transaction-modules-to-prisma.md` should be implemented and verified first (against the empty Postgres tables) — this spec copies data into the same tables that code will then read/write in production. Copying real data before the app code is ready just means more to double-check later; do them in order.

## Scope

**In scope:**

- A one-off, safely re-runnable script (`server/scripts/migrate-to-postgres.ts`) that reads every `User`/`Transaction` document from Mongo and writes the equivalent row to Postgres.
- A verification pass (counts, sums, spot-checks) that must PASS before cutover.
- The cutover sequence: final export, run script, verify, swap env vars, deploy, smoke-test.
- A rollback plan.

**Out of scope:**

- Any application code changes (that's `02`) — this script is standalone, never imported by the app, never run automatically.
- Deleting or modifying anything in MongoDB. The script only ever reads from Mongo. The Atlas cluster stays up, untouched, as a safety net for as long as the user wants after cutover — this spec does not include decommissioning it.

## Design

### Script location and setup

`server/scripts/migrate-to-postgres.ts`, run manually via `ts-node`, never wired into `package.json`'s lifecycle scripts (no `pre`/`post` hooks, not part of `build`) so it can never run by accident.

Needs its own `server/scripts/tsconfig.json` since the main `server/tsconfig.json` has `"include": ["src"]` / `rootDir` scoped to `src/`, and `scripts/` sits outside it:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "rootDir": "..",
    "noEmit": true
  },
  "include": ["./migrate-to-postgres.ts"]
}
```

Add `"scripts"` to the main `server/tsconfig.json`'s `"exclude"` array so `yarn build` never tries to compile it into `dist/`.

Run with: `npx ts-node --project scripts/tsconfig.json scripts/migrate-to-postgres.ts` (reuses the `ts-node` devDependency already installed).

### Env vars

- `MONGO_MIGRATION_URI` — new, temporary, added to `server/.env` only for this script's use. Copy of the current Mongo Atlas connection string (visible today, commented out, in `server/.env` as the old `DATABASE_URL` value — `mongodb+srv://...level2.hdz7qkm.mongodb.net/expenseTrackerNative...`). **Never** read by `server/src/app/config/index.ts` — this script reads `process.env.MONGO_MIGRATION_URI` directly, independent of the app's config module, so there's no risk of it leaking into the running app's connection logic.
- `DATABASE_URL` — already the Neon **pooled** connection string (set by the user in `01`). The script uses this via the same `PrismaNeon` adapter pattern as `server/src/app/lib/prisma.ts` (Prisma 7 requires the adapter regardless of context — see `01`'s "Prisma version note").

### Script logic

```ts
import "dotenv/config";
import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

// Minimal read-only schemas — deliberately NOT importing the app's real
// Mongoose models, so this script has zero dependency on app code and
// can't accidentally trigger any app-side hook (e.g. the password
// pre("save") hash) while reading.
const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const transactionSchema = new mongoose.Schema(
  {},
  { strict: false, timestamps: true },
);
const MongoUser = mongoose.model("User", userSchema, "users");
const MongoTransaction = mongoose.model(
  "Transaction",
  transactionSchema,
  "transactions",
);

async function migrateUsers() {
  const users = await MongoUser.find({}).lean(); // ALL users, including isDeleted ones
  let inserted = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const u of users) {
    try {
      const result = await prisma.user.upsert({
        where: { id: u._id.toString() },
        create: {
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          password: u.password,
          profilePicture: u.profilePicture ?? null,
          isDeleted: u.isDeleted ?? false,
          userRole: u.userRole ?? "user",
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        },
        update: {}, // no-op if it already exists — safe to re-run
      });
      result.createdAt.getTime() === new Date(u.createdAt).getTime()
        ? inserted++
        : skipped++;
    } catch (err) {
      failed.push(u._id.toString());
      console.error(`User ${u._id} failed:`, err);
    }
  }

  return { total: users.length, inserted, skipped, failed };
}

async function migrateTransactions() {
  const transactions = await MongoTransaction.find({}).lean(); // ALL, including isDeleted
  let inserted = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const t of transactions) {
    try {
      await prisma.transaction.upsert({
        where: { id: t._id.toString() },
        create: {
          id: t._id.toString(),
          userId: t.user.toString(),
          type: t.type,
          title: t.title,
          description: t.description ?? null,
          amount: t.amount,
          isDeleted: t.isDeleted ?? false,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        },
        update: {},
      });
      inserted++;
    } catch (err) {
      failed.push(t._id.toString());
      console.error(`Transaction ${t._id} failed:`, err);
    }
  }

  return { total: transactions.length, inserted, skipped, failed };
}

async function main() {
  const start = Date.now();
  await mongoose.connect(process.env.MONGO_MIGRATION_URI as string);

  console.log("Migrating users...");
  const userResult = await migrateUsers();
  console.log(userResult);

  console.log("Migrating transactions...");
  const txResult = await migrateTransactions();
  console.log(txResult);

  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  if (userResult.failed.length || txResult.failed.length) {
    console.error("FAILED IDs (re-run the script to retry them):", {
      users: userResult.failed,
      transactions: txResult.failed,
    });
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await prisma.$disconnect();
  });
```

Key properties:

- **Users before transactions** — the foreign key requires it.
- **Includes soft-deleted rows** — no `isDeleted` filter on either `find()`, since `isDeleted` is just a flag, not real absence, and the goal is a complete copy.
- **`upsert`, not `create`** — safe to run more than once; a row that already made it over is a no-op, not a duplicate-key error.
- **Per-row try/catch** — one malformed document doesn't abort the whole run; failed IDs are collected and printed so they can be investigated and the script re-run to pick them up.
- **Timestamps copied verbatim** from the original Mongo documents (`u.createdAt`, not `new Date()`) — preserves real transaction history dates.
- **IDs preserved exactly** — `_id.toString()` on a Mongo ObjectId yields the same 24-character hex string, used directly as the Postgres primary key. This is what makes the foreign key (`Transaction.userId`) valid with zero remapping.

### Verification (must PASS before cutover)

A second phase (append to the same script, or a separate `server/scripts/verify-migration.ts` — either is fine, pick whichever reads cleaner) comparing Mongo against the freshly-populated Postgres:

```ts
const mongoUserCount = await MongoUser.countDocuments({});
const pgUserCount = await prisma.user.count();

const mongoTxCount = await MongoTransaction.countDocuments({});
const pgTxCount = await prisma.transaction.count();

const mongoTxs = await MongoTransaction.find({}).lean();
const mongoIncomeSum = mongoTxs
  .filter((t) => t.type === "income")
  .reduce((sum, t) => sum + t.amount, 0);
const mongoExpenseSum = mongoTxs
  .filter((t) => t.type === "expense")
  .reduce((sum, t) => sum + t.amount, 0);

const pgIncomeSum = await prisma.transaction.aggregate({
  where: { type: "income" },
  _sum: { amount: true },
});
const pgExpenseSum = await prisma.transaction.aggregate({
  where: { type: "expense" },
  _sum: { amount: true },
});

const EPSILON = 0.01; // float (Mongo Number) vs Decimal (Postgres) rounding tolerance

const checks = [
  { name: "user count", pass: mongoUserCount === pgUserCount },
  { name: "transaction count", pass: mongoTxCount === pgTxCount },
  {
    name: "income sum",
    pass: Math.abs(mongoIncomeSum - Number(pgIncomeSum._sum.amount)) < EPSILON,
  },
  {
    name: "expense sum",
    pass:
      Math.abs(mongoExpenseSum - Number(pgExpenseSum._sum.amount)) < EPSILON,
  },
];

// Spot-check 5 random transactions field-by-field
const sample = mongoTxs.sort(() => Math.random() - 0.5).slice(0, 5);
for (const t of sample) {
  const pgRow = await prisma.transaction.findUnique({
    where: { id: t._id.toString() },
  });
  const match =
    pgRow &&
    pgRow.title === t.title &&
    Number(pgRow.amount) === t.amount &&
    pgRow.type === t.type &&
    (pgRow.description ?? null) === (t.description ?? null) &&
    pgRow.isDeleted === (t.isDeleted ?? false);
  checks.push({ name: `spot-check ${t._id}`, pass: !!match });
}

const allPass = checks.every((c) => c.pass);
console.log(checks);
console.log(
  allPass ? "VERIFICATION PASSED" : "VERIFICATION FAILED — do not cut over",
);
process.exitCode = allPass ? 0 : 1;
```

Do not proceed to cutover on any FAIL — investigate and fix (likely by re-running the migration script, since it's idempotent) before trying again.

### Cutover sequence (short downtime — acceptable, solo use, not a live multi-user service)

1. `mongodump` the live Atlas database to local disk (or use `mongodump --uri="$MONGO_MIGRATION_URI"`) — a full backup, kept indefinitely. The Atlas cluster itself is never modified or deleted at any point in this process.
2. Confirm `02` (the service-layer rewrite) is implemented and verified against the empty Postgres tables.
3. Take a **final** fresh read directly from the live Mongo Atlas connection immediately before cutover (the script reads live, so this just means: run the script right before cutover, not from a stale dump, so it captures any last-minute writes made from the still-live app).
4. Run the migration script.
5. Run verification — must print `VERIFICATION PASSED`.
6. Run the (already-rewritten, per `02`) server locally against the real migrated Postgres data, and run the actual Expo client against it end-to-end: log in with a **real** existing account (not a test one), confirm the transaction history, monthly/yearly/weekly summaries, and balances all look correct and match what you remember/can cross-check against the live Mongo-backed production app. This is the most important manual check in the whole migration — real numbers, not synthetic test data.
7. Swap Vercel's production `DATABASE_URL` env var to the Neon connection string (if not already set there for production — confirm it's the pooled one).
8. Deploy the Prisma-backed code (from `02`).
9. Smoke-test the live production URL: log in, view the dashboard, confirm data matches.
10. Keep the Mongo Atlas cluster running (paused or otherwise preserved, not deleted or canceled) as a rollback safety net for a self-chosen confidence period — weeks, not days, given this is real financial history. No rush to decommission it.

### Rollback plan

Mongo is never modified during any of the above, so rollback is a deploy + env-var revert only:

1. Before starting `02`'s implementation, tag the last Mongoose-based commit: `git tag pre-postgres-migration`.
2. If something looks wrong after cutover, redeploy that tag and point Vercel's `DATABASE_URL` back at the Mongo Atlas URI.
3. Anything created (new transactions, etc.) after cutover but before a rollback decision would exist only in Postgres, not Mongo. For a solo user, manually re-entering a handful of recent transactions is an acceptable gap — keep step 6's pre-cutover verification thorough so this window stays small, rather than building any dual-write mechanism.

## Implementation notes

- New files: `server/scripts/migrate-to-postgres.ts`, `server/scripts/tsconfig.json` (and optionally `server/scripts/verify-migration.ts` if verification is split into its own file).
- Modified: `server/tsconfig.json` (add `scripts` to `exclude`), `server/.env` (add `MONGO_MIGRATION_URI`, temporary).
- The script's Mongo models are defined locally and loosely (`strict: false`) rather than importing the app's real Mongoose models from `user.model.ts`/`transaction.model.ts` — deliberate, so this script has no dependency on app code (which may be mid-rewrite per `02`) and can't accidentally trigger a Mongoose hook (like the password-hashing `pre("save")`) while just reading data.
- If `02` has already deleted `user.model.ts`/`transaction.model.ts` by the time this runs, that's fine — this script never imports them.

## Verify when done

- [ ] `mongodump` backup taken and stored before running the migration script for real.
- [ ] Migration script run against the live Mongo Atlas connection; prints final counts with zero entries in `failed`.
- [ ] Verification script prints `VERIFICATION PASSED`.
- [ ] Local server (from `02`) running against the real migrated Postgres data; logged in with a real existing account and manually confirmed transaction history/summaries match expectations.
- [ ] Expo client run against that local server end-to-end with the real account.
- [ ] Production `DATABASE_URL` confirmed/swapped on Vercel, code deployed, live smoke-test passed.
- [ ] `git tag pre-postgres-migration` exists, created before `02`'s implementation began.
- [ ] Mongo Atlas cluster confirmed still running/preserved (not deleted) after cutover.
