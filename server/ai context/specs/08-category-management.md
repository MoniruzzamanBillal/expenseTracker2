# 08: Category management (CRUD)

Status: 📝 Drafted — awaiting review before implementation starts

## Cross-repo context

First of three specs implementing categories + a settings page, in build order:
1. **This doc** — the `Category` model and its create/list/update/delete endpoints. Standalone, no dependency on `Transaction`.
2. `09-wire-category-to-transaction.md` — adds `categoryId` to `Transaction` and per-category breakdown to the summary endpoints. **Depends on this doc.**
3. `10-user-profile-endpoints.md` — profile view/update, independent of 1-2 but shipped as part of the same overall Settings-page ask.

Client side: `client/ai context/specs/13-category-management-ui.md` consumes this doc's endpoints.

Supersedes `11-transaction-categories-superseded.md`'s server-side design (a hardcoded fixed enum) — see that file's superseded banner for why.

Source: user's follow-up on `feature-plan-proposals.md` §1 — "at first I want to create category then I will wire the category to the transaction."

## Goal

Let a user create, rename, re-icon, and delete their own categories — a real per-user resource, not a fixed list — before any transaction ever references one.

## Scope

**In scope:**
- New `Category` Prisma model, owned by a user (`userId`), with a `name` and optional `icon`.
- `POST /categories` — create.
- `GET /categories` — list the logged-in user's own non-deleted categories.
- `PATCH /categories/:id` — rename and/or change icon.
- `PATCH /categories/:id/delete` — soft delete (matches `Transaction`'s existing soft-delete convention, not a hard `DELETE`).

**Out of scope:**
- Anything on `Transaction` — that's `09-wire-category-to-transaction.md`.
- Seeding default categories (Food, Bills, ...) for a new user automatically. **Open decision, flagged for the user**: ship with zero categories out of the box (matches the literal "user creates their own" instruction, but Add Transaction's category picker will be empty until the user visits Settings first) vs. seed a small starter set on registration that the user can then rename/delete freely (friendlier first-run, but is itself a small hardcoded list, which is the exact thing being moved away from). Recommend **no auto-seed** for this spec — call it out again in `13`/`14`'s empty-state UX — but this is a one-line change if the user prefers seeding.
- Category ordering/reordering, colors, or any icon beyond a plain string field — not asked for.
- Sharing/cross-user categories — strictly per-user, same isolation as `Transaction`.

## Design

### 1. Prisma schema — `server/prisma/schema.prisma`

```prisma
model Category {
  id        String   @id
  userId    String
  name      String
  icon      String?
  isDeleted Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, name])
  @@index([userId])
  @@map("categories")
}
```

Add the inverse relation on `User`:

```prisma
model User {
  // ...existing fields...
  transactions Transaction[]
  categories   Category[]
}
```

**Why `icon` is a plain optional string, not an enum** (opposite call from the discarded spec `08`'s category-*name* enum): the client will offer a curated icon picker (a fixed list of `MaterialCommunityIcons` names), but that list can grow on the client without a server migration — same reasoning already used for `TransactionRequest.sourceType` in spec 07. Server validation only checks it's a non-empty string when present; it doesn't need to know the exact icon set.

**Why `@@unique([userId, name])`**: prevents a user from accidentally creating two "Food" categories; scoped per-user so two different users can each have their own "Food".

**Why soft delete (`isDeleted`), not a hard `DELETE`**: matches `Transaction`'s existing convention (`server/prisma/schema.prisma`'s `Transaction.isDeleted`), and — more importantly — once `09-wire-category-to-transaction.md` ships, transactions can reference a category by id; hard-deleting the row would either orphan that FK or require `onDelete: Cascade`/`SetNull` gymnastics. Soft delete keeps historical transactions' category name/icon intact while removing it from future pickers.

Migration: `npx prisma migrate dev --name add_category`.

### 2. New module — `server/src/app/modules/category/`

Mirror the existing module layout (interface, validation, service, controller, route) used by `transaction`/`transactionRequest`.

**2.1 Interface** (`category.interface.ts`):
```ts
export type TCategory = {
  userId?: string;
  name: string;
  icon?: string;
  isDeleted?: boolean;
};
```

**2.2 Validation** (`category.validation.ts`):
```ts
const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    icon: z.string().min(1).optional(),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    icon: z.string().min(1).optional(),
  }),
});
```

**2.3 Service** (`category.service.ts`):
- `createCategory(payload, userId)` — `generateObjectId()` + `prisma.category.create(...)`. Catch `P2002` (the `[userId, name]` unique violation) and throw a clear `AppError(httpStatus.CONFLICT, "A category with this name already exists")` instead of letting the raw Prisma error surface.
- `getCategories(userId)` — `findMany({ where: { userId, isDeleted: false }, orderBy: { createdAt: "asc" } })`.
- `updateCategory(id, userId, payload)` — same ownership-guard shape as `transaction.service.ts`'s `updateTransaction`: `findFirst({ where: { id, userId, isDeleted: false } })`, throw 404-ish `AppError(httpStatus.BAD_REQUEST, "Invalid category id !!!")` if missing (matching this codebase's existing wording/status choice for that case, not introducing a new convention), then `update`. Catch `P2002` here too (renaming into a collision with another existing category).
- `deleteCategory(id, userId)` — same ownership guard, then `update({ data: { isDeleted: true } })`.

**2.4 Controller** (`category.controller.ts`) — thin `catchAsync` wrappers, `req.user.userId` for ownership on every call, same shape as `transaction.controller.ts`.

**2.5 Route** (`category.route.ts`):
```ts
router.post("/", authCheck, validateRequest(categoryValidations.createCategorySchema), categoryController.createCategory);
router.get("/", authCheck, categoryController.getCategories);
router.patch("/:id", authCheck, validateRequest(categoryValidations.updateCategorySchema), categoryController.updateCategory);
router.patch("/:id/delete", authCheck, categoryController.deleteCategory);
```

Mount in `server/src/app/router/index.ts` at `/categories`, alongside the existing `/transactions` and `/transaction-requests` entries.

Resulting endpoints:
- `POST /api/categories`
- `GET /api/categories`
- `PATCH /api/categories/:id`
- `PATCH /api/categories/:id/delete`

## Implementation notes

Files touched/added:
- `server/prisma/schema.prisma` (edit — new `Category` model + `User.categories` relation)
- `server/src/app/modules/category/*` (new module: interface, validation, service, controller, route)
- `server/src/app/router/index.ts` (edit — mount new router)

## Verify when done

- [ ] `npx prisma migrate dev --name add_category` runs clean.
- [ ] `POST /api/categories` with `{ name: "Food", icon: "food" }` returns `201` with the created row.
- [ ] Creating a second category with the same `name` for the same user returns a clear `409`, not a raw Prisma error.
- [ ] The same `name` succeeds for a *different* user (per-user uniqueness, not global).
- [ ] `GET /api/categories` returns only the logged-in user's own non-deleted categories.
- [ ] `PATCH /api/categories/:id` can rename and/or change `icon` independently (partial update).
- [ ] `PATCH /api/categories/:id` on another user's category returns the same not-found-style error as an invalid id (no cross-user leakage or edit).
- [ ] `PATCH /api/categories/:id/delete` soft-deletes — the row disappears from `GET /api/categories` but still exists in the DB with `isDeleted: true`.
- [ ] `yarn build` / `npx tsc --noEmit` / `yarn lint` clean, no new errors beyond the existing pre-existing baseline.
