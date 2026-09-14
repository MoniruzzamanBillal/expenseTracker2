# 09: Wire category to transaction

Status: 📝 Drafted — awaiting review before implementation starts. **Depends on `08-category-management.md` being implemented first** — this doc assumes the `Category` model/endpoints already exist.

## Cross-repo context

Second of three specs implementing categories + a settings page:
1. `08-category-management.md` — the `Category` model + CRUD endpoints. **Build this first.**
2. **This doc** — adds `categoryId` to `Transaction`, lets create/update accept it, and adds a per-category breakdown to the summary endpoints.
3. `10-user-profile-endpoints.md` — unrelated to this doc, same overall Settings-page ask.

Client side: `client/ai context/specs/14-wire-category-to-transaction-ui.md` consumes this doc's changes (picker on Add/Edit, badge on cards, breakdown/filter on Monthly).

Supersedes `11-transaction-categories-superseded.md`'s server-side design — see that file's superseded banner.

## Goal

Let a transaction optionally reference one of the user's own categories (from spec 08), and let the existing summary endpoints report income/expense grouped by category.

## Scope

**In scope:**
- `categoryId` (nullable) added to `Transaction`, pointing at `Category`.
- `categoryId` accepted (optional) on create/update validation and both create paths (`addNewTransaction`, `addManyTransaction`). **Never required**: `createTransactionSchema` has no `.min(1)`/required check on `categoryId` the way it does on `title`/`amount` — a transaction is valid with no category at all, confirmed by user instruction (2026-09-14): category selection on the Add Transaction page must stay optional, not a required field.
- Ownership check: a `categoryId` passed in must belong to the same user creating/updating the transaction — never trust a bare id from the request body without verifying it.
- `categoryBreakdown` added to the **daily**, **monthly**, and **weekly** summary endpoints, now grouped by real category rows (id/name/icon) instead of the discarded fixed-enum design, plus an `"uncategorized"` bucket for transactions with no `categoryId`.

**Out of scope:**
- `getYearlySummary` — same boundary as the discarded spec `08`: no UI consumes a per-month breakdown yet.
- Any AI inference of category (Smart Add) or bikelog `TransactionRequest` category mapping — both keep creating transactions with `categoryId: null` ("Uncategorized"), same reasoning as `08`.
- Deleting a category's effect on existing transactions beyond "keeps working" — covered by spec 08's soft-delete design (the FK still resolves, the category just won't be offered for *new* picks once removed from `GET /categories`).

## Design

### 1. Prisma schema — `server/prisma/schema.prisma`

```prisma
model Transaction {
  id          String          @id
  userId      String
  type        TransactionType
  categoryId  String?
  title       String
  description String?
  amount      Decimal         @db.Decimal(12, 2)
  isDeleted   Boolean         @default(false)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  user     User      @relation(fields: [userId], references: [id])
  category Category? @relation(fields: [categoryId], references: [id])

  @@index([userId])
  @@index([categoryId])
  @@map("transactions")
}
```

Add the inverse relation on `Category`:

```prisma
model Category {
  // ...existing fields from spec 08...
  transactions Transaction[]
}
```

**Why nullable, not a default category**: unlike the discarded spec `08` (which defaulted every transaction to an `"other"` enum value), categories are now something the user must actually create — a brand-new user may have zero categories, so there's nothing sensible to default to. `null` reads as "Uncategorized" client-side. Existing transactions (created before this migration) get `categoryId: null` automatically — no backfill needed.

Migration: `npx prisma migrate dev --name add_category_to_transaction`.

### 2. Validation — `transaction.validation.ts`

```ts
const createTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["income", "expense"]),
    categoryId: z.string().min(1).optional(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    amount: z.number().positive("Amount must be greater than 0"),
  }),
});

const updateTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["income", "expense"]).optional(),
    categoryId: z.string().min(1).nullable().optional(), // nullable to allow explicitly clearing a category
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
  }),
});
```

### 3. Interface — `transaction.interface.ts`

Add `categoryId?: string | null` to `TTransaction`.

### 4. Service — `transaction.service.ts`

**Ownership check helper** (new, private to the module) — used by both create and update, since a `categoryId` is user-supplied input that must be verified before trusting it:

```ts
const assertCategoryOwnership = async (categoryId: string | null | undefined, userId: string) => {
  if (!categoryId) return;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, isDeleted: false },
  });
  if (!category) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid category id !!!");
  }
};
```

- `addNewTransaction`: call `await assertCategoryOwnership(payload.categoryId, userId)` before `create`; pass `categoryId: payload.categoryId` into the `data` object.
- `addManyTransaction`: same check per item (a `Promise.all` over the payload array) before the `createMany`.
- `updateTransaction`: call `await assertCategoryOwnership(payload.categoryId, userId)` before `update` (only when `categoryId` is present in the payload — an update that doesn't touch category shouldn't require re-validating it).
- `toApiShape` already spreads the row, so `categoryId` flows through to responses with no change there — but **the summary functions below now need the related `Category` row**, not just the id, so their queries switch from `findMany({ where })` to `findMany({ where, include: { category: true } })`.

**Category breakdown** — replaces the discarded spec `08`'s fixed-bucket version, now grouped dynamically by whatever categories actually appear in the transaction set:

```ts
const buildCategoryBreakdown = (
  transactions: Array<ReturnType<typeof toApiShape> & { category: { id: string; name: string; icon: string | null } | null }>,
) => {
  const buckets: Record<string, { categoryId: string | null; name: string; icon: string | null; income: number; expense: number }> = {};

  for (const t of transactions) {
    const key = t.category?.id ?? "uncategorized";
    if (!buckets[key]) {
      buckets[key] = {
        categoryId: t.category?.id ?? null,
        name: t.category?.name ?? "Uncategorized",
        icon: t.category?.icon ?? null,
        income: 0,
        expense: 0,
      };
    }
    if (t.type === transactionConstants.income) buckets[key].income += t.amount;
    else if (t.type === transactionConstants.expense) buckets[key].expense += t.amount;
  }

  return Object.values(buckets);
};
```

Note this only emits buckets for categories that actually have transactions this period (unlike `08`'s all-7-always-present design) — with dynamic per-user categories there's no fixed universe to pre-populate, so an empty/unused category simply doesn't appear, which is the correct behavior for a client-rendered breakdown.

- `getDailyTransactions`, `getMonthlyTransactions`, `getWeeklySummary`: same wiring as `08`'s design — add `categoryBreakdown: buildCategoryBreakdown(transactions)` to each return value, using the now-`include`-d `transactions` array.
- `getYearlySummary` — **unchanged**, per Scope above.

No new endpoints, no route changes — all four existing summary routes are reused as-is; only their internal query (`include`) and return shape change.

## Implementation notes

Files touched:
- `server/prisma/schema.prisma` (edit — `categoryId` + relation on `Transaction`, inverse relation on `Category`)
- `server/src/app/modules/transaction/transaction.interface.ts` (edit — add `categoryId`)
- `server/src/app/modules/transaction/transaction.validation.ts` (edit — add `categoryId` to both schemas)
- `server/src/app/modules/transaction/transaction.service.ts` (edit — ownership check, pass `categoryId` through create/update, `include: { category: true }` + `buildCategoryBreakdown` in daily/monthly/weekly)

## Verify when done

- [ ] `npx prisma migrate dev --name add_category_to_transaction` runs clean; existing rows read back with `categoryId: null`.
- [ ] Creating a transaction with a `categoryId` that belongs to the logged-in user succeeds and the response includes it.
- [ ] Creating a transaction with a `categoryId` belonging to a *different* user (or a nonexistent id) returns a `400`, not silently accepted.
- [ ] Creating a transaction with no `categoryId` succeeds with `categoryId: null`.
- [ ] `PATCH update-transaction` can change `categoryId` to another owned category, or explicitly to `null` to clear it.
- [ ] `GET daily-transaction` / `monthly-transaction` / `weekly-transaction` each return a `categoryBreakdown` array whose entries' `income`/`expense` sums match a manual check, including an `"Uncategorized"` bucket when at least one transaction has `categoryId: null`.
- [ ] A category with zero transactions this period does **not** appear in `categoryBreakdown` (confirms the dynamic-bucket behavior, distinct from `08`'s discarded always-7-buckets design).
- [ ] `GET yearly-transaction` response shape is unchanged — confirms the scope boundary held.
- [ ] `yarn build` / `npx tsc --noEmit` / `yarn lint` clean.
