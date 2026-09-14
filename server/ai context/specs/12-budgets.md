# 12: Per-category budgets (soft limits, no enforcement)

Status: 📝 Drafted — awaiting review before implementation starts. **Depends on `08-category-management.md` and `09-wire-category-to-transaction.md`** — a budget is meaningless without categories, and computing spend-vs-limit needs transactions actually carrying a `categoryId`.

## Cross-repo context

Server side of a 2-spec feature:
- **This doc** — the `Budget` model, its CRUD endpoints, and the spend-vs-limit computation.
- `client/ai context/specs/16-budgets-screen.md` — the dedicated Budgets screen (progress bars, red-when-over styling), reached via a button on the Settings page (spec 14).

Source: user's follow-up on `feature-plan-proposals.md` §2 ("Per-category budgets with alerts"), with two explicit constraints that shape this spec: **(1) never block or warn against overspending — the user must be able to exceed a limit freely**, and **(2) no push notifications** — the original proposal's "later, a push notification if that infra ever gets added" is explicitly declined, not deferred.

## Goal

Let the user set a monthly spending limit per category and see how much of it they've used this month — a purely informational progress view, never a gate on spending.

## Scope

**In scope:**
- New `Budget` model: one row per (user, category), holding a `monthlyLimit`.
- `POST /budgets` — set a limit for a category that doesn't have one yet.
- `GET /budgets` — list the user's budgets, each enriched with this month's actual spend for that category, a percentage, and an over-limit flag.
- `PATCH /budgets/:id` — change the limit.
- `DELETE /budgets/:id` — remove a budget for a category (a real hard delete — see Design for why this one deviates from `Transaction`/`Category`'s soft-delete convention).

**Explicitly, permanently out of scope (not "later," per the user's own framing):**
- **Any enforcement.** Nothing in `transaction.service.ts`'s create/update path (spec 09) is touched by this spec. There is no check anywhere that a transaction would push a category over budget, and no such check should ever be added silently in a future spec without the user asking for it again — this is a deliberate, explicit product decision, not an oversight.
- **Any notification/alert mechanism** — no cron job, no email, no push infra, no in-app "you're at 80%" banner beyond the progress bar itself changing color when read. The original proposal's alert wording is fully superseded by this instruction.
- **Budgets for income categories** — a "budget" only makes sense against spending; this spec computes spend using `type: "expense"` transactions only, regardless of what type of transactions exist in a budgeted category.
- **Rollover, weekly/yearly budgets, or multi-category budgets** — one flat monthly limit per category, nothing more.

## Design

### 1. Prisma schema — `server/prisma/schema.prisma`

```prisma
model Budget {
  id           String   @id
  userId       String
  categoryId   String   @unique
  monthlyLimit Decimal  @db.Decimal(12, 2)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user     User     @relation(fields: [userId], references: [id])
  category Category @relation(fields: [categoryId], references: [id])

  @@index([userId])
  @@map("budgets")
}
```

Add inverse relations:
```prisma
model User {
  // ...existing fields...
  budgets Budget[]
}

model Category {
  // ...existing fields from spec 08...
  budget Budget?
}
```

**Why `categoryId` is `@unique`, enforcing one budget per category** — matches the feature's own shape (a category has at most one monthly limit); simpler than a compound `[userId, categoryId]` unique, since `categoryId` already belongs to exactly one user (a category can't be shared across users, per spec 08).

**Why hard `DELETE`, not soft delete like `Transaction`/`Category`** — a budget is a current *setting*, not a historical record worth preserving after removal (unlike a transaction or even a category, which past transactions may still reference by name). If `Budget` used soft delete, the `@unique` constraint on `categoryId` would permanently block ever setting a new budget for that category again after the first one was "deleted" — a real usability trap (delete a budget, then can't recreate one for the same category). A real `DELETE` avoids that entirely. This is a deliberate deviation from the codebase's usual soft-delete convention, called out explicitly so it isn't "corrected" back to soft-delete in a later pass without re-deriving this reasoning.

Migration: `npx prisma migrate dev --name add_budget`.

### 2. New module — `server/src/app/modules/budget/`

Mirrors the `category` module's layout (interface, validation, service, controller, route).

**2.1 Validation** (`budget.validation.ts`):
```ts
const createBudgetSchema = z.object({
  body: z.object({
    categoryId: z.string().min(1, "Category is required"),
    monthlyLimit: z.number().positive("Limit must be greater than 0"),
  }),
});

const updateBudgetSchema = z.object({
  body: z.object({
    monthlyLimit: z.number().positive("Limit must be greater than 0"),
  }),
});
```

**2.2 Service** (`budget.service.ts`):

- `createBudget(payload, userId)` — ownership-check `categoryId` (same small `findFirst({ where: { id, userId, isDeleted: false } })` shape spec 09 already uses for the same purpose; duplicated locally here rather than importing a helper across modules, matching this codebase's existing per-module style), then `generateObjectId()` + `prisma.budget.create(...)`. Catch `P2002` (the `categoryId` unique violation) and throw `AppError(httpStatus.CONFLICT, "A budget already exists for this category — update it instead")`.
- `getBudgets(userId)`:
  1. `prisma.budget.findMany({ where: { userId }, include: { category: true } })`, then filter out any whose `category.isDeleted` is `true` (a soft-deleted category's budget quietly stops showing, same as it already stops appearing in the category picker — no separate cleanup job needed).
  2. Compute the current calendar month's boundaries the same way `transaction.service.ts`'s `getMonthlyTransactions` already does (`new Date(year, month-1, 1)` through end of month).
  3. `prisma.transaction.groupBy({ by: ["categoryId"], where: { userId, categoryId: { in: budgetCategoryIds }, type: "expense", isDeleted: false, createdAt: { gte: start, lte: end } }, _sum: { amount: true } })` — `groupBy` here instead of `findMany` + manual reduce (the pattern used elsewhere in this codebase) because only per-category sums are needed, not the individual transactions; pulling every transaction row just to sum it would be wasted work once someone has months of history.
  4. Merge: for each budget, `spent = groupByResult.find(g => g.categoryId === budget.categoryId)?._sum.amount ?? 0`, `percentage = (spent / monthlyLimit) * 100`, `isOverLimit = spent > monthlyLimit`.
  5. Return the merged array: `{ _id, categoryId, category: { name, icon }, monthlyLimit, spent, percentage, isOverLimit }[]`.
- `updateBudget(id, userId, monthlyLimit)` — ownership guard (`findFirst({ where: { id, userId } })`, `AppError(400, "Invalid budget id !!!")` if missing, matching this codebase's existing wording for this case), then `update`.
- `deleteBudget(id, userId)` — same ownership guard, then a real `prisma.budget.delete({ where: { id } })` — not a status flip, per the Design note above.

**2.3 Controller** (`budget.controller.ts`) — thin `catchAsync` wrappers, `req.user.userId` for ownership on every call, same shape as `category.controller.ts`.

**2.4 Route** (`budget.route.ts`):
```ts
router.post("/", authCheck, validateRequest(budgetValidations.createBudgetSchema), budgetController.createBudget);
router.get("/", authCheck, budgetController.getBudgets);
router.patch("/:id", authCheck, validateRequest(budgetValidations.updateBudgetSchema), budgetController.updateBudget);
router.delete("/:id", authCheck, budgetController.deleteBudget);
```

Mount in `server/src/app/router/index.ts` at `/budgets`. Resulting endpoints:
- `POST /api/budgets`
- `GET /api/budgets`
- `PATCH /api/budgets/:id`
- `DELETE /api/budgets/:id`

**Note on the real `DELETE`**: this is, incidentally, the first real call site for an HTTP `DELETE` verb anywhere in this backend — every other "delete" in the app (`Transaction`, and `Category` per spec 08) is a `PATCH .../delete` soft-delete. Not a problem; `authCheck`/`validateRequest`/Express all handle `DELETE` identically to any other verb. Mentioned only so it isn't mistaken for an inconsistency to "fix."

## Implementation notes

Files touched/added:
- `server/prisma/schema.prisma` (edit — new `Budget` model + relations on `User`/`Category`)
- `server/src/app/modules/budget/*` (new module: interface, validation, service, controller, route)
- `server/src/app/router/index.ts` (edit — mount new router)

## Verify when done

- [ ] `npx prisma migrate dev --name add_budget` runs clean.
- [ ] `POST /api/budgets` with a valid `categoryId` + `monthlyLimit` returns `201`.
- [ ] `POST /api/budgets` for a category that already has a budget returns `409`, not a duplicate row.
- [ ] `POST /api/budgets` with a `categoryId` belonging to another user, or a nonexistent one, returns `400`.
- [ ] `GET /api/budgets` returns each budget with a correct `spent` figure matching a manual sum of that category's expense transactions for the current calendar month.
- [ ] **Create transactions that push a category's spend past its `monthlyLimit` — the create call succeeds normally (no error, no block), and `GET /api/budgets` then shows `isOverLimit: true` and `percentage > 100`.** This is the core behavioral requirement of the whole spec — confirm it explicitly, not just assume it from the absence of a check.
- [ ] `PATCH /api/budgets/:id` changes `monthlyLimit` and `GET /api/budgets` reflects it immediately.
- [ ] `DELETE /api/budgets/:id` removes the row entirely (confirmed via direct DB check, not just the list endpoint).
- [ ] After deleting a budget, `POST /api/budgets` for that same `categoryId` succeeds (confirms the hard-delete design choice actually avoids the unique-constraint trap it was meant to avoid).
- [ ] Soft-deleting a category (via spec 08's `PATCH /categories/:id/delete`) that has a budget makes that budget disappear from `GET /api/budgets`, without deleting the `Budget` row itself.
- [ ] `yarn build` / `npx tsc --noEmit` / `yarn lint` clean.
