# 07: Bikelog transaction request sync — ingest, accept, reject

Status: ✅ Complete — implemented and verified 2026-09-09, see `ai context/progress-tracker.md`'s Spec 07 Verify section

## Goal

Let the user's other project, **bikelog** (a separate app/DB/auth, same person's bike-spend tracker), push a spend event (fuel, maintenance, accessory purchase) into this app as a **pending review item** instead of the user re-typing it manually. Nothing bikelog sends becomes a real `Transaction` automatically — the user must explicitly accept it from the mobile client (see companion client spec `client/ai context/specs/11-bikelog-transaction-requests-inbox.md`) before it counts toward their totals.

## Cross-repo context

This is one of three specs describing the same feature, split by repo:
- **This doc** — expenseTracker2 server: the new `TransactionRequest` model + ingest/list/accept/reject endpoints.
- `client/ai context/specs/11-bikelog-transaction-requests-inbox.md` — expenseTracker2 mobile client: the inbox screen that consumes these endpoints.
- `bikelog_server/context/specs/30-sync-spend-logs-to-expense-tracker.md` (in the bikelog repo) — the outbound caller that hits this doc's `/ingest` endpoint after a fuel/maintenance/accessory log is created.

Build/test order: this doc first (testable standalone via curl) → the client spec (testable against this doc's endpoints with fake curl'd payloads) → the bikelog spec last (depends on both already working).

## Scope

**In scope:**
- New `TransactionRequest` Prisma model + migration.
- `POST /api/transaction-requests/ingest` — inbound, authenticated by a shared secret (not user JWT), since the caller is another server, not a logged-in user of this app.
- `GET /api/transaction-requests` — authenticated (user JWT), lists the logged-in user's own pending requests.
- `PATCH /api/transaction-requests/:id/accept` — authenticated, optionally overrides `title`/`description`/`amount`, creates a real `Transaction`, marks the request `accepted`.
- `PATCH /api/transaction-requests/:id/reject` — authenticated, soft-marks `rejected` (kept for audit, not deleted).

**Out of scope:**
- Any retry/queue mechanism for bikelog's outbound call if it fails — that's bikelog's problem to log, not this app's problem to solve (see the bikelog spec).
- Editing/deleting an already-accepted or already-rejected request (immutable once reviewed).
- Any UI — covered entirely by spec 11 in `client/`.
- Supporting any `sourceApp` other than `"bikelog"` right now — the schema allows for it (plain string, not an enum) but no second caller exists yet.

## Design

### 1. Prisma schema — `server/prisma/schema.prisma`

Add alongside the existing `TransactionType` enum and `Transaction`/`User` models:

```prisma
enum TransactionRequestStatus {
  pending
  accepted
  rejected
}

model TransactionRequest {
  id             String                   @id
  userEmail      String
  sourceApp      String                   // "bikelog" — plain string so a future second source app doesn't need a migration
  sourceType     String                   // "fuel" | "maintenance" | "accessory"
  sourceRecordId String
  type           TransactionType          @default(expense)
  title          String
  description    String?
  amount         Decimal                  @db.Decimal(12, 2)
  occurredAt     DateTime
  status         TransactionRequestStatus @default(pending)
  transactionId  String?                  // set once accepted; no FK relation — the created Transaction can later be edited/soft-deleted independently
  reviewedAt     DateTime?
  createdAt      DateTime                 @default(now())
  updatedAt      DateTime                 @updatedAt

  @@unique([sourceApp, sourceRecordId])
  @@index([userEmail, status])
  @@map("transaction_requests")
}
```

**Why `userEmail`, not `userId`**: the ingest call may arrive before this person has ever opened this app — there may be no `User` row yet. Resolving to a real `userId` only happens at Accept time, taken from the JWT of whoever is looking at their own inbox, never from the request payload.

**Why the `@@unique([sourceApp, sourceRecordId])` constraint**: it's the idempotency key. Bikelog's outbound call is fire-and-forget and could in principle be sent more than once for the same underlying record (e.g. a manual re-trigger); this constraint means a second identical ingest call is a no-op rather than a duplicate row (see 2.2 below).

Migration: `npx prisma migrate dev --name add_transaction_request`, following this repo's existing migration convention (`prisma/migrations/<timestamp>_*`, deployed via the existing `db:migrate` script) — not `prisma db push`.

### 2. New module — `server/src/app/modules/transactionRequest/`

Mirror the existing `transaction` module's file layout (`transaction.controller.ts`, `.service.ts`, `.route.ts`, `.validation.ts`, `.interface.ts`, `.constant.ts`).

**2.1 Validation** (`transactionRequest.validation.ts`, zod, same style as `transaction.validation.ts:3-10`):

```ts
const ingestTransactionRequestSchema = z.object({
  body: z.object({
    sourceApp: z.string().min(1),
    sourceType: z.enum(["fuel", "maintenance", "accessory"]),
    sourceRecordId: z.string().min(1),
    userEmail: z.string().email(),
    type: z.enum(["income", "expense"]).default("expense"),
    title: z.string().min(1),
    description: z.string().optional(),
    amount: z.number().positive(),
    occurredAt: z.string().datetime(),
  }),
});

const acceptTransactionRequestSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
  }),
});
```

Reject needs no body schema — no `validateRequest` middleware on that route.

**2.2 Service** (`transactionRequest.service.ts`):

- `ingestTransactionRequest(payload)` — `generateObjectId()` (reuse `server/src/app/util/generateObjectId.ts`) + `prisma.transactionRequest.create(...)`. Catch a unique-constraint violation (Prisma error code `P2002`) and, instead of throwing, look the existing row up by `(sourceApp, sourceRecordId)` and return it unchanged — idempotent, and never overwrites a row that may already have been reviewed.
- `getPendingTransactionRequests(userEmail)` — `findMany({ where: { userEmail, status: "pending" }, orderBy: { createdAt: "desc" } })`.
- `acceptTransactionRequest(id, userEmail, userId, edits)`:
  1. `findFirst({ where: { id, userEmail, status: "pending" } })` — throw `AppError(404, ...)` if missing. This single query covers both "not yours" and "already reviewed" in one check, the same shape `transaction.service.ts`'s `updateTransaction` (lines 233-244) already uses for ownership.
  2. Merge `edits` over the stored `title`/`description`/`amount` — an edited value wins, an omitted one falls back to what was ingested.
  3. `prisma.$transaction` the two writes atomically: create the real `Transaction` (via `transactionServices.addNewTransaction`, widened per 2.4 below) and update the request to `status: "accepted"`, `transactionId`, `reviewedAt: new Date()`.
  4. Return `{ transaction, transactionRequest }`.
- `rejectTransactionRequest(id, userEmail)` — same ownership/status guard as accept, then `update({ where: { id }, data: { status: "rejected", reviewedAt: new Date() } })`.

**2.3 Controller** (`transactionRequest.controller.ts`) — thin `catchAsync` wrappers, same shape as `transaction.controller.ts`. The ingest controller checks the shared secret inline (mirrors bikelog's own `x-cron-secret` pattern in `notification.controller.ts:8-15`):

```ts
const ingest = catchAsync(async (req, res) => {
  const key = req.headers["x-integration-key"];
  if (typeof key !== "string" || key !== config.integrationApiKey) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or missing integration key");
  }
  const result = await transactionRequestServices.ingestTransactionRequest(req.body);
  sendResponse(res, { status: httpStatus.CREATED, success: true, message: "Transaction request received", data: result });
});
```

List/accept/reject controllers take the current user from `req.user.userEmail`/`req.user.userId` (populated by `authCheck`) — **never** any identifier from the request body or URL, for ownership.

**2.4 Route** (`transactionRequest.route.ts`):

```ts
router.post("/ingest", transactionRequestController.ingest); // no authCheck — shared secret only
router.get("/", authCheck, transactionRequestController.list);
router.patch("/:id/accept", authCheck, validateRequest(transactionRequestValidations.acceptTransactionRequestSchema), transactionRequestController.accept);
router.patch("/:id/reject", authCheck, transactionRequestController.reject);
```

Mount in `server/src/app/router/index.ts` at `/transaction-requests`, next to the existing `/transactions` entry. Resulting endpoints:
- `POST /api/transaction-requests/ingest`
- `GET /api/transaction-requests`
- `PATCH /api/transaction-requests/:id/accept`
- `PATCH /api/transaction-requests/:id/reject`

### 3. Reuse, don't duplicate — `server/src/app/modules/transaction/transaction.service.ts`

`addNewTransaction` (lines 16-29) currently always uses the singleton `prisma`. Widen it with an optional transaction client, defaulting to `prisma` — fully backward-compatible with its existing callers (`transaction.controller.ts`):

```ts
const addNewTransaction = async (
  payload: TTransaction,
  userId: string,
  client: Pick<typeof prisma, "transaction"> = prisma,
) => {
  const result = await client.transaction.create({
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
};
```

`acceptTransactionRequest` then does:

```ts
return prisma.$transaction(async (tx) => {
  const transaction = await transactionServices.addNewTransaction(
    { type: "expense", title, description, amount },
    userId,
    tx,
  );
  const transactionRequest = await tx.transactionRequest.update({
    where: { id },
    data: { status: "accepted", transactionId: transaction._id, reviewedAt: new Date() },
  });
  return { transaction, transactionRequest };
});
```

### 4. Config — `server/src/app/config/index.ts`

Add `integrationApiKey: process.env.INTEGRATION_API_KEY`. New `.env` var: `INTEGRATION_API_KEY`. Header name on the wire: `x-integration-key`.

## Implementation notes

Files touched/added:
- `server/prisma/schema.prisma` (edit — new enum + model)
- `server/src/app/modules/transactionRequest/*` (new module: interface, constant, validation, service, controller, route)
- `server/src/app/router/index.ts` (edit — mount new router)
- `server/src/app/modules/transaction/transaction.service.ts` (edit — widen `addNewTransaction` signature)
- `server/src/app/config/index.ts` (edit — add `integrationApiKey`)
- `.env` (edit — add `INTEGRATION_API_KEY`)

## Verify when done

- [ ] `npx prisma migrate dev --name add_transaction_request` runs clean.
- [ ] `curl -X POST .../api/transaction-requests/ingest` with a valid `x-integration-key` and a well-formed body returns `201` and a `pending` row.
- [ ] The same curl payload sent twice does **not** create a duplicate row (idempotency via the unique constraint).
- [ ] A missing/wrong `x-integration-key` returns `401`.
- [ ] `GET /api/transaction-requests` with a valid user JWT returns only that user's `pending` rows (test with two different accounts/emails).
- [ ] `PATCH /:id/accept` with edited `amount`/`title` creates a real `Transaction` reflecting the edited values, and the request row flips to `status: "accepted"` with `transactionId` set.
- [ ] `PATCH /:id/accept` on someone else's request (mismatched `userEmail`), or on an already-reviewed request, returns `404`.
- [ ] `PATCH /:id/reject` flips status to `rejected` and the row stops appearing in `GET /api/transaction-requests` but still exists in the DB.
