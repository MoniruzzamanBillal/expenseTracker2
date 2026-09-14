# 13: Receipt photo upload (Cloudinary), attached after transaction creation

Status: 📝 Drafted — awaiting review before implementation starts.

## Cross-repo context

Server side of a 2-spec feature:
- **This doc** — the Cloudinary upload/replace/delete plumbing for one receipt photo per transaction.
- `client/ai context/specs/17-receipt-photo-attachment.md` — the picker/thumbnail/viewer UI that calls these endpoints.

Source: `feature-plan-proposals.md` §3 ("Receipt/photo attachment on transactions"), with the user's explicit constraint that the photo is **never part of transaction creation** — it's attached afterward, editing an existing transaction, the same way Bike Log's own image uploads work.

## This spec resolves `known-issues.md#CFG-3` and part of `NAME-7`, as a side effect of building the feature they describe (not a dedicated cleanup pass)

Worth noting directly rather than silently: while researching this spec, `.env` already contains real `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` values that `config/index.ts` has never read (`CFG-3`), and `cloudinary`/`multer`/`multer-storage-cloudinary` are already `package.json` dependencies with zero usages anywhere in `src` (referenced by `CFG-3`/the `NAME-` section). This spec is what finally wires all of that up — not a bug being "fixed as a side effect of unrelated work," but literally this feature's own implementation, so it's in scope and expected here, unlike this project's usual rule against touching unrelated known-issues.

`NAME-7` also flags a stale compiled `dist/app/util/SendImageCloudinary.js` with no corresponding source in `src/` — a leftover from an earlier, abandoned attempt at this same feature (same filename as the one described in Bike Log server spec 17's "Existing scaffolding" section, from the same boilerplate origin). **Don't resurrect it.** That reference pattern has three real bugs, already found and fixed once in the sibling project's spec 17 — worth inheriting the fix, not the bug:
1. Uploads every file to Cloudinary **twice** (once via multer's `CloudinaryStorage` engine, then again via a manual `cloudinary.uploader.upload()` on `req.file.path`). Only the storage-engine upload is needed.
2. Swallows upload errors with `console.log`, returning `undefined` instead of throwing `AppError`.
3. Never persists the Cloudinary `public_id`, so a replaced/deleted image's old asset is never actually cleaned up.

This spec is written fresh against those three lessons, not by patching the stale file forward.

**One new env var this spec needs that isn't in `.env` yet**: `CLOUDINARY_CLOUD_NAME`. The key/secret are already present, but the cloud name — required by the SDK alongside them — is missing and must be added with the account's real value before any endpoint here can be exercised live. (Per `feature-plan-proposals.md`'s own suggestion, this could reuse the same Cloudinary account/bucket Bike Log's server already uses, rather than standing up a second account — worth confirming with the user before deploying, not assumed here.)

## Goal

Let the user attach a photo to a transaction they've already created (never at create time), replace it, remove it, and have it show up wherever the client fetches that transaction.

## Scope

**In scope:**
- Two flat nullable columns on `Transaction`: `receiptImageUrl`, `receiptImagePublicId`.
- `PUT /transactions/receipt-image/:transactionId` — upload or replace the receipt photo.
- `DELETE /transactions/receipt-image/:transactionId` — remove it.
- Shared Cloudinary config/upload/delete plumbing, reusable if a future spec ever wants images elsewhere in this app.

**Explicitly out of scope:**
- **Anything on `POST /transactions/new-transaction`** — the create endpoint takes no image field and never will as part of this spec; attaching a photo is strictly a post-creation edit action, per the user's own framing ("I won't add image during transaction create time... just like the bikelog image upload approach" — Bike Log's own uploads are likewise dedicated sub-routes bolted onto already-created records, never folded into create payloads).
- `TransactionRequest` (the Bike Log-sourced inbox model, spec 07) — no receipt image support; that model doesn't represent a fully-created transaction yet.
- Multiple photos per transaction — one `receiptImageUrl`/`receiptImagePublicId` pair per transaction, not an array. (Bike Log's `bikeIssue` needed an array for multiple evidence photos; a single receipt per expense doesn't.)
- Any AI/OCR reading of the receipt (e.g. auto-extracting an amount from the photo) — pure attach-and-view only.

## Design

### 1. Config — `server/src/app/config/index.ts`

```ts
export default {
  // ...existing fields...
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
};
```

### 2. Shared upload plumbing (reusable beyond this spec)

- **`server/src/app/util/cloudinary.ts`** (new) — calls `cloudinary.config({ cloud_name: config.cloudinary_cloud_name, api_key: config.cloudinary_api_key, api_secret: config.cloudinary_api_secret })` once, exports the configured `cloudinary` instance and `deleteCloudinaryImage(publicId: string): Promise<void>` — a best-effort wrapper around `cloudinary.uploader.destroy()` that catches and logs rather than throwing, so a failed cleanup never blocks the user's actual replace/delete action.
- **`server/src/app/middleware/upload.ts`** (new, alongside `authCheck.ts`/`validateRequest.ts`) — builds a `CloudinaryStorage` off that `cloudinary` instance (`folder: "expensetracker-receipts"`), an image-only `fileFilter`, and a 5MB size limit; exports `upload` (the multer instance). Single choke point for every upload route — no second mechanism anywhere else in the app.
- **`server/src/app/interface/image.interface.ts`** (new) — `export type TCloudinaryImage = { url: string; publicId: string };`, used to type the mapped `req.file` shape passed into the service layer (the Prisma model itself stores the same data as two flat columns, not this embedded shape — see below).

### 3. Prisma schema — `server/prisma/schema.prisma`

```prisma
model Transaction {
  // ...existing fields...
  receiptImageUrl      String?
  receiptImagePublicId String?
}
```

**Why two flat nullable columns, not an embedded `{url, publicId}` object** — Bike Log's Mongoose schemas store this as a subdocument (`receiptImage?: { url, publicId }`) because Mongoose supports embedded objects natively. Prisma/Postgres has no equivalent without a `Json` column or a separate joined table, both of which are more machinery than two nullable scalar columns need for a single, non-repeating pair of values. Both columns are additive with no `default`, so every existing transaction row stays valid untouched, same additive-migration discipline Bike Log's spec 17 followed.

Migration: `npx prisma migrate dev --name add_transaction_receipt_image`.

### 4. `transaction.interface.ts` — add fields

```ts
export interface TTransaction {
  // ...existing fields...
  receiptImageUrl?: string | null;
  receiptImagePublicId?: string | null;
}
```

### 5. `transaction.service.ts` — two new functions

```ts
const uploadReceiptImage = async (
  transactionId: string,
  userId: string,
  file: { path: string; filename: string }, // req.file, after CloudinaryStorage runs
) => {
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, isDeleted: false },
  });
  if (!existing) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid transaction id !!!");
  }

  if (existing.receiptImagePublicId) {
    await deleteCloudinaryImage(existing.receiptImagePublicId); // best-effort, replaces old asset
  }

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { receiptImageUrl: file.path, receiptImagePublicId: file.filename },
  });
};

const deleteReceiptImage = async (transactionId: string, userId: string) => {
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, isDeleted: false },
  });
  if (!existing) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid transaction id !!!");
  }
  if (!existing.receiptImagePublicId) {
    throw new AppError(httpStatus.BAD_REQUEST, "No receipt image to delete");
  }

  await deleteCloudinaryImage(existing.receiptImagePublicId);

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { receiptImageUrl: null, receiptImagePublicId: null },
  });
};
```

Ownership-guard shape (`findFirst({ id, userId, isDeleted: false })`, `AppError(400, "Invalid transaction id !!!")`) and message wording matches the exact pattern `updateTransaction`/`deleteTransactionData` already use in this same file (`transaction.service.ts:242-268`) — nothing new invented here, just extended to two more entry points.

`CloudinaryStorage` sets `req.file.path` to the uploaded asset's `secure_url` and `req.file.filename` to its Cloudinary `public_id` by the time multer's middleware finishes — same behavior Bike Log's server spec 17 already confirmed and relies on, not re-derived from scratch here.

### 6. `transaction.controller.ts` — two new thin wrappers

Same `catchAsync` + `sendResponse(res, { status, success, message, data })` shape as every other controller function in this file; `data` is the full updated `Transaction` record (matching `updateTransaction`'s existing return-the-record convention).

### 7. `transaction.route.ts` — two new routes

```ts
router.put(
  "/receipt-image/:transactionId",
  authCheck,
  upload.single("image"),
  transactionControllers.uploadReceiptImage,
);

router.delete(
  "/receipt-image/:transactionId",
  authCheck,
  transactionControllers.deleteReceiptImage,
);
```

No `validateRequest` — these are multipart uploads with no JSON body fields to validate (same reasoning Bike Log's spec 17 used for its own image sub-routes). Route naming (`/receipt-image/:transactionId`, fixed-segment-then-id) matches this file's existing flat style (`/update-transaction/:transactionId`, `/delete-transaction/:transactionId`), not a nested-resource (`/transactions/:id/receipt-image`) convention — no router-mounting change needed since these live inside the already-registered `transactionRouter`.

**Note on real `PUT`/`DELETE` verbs**: `budget.route.ts` (spec 12) already introduced this backend's first real hard `DELETE`. This spec adds the first real `PUT` (every other "update" in this app is a `PATCH`) — intentional, matching the HTTP semantics of "replace this sub-resource," not an inconsistency to normalize away. `authCheck`/`validateRequest`/Express handle both verbs identically to any other.

## Implementation notes

Files touched/added:
- `server/src/app/config/index.ts` (edit — add 3 cloudinary config fields)
- `server/src/app/util/cloudinary.ts` (new)
- `server/src/app/middleware/upload.ts` (new)
- `server/src/app/interface/image.interface.ts` (new)
- `server/prisma/schema.prisma` (edit — 2 new columns on `Transaction`)
- `server/src/app/modules/transaction/transaction.interface.ts` (edit)
- `server/src/app/modules/transaction/transaction.service.ts` (edit — 2 new functions)
- `server/src/app/modules/transaction/transaction.controller.ts` (edit — 2 new functions)
- `server/src/app/modules/transaction/transaction.route.ts` (edit — 2 new routes)
- `.env` (edit — add `CLOUDINARY_CLOUD_NAME`; `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` already present)

No new npm packages — `cloudinary`, `multer`, `multer-storage-cloudinary`, `@types/multer` are already installed (confirmed in `package.json`), just never wired to anything until now.

## Verify when done

- [ ] `npx prisma migrate dev --name add_transaction_receipt_image` runs clean.
- [ ] With real `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` set, `PUT /api/transactions/receipt-image/:id` with an image file returns `200` and the response's `data.receiptImageUrl`/`receiptImagePublicId` are populated.
- [ ] Re-uploading (`PUT` again) to the same transaction replaces the image — the old Cloudinary asset is destroyed (verify via a direct request to the old URL, now 404), the field holds only the new one, never both.
- [ ] `DELETE /api/transactions/receipt-image/:id` unsets both fields and destroys the Cloudinary asset.
- [ ] `DELETE` on a transaction with no receipt image returns `400` with "No receipt image to delete", not a silent no-op.
- [ ] Both routes 400 on a `transactionId` belonging to another user, a soft-deleted transaction, or a nonexistent id — matching `updateTransaction`'s existing "Invalid transaction id !!!" behavior exactly.
- [ ] A non-image file upload is rejected by `fileFilter` with a clean `400` before ever reaching Cloudinary, not a `500`.
- [ ] `POST /api/transactions/new-transaction` is confirmed unchanged (diff review) — no image field accepted or required at create time.
- [ ] `yarn build` / `npx tsc --noEmit` / `yarn lint` clean.
