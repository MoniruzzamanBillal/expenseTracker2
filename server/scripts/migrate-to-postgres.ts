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
  const users = (await MongoUser.find({}).lean()) as any[]; // ALL users, including isDeleted ones
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
  const transactions = (await MongoTransaction.find({}).lean()) as any[]; // ALL, including isDeleted
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

async function verifyMigration() {
  const mongoUserCount = await MongoUser.countDocuments({});
  const pgUserCount = await prisma.user.count();

  const mongoTxCount = await MongoTransaction.countDocuments({});
  const pgTxCount = await prisma.transaction.count();

  const mongoTxs = (await MongoTransaction.find({}).lean()) as any[];
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

  const checks: { name: string; pass: boolean }[] = [
    { name: "user count", pass: mongoUserCount === pgUserCount },
    { name: "transaction count", pass: mongoTxCount === pgTxCount },
    {
      name: "income sum",
      pass:
        Math.abs(mongoIncomeSum - Number(pgIncomeSum._sum.amount)) < EPSILON,
    },
    {
      name: "expense sum",
      pass:
        Math.abs(mongoExpenseSum - Number(pgExpenseSum._sum.amount)) <
        EPSILON,
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

  return allPass;
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
    return;
  }

  console.log("Running verification...");
  const allPass = await verifyMigration();
  if (!allPass) {
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
