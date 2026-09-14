# [Superseded] Transaction categories (originally drafted as spec 08)

Status: ⛔ Superseded 2026-09-14 — before any implementation started, user redirected: categories must be user-created/editable (a real CRUD resource), not a hardcoded fixed enum as designed below. Also folded into a broader ask for a Settings/profile page. Replaced by:

- `08-category-management.md` (category CRUD module)
- `09-wire-category-to-transaction.md` (the actual wiring this doc originally tried to do in one step)
- `10-user-profile-endpoints.md` (profile view/update, for the new Settings page)

Renumbered 2026-09-14 out of the live 08-10 sequence (which it originally occupied as `08-transaction-categories.md`) so the three specs above could run 08→09→10 in the order the user actually wants to build them. Kept below, under this filename, as a historical record of the discarded design — do not implement from this doc.

## Cross-repo context

Companion to the client-side spec for the same feature:

- **This doc** — expenseTracker2 server: the `category` field on `Transaction`, validation, and per-category breakdown in the summary endpoints.
- `client/ai context/specs/12-transaction-categories.md` — expenseTracker2 mobile client: the category picker, badges, and breakdown/filter UI that consumes this doc's changes.

Build/test order: this doc first (testable standalone via curl against the four existing summary endpoints) → the client spec (built against this doc's response shape).

Source proposal: `feature-plan-proposals.md` §1 ("Transaction categories") — this spec is that proposal promoted for actual implementation, per `00-build-plan.md`'s convention.

## Goal

Let every transaction carry a category (Food, Bills, Transport, Shopping, Health, Entertainment, Other) so the existing summary endpoints can report _where_ money goes, not just totals — the foundation the trimmed proposal doc flags as unlocking Budgets and Charts later, though neither is in scope here.

## Scope

**In scope:**

- New `TransactionCategory` enum + `category` field on the `Transaction` Prisma model, backfilled to `other` for all existing rows.
- `category` accepted (optional, defaults to `other`) on create/update validation and both create paths (`addNewTransaction`, `addManyTransaction`).
- A `categoryBreakdown` array added to the **daily**, **monthly**, and **weekly** summary endpoints' responses (the three "current period" endpoints whose data the client spec turns into a breakdown/filter UI).

**Out of scope:**

- Any change to `getYearlySummary` — nesting a per-month `categoryBreakdown` inside all 12 months isn't consumed by any UI yet (History currently renders month bars only); the trimmed proposal's Charts item (donut-by-category) is the natural point to add it, not this spec.
- Any AI inference of category. `moneyManagement`'s (Smart Add) system prompt is untouched — AI-parsed transactions still fall through to the DB default (`other`). Flagged as a follow-up, not silently expanded into this spec.
- Mapping bikelog `TransactionRequest.sourceType` (fuel/maintenance/accessory) to a category on accept — those also default to `other`. Cross-repo, separate concern.
- User-defined/custom categories — the 7 values below are a fixed enum, matching how `TransactionType` already works in this codebase. Revisit only if the user later wants to add/rename categories without a migration.
- Budgets, charts, AI insights — separate proposal items, not this spec.

## Design

### 1. Prisma schema — `server/prisma/schema.prisma`

```prisma
enum TransactionCategory {
  food
  bills
  transport
  shopping
  health
  entertainment
  other
}

model Transaction {
  id          String              @id
  userId      String
  type        TransactionType
  category    TransactionCategory @default(other)
  title       String
  description String?
  amount      Decimal             @db.Decimal(12, 2)
  isDeleted   Boolean             @default(false)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("transactions")
}
```

**Why an enum, not a plain string** (unlike `TransactionRequest.sourceApp`/`sourceType`, which are deliberately plain strings for extensibility): these categories are a fixed, curated list the user picks from — same shape as the existing `TransactionType` enum — not an open set a second caller might extend. DB-level validation is worth the migration cost of adding a category later.

**Why `@default(other)`, not nullable**: every existing row backfills cleanly to `other` when the migration runs, and every aggregation below can group by `category` without a null-bucket special case.

Migration: `npx prisma migrate dev --name add_transaction_category`, following the existing convention (`prisma/migrations/<timestamp>_*`).

### 2. Constant — `server/src/app/modules/transaction/transaction.constant.ts`

```ts
export const transactionConstants = {
  income: "income",
  expense: "expense",
} as const;

export const transactionCategoryConstants = {
  food: "food",
  bills: "bills",
  transport: "transport",
  shopping: "shopping",
  health: "health",
  entertainment: "entertainment",
  other: "other",
} as const;
```

### 3. Interface — `transaction.interface.ts`

Add `category?: keyof typeof transactionCategoryConstants` to `TTransaction`. Optional at the type level — the DB default covers an omitted value.

### 4. Validation — `transaction.validation.ts`

```ts
const categoryEnum = z.enum([
  "food",
  "bills",
  "transport",
  "shopping",
  "health",
  "entertainment",
  "other",
]);

const createTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["income", "expense"]),
    category: categoryEnum.optional(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    amount: z.number().positive("Amount must be greater than 0"),
  }),
});

const updateTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["income", "expense"]).optional(),
    category: categoryEnum.optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
  }),
});
```

### 5. Service — `transaction.service.ts`

- `addNewTransaction` / `addManyTransaction`: pass `category: payload.category` straight into the `create`/`createMany` data — when `undefined`, Prisma applies the schema `@default(other)` itself, no explicit fallback needed in code.
- `toApiShape` already spreads the raw Prisma row, so `category` comes through to every response automatically — no change needed there.
- **Category breakdown** — add a small shared helper (new local function, not exported) reused by the three summary functions below, since all three already build `transactions: TTransaction[]` in memory before returning:

```ts
const buildCategoryBreakdown = (
  transactions: ReturnType<typeof toApiShape>[],
) => {
  const buckets: Record<string, { income: number; expense: number }> = {};

  for (const cat of Object.values(transactionCategoryConstants)) {
    buckets[cat] = { income: 0, expense: 0 };
  }

  for (const t of transactions) {
    const cat = t.category ?? transactionCategoryConstants.other;
    if (t.type === transactionConstants.income) buckets[cat].income += t.amount;
    else if (t.type === transactionConstants.expense)
      buckets[cat].expense += t.amount;
  }

  return Object.entries(buckets).map(([category, v]) => ({
    category,
    income: v.income,
    expense: v.expense,
  }));
};
```

- `getDailyTransactions` → return `{ income, expense, transactions, categoryBreakdown: buildCategoryBreakdown(transactions) }`.
- `getMonthlyTransactions` → return `{ income, expense, transactionData: updatedData, categoryBreakdown: buildCategoryBreakdown(transactions) }` (computed once over the whole month's flat `transactions` array, not per-day — matches how `income`/`expense` totals are already computed for the month as a whole).
- `getWeeklySummary` → same addition: `{ weekStart, weekEnd, income, expense, transactionData, categoryBreakdown: buildCategoryBreakdown(transactions) }`.
- `getYearlySummary` — **unchanged**, per Scope above.

No new endpoints, no route changes — all four existing routes are reused as-is.

## Implementation notes

Files touched:

- `server/prisma/schema.prisma` (edit — new enum + field)
- `server/src/app/modules/transaction/transaction.constant.ts` (edit — add category constants)
- `server/src/app/modules/transaction/transaction.interface.ts` (edit — add `category` field)
- `server/src/app/modules/transaction/transaction.validation.ts` (edit — add `category` to both schemas)
- `server/src/app/modules/transaction/transaction.service.ts` (edit — pass `category` through create paths, add `buildCategoryBreakdown` + wire into daily/monthly/weekly)

## Verify when done

- [ ] `npx prisma migrate dev --name add_transaction_category` runs clean; existing rows read back with `category: "other"`.
- [ ] `POST /api/transactions/new-transaction` with no `category` in the body creates a row with `category: "other"`.
- [ ] `POST /api/transactions/new-transaction` with an explicit `category: "food"` persists and returns `"food"`.
- [ ] An invalid category value (e.g. `"snacks"`) is rejected by validation with a 400, not silently coerced.
- [ ] `PATCH /api/transactions/update-transaction/:id` can change only `category`, leaving other fields untouched.
- [ ] `GET /api/transactions/daily-transaction`, `/monthly-transaction`, `/weekly-transaction` each return a `categoryBreakdown` array covering all 7 categories (zeros for unused ones), and per-category `income`/`expense` sums match a manual check against the raw transaction list.
- [ ] `GET /api/transactions/yearly-transaction` response is byte-for-byte unchanged in shape (no `categoryBreakdown` added) — confirms the scope boundary held.
- [ ] `yarn build` / `npx tsc --noEmit` / `yarn lint` clean, no new errors beyond the existing pre-existing baseline noted in spec 02's verify notes.
