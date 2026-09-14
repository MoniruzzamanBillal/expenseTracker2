# 13: Receipt image/file upload (Cloudinary), attached after transaction creation

Status: 📝 Drafted — awaiting review before implementation starts.

## Cross-repo context

Server side of a 2-spec feature:

- **This doc** — the Cloudinary upload/replace/delete plumbing for one receipt file (image or PDF) per transaction.
- `client/ai context/specs/17-receipt-photo-attachment.md` — the picker/thumbnail/viewer UI that calls these endpoints.

Source: `feature-plan-proposals.md` §3 ("Receipt/photo attachment on transactions"), with the user's explicit constraint that the photo is **never part of transaction creation** — it's attached afterward, editing an existing transaction, the same way Bike Log's own uploads work. Broadened from image-only to image-or-PDF per the user's explicit follow-up request to support "image/file upload... just like the bikelog project," referencing `bikelog_server`'s mixed image+PDF upload pattern (`bikeDocument`, spec 19) as the implementation model.

**⚠️ Breaking change from the previous draft of this spec, flagged for follow-up**: the field names (`receiptImageUrl`/`receiptImagePublicId` → `receiptFileUrl`/`receiptFilePublicId`/`receiptFileResourceType`/`receiptFileOriginalName`) and endpoint path (`/receipt-image/:transactionId` → `/receipt-file/:transactionId`) changed in this revision (see Design §3 below for why). `client/ai context/specs/17-receipt-photo-attachment.md` was drafted against the old names and has **not** been updated yet — it needs a matching pass before either side is implemented. Not done here since only this server-side doc was in scope for this revision; don't implement the client spec against its current (stale) field names.

## This spec resolves `known-issues.md#CFG-3` and part of `NAME-7`, as a side effect of building the feature they describe (not a dedicated cleanup pass)

Worth noting directly rather than silently: while researching this spec, `.env` already contains real `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` values that `config/index.ts` has never read (`CFG-3`), and `cloudinary`/`multer`/`multer-storage-cloudinary` are already `package.json` dependencies with zero usages anywhere in `src` (referenced by `CFG-3`/the `NAME-` section). This spec is what finally wires up `cloudinary`/`multer` — not a bug being "fixed as a side effect of unrelated work," but literally this feature's own implementation, so it's in scope and expected here, unlike this project's usual rule against touching unrelated known-issues.

**`multer-storage-cloudinary` stays installed but unused even after this spec** — see Design §2 for why: accepting either an image or a PDF in the same field means the Cloudinary `resource_type` (`image` vs `raw`) must be picked per-file from its mimetype, which `multer-storage-cloudinary`'s `CloudinaryStorage` engine can't branch on (it takes one static `params` config). This is the same constraint Bike Log's server hit and solved the same way (`bikelog_server/context/specs/19-bike-documents.md` §1) — `CloudinaryStorage` remains a plausible fit for some future image-only upload in this app, just not this one.

`NAME-7` also flags a stale compiled `dist/app/util/SendImageCloudinary.js` with no corresponding source in `src/` — a leftover from an earlier, abandoned attempt at this same feature (same filename as the one described in Bike Log server spec 17's "Existing scaffolding" section, from the same boilerplate origin). **Don't resurrect it.** That reference pattern has three real bugs, already found and fixed once in the sibling project's spec 17:

1. Uploads every file to Cloudinary **twice** (once via multer's `CloudinaryStorage` engine, then again via a manual `cloudinary.uploader.upload()` on `req.file.path`).
2. Swallows upload errors with `console.log`, returning `undefined` instead of throwing `AppError`.
3. Never persists the Cloudinary `public_id`, so a replaced/deleted image's old asset is never actually cleaned up.

This spec is written fresh against those three lessons (and a fourth, found in Bike Log's later mixed-type work — see Design §2's `MulterError` note), not by patching the stale file forward.

**One new env var this spec needs that isn't in `.env` yet**: `CLOUDINARY_CLOUD_NAME`. The key/secret are already present, but the cloud name — required by the SDK alongside them — is missing and must be added with the account's real value before any endpoint here can be exercised live. (Per `feature-plan-proposals.md`'s own suggestion, this could reuse the same Cloudinary account/bucket Bike Log's server already uses, rather than standing up a second account — worth confirming with the user before deploying, not assumed here.)

## Goal

Let the user attach a file — a photo or a scanned/exported PDF (e.g. an emailed invoice) — to a transaction they've already created (never at create time), replace it, remove it, and have it show up wherever the client fetches that transaction.

## Scope

**In scope:**

- Four flat nullable columns on `Transaction`: `receiptFileUrl`, `receiptFilePublicId`, `receiptFileResourceType`, `receiptFileOriginalName`.
- `PUT /transactions/receipt-file/:transactionId` — upload or replace the receipt file (image **or** PDF, one field, mixed-type).
- `DELETE /transactions/receipt-file/:transactionId` — remove it.
- Shared Cloudinary config/upload/delete plumbing, reusable if a future spec ever wants images or documents elsewhere in this app.

**Explicitly out of scope:**

- **Anything on `POST /transactions/new-transaction`** — the create endpoint takes no file field and never will as part of this spec; attaching a receipt is strictly a post-creation edit action, per the user's own framing ("I won't add image during transaction create time... just like the bikelog image upload approach" — Bike Log's own uploads are likewise dedicated sub-routes bolted onto already-created records, never folded into create payloads).
- `TransactionRequest` (the Bike Log-sourced inbox model, spec 07) — no receipt support; that model doesn't represent a fully-created transaction yet.
- Multiple files per transaction — one receipt per transaction, not an array. (Bike Log's `bikeDocument` needed an array because a papers folder can hold multiple scans; a single receipt per expense doesn't.)
- Non-image/non-PDF file types (e.g. `.docx`, `.csv`) — matches Bike Log's own `bikeDocument` scope, which is also image-or-PDF only, not a fully generic file-upload feature.
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

- **`server/src/app/util/cloudinary.ts`** (new) — calls `cloudinary.config({ cloud_name: config.cloudinary_cloud_name, api_key: config.cloudinary_api_key, api_secret: config.cloudinary_api_secret })` once, and exports:
  - `deleteCloudinaryImage(publicId: string, resourceType: "image" | "raw" = "image"): Promise<void>` — a best-effort wrapper around `cloudinary.uploader.destroy(publicId, { resource_type: resourceType })` that catches and logs rather than throwing, so a failed cleanup never blocks the user's actual replace/delete action. Takes `resourceType` (not hardcoded to `"image"`) because a PDF must be destroyed as `"raw"` or Cloudinary silently no-ops.
  - `uploadDocumentBuffer(buffer: Buffer, originalName: string, mimetype: string): Promise<{ url: string; publicId: string; resourceType: "image" | "raw" }>` — wraps `cloudinary.uploader.upload_stream`, picking `resource_type: mimetype.startsWith("image/") ? "image" : "raw"` per call so the same function handles either file kind. Exact pattern (including the `.end(buffer)` stream-write) as `bikelog_server/src/app/util/cloudinary.ts`'s function of the same name.
- **`server/src/app/middleware/uploadReceiptFile.ts`** (new, alongside `authCheck.ts`/`validateRequest.ts`) — `multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: 10 * 1024 * 1024 } })`. `fileFilter` accepts `file.mimetype.startsWith("image/")` OR `file.mimetype === "application/pdf"`, otherwise rejects with `new AppError(httpStatus.BAD_REQUEST, "Only image or PDF files are allowed")`. **Memory storage, not `CloudinaryStorage`** — the upload destination (`image` vs `raw` resource type) depends on the single uploaded file's own mimetype, which `CloudinaryStorage`'s static `params` config can't branch on (same reasoning as Bike Log's `uploadDocument.ts`). 10MB limit, not Bike Log's 20MB — this route always takes exactly one receipt (a single photo or a single-page PDF), never Bike Log's multi-file papers bundle, so the lower per-file image/`multer-storage-cloudinary` precedent (5MB) bumped up just enough to comfortably fit a typical scanned/exported PDF receipt.
- **`server/src/app/interface/image.interface.ts`** (new) — `export type TCloudinaryFile = { url: string; publicId: string; resourceType: "image" | "raw"; originalName: string };`. Unlike Bike Log's `image.interface.ts` (which keeps a separate `TCloudinaryImage` for its still-image-only routes alongside the broader `TCloudinaryFile`), this app has no image-only upload yet, so a single type covers today's one use case — add a narrower `TCloudinaryImage` later only if a future spec actually needs an image-only shape.

### 3. Prisma schema — `server/prisma/schema.prisma`

```prisma
model Transaction {
  // ...existing fields...
  receiptFileUrl          String?
  receiptFilePublicId     String?
  receiptFileResourceType String?
  receiptFileOriginalName String?
}
```

**Why four flat nullable columns, not an embedded `{url, publicId, resourceType, originalName}` object** — Bike Log's Mongoose schemas store this as a subdocument because Mongoose supports embedded objects natively. Prisma/Postgres has no equivalent without a `Json` column or a separate joined table, both more machinery than four nullable scalar columns need for a single, non-repeating set of values per transaction.

**Why `resourceType` and `originalName` are new, beyond the previous draft's two columns** — the previous (image-only) draft only needed `receiptImageUrl`/`receiptImagePublicId`, since every upload was known to be `"image"` and every image is self-previewable (no filename needed). Now that a PDF is a valid upload:

- `receiptFileResourceType` must be persisted because `deleteCloudinaryImage` needs the exact `resource_type` a file was uploaded with to destroy it correctly — Cloudinary silently no-ops a `destroy()` call with a mismatched `resource_type`, so this can't be safely re-derived or guessed at delete time. (No separate `mimeType` column: with the fileFilter restricted to image-or-PDF, `resourceType: "raw"` is unambiguous — it can only mean "PDF" in this app, unlike Bike Log's fully generic `bikeDocument`, which keeps a real `mimeType` alongside `resourceType` for a broader future file-type set this app doesn't need.)
- `receiptFileOriginalName` is needed because a PDF isn't a thumbnail — the client needs _some_ label to show for a non-image receipt (e.g. "invoice-sept.pdf") the way it can just render an image receipt directly.

Both columns are additive with no `default`, so every existing transaction row stays valid untouched, same additive-migration discipline Bike Log's own image/document specs followed.

Migration: `npx prisma migrate dev --name add_transaction_receipt_file`.

### 4. `transaction.interface.ts` — add fields

```ts
export interface TTransaction {
  // ...existing fields...
  receiptFileUrl?: string | null;
  receiptFilePublicId?: string | null;
  receiptFileResourceType?: string | null;
  receiptFileOriginalName?: string | null;
}
```

### 5. `transaction.service.ts` — two new functions

```ts
const uploadReceiptFile = async (
  transactionId: string,
  userId: string,
  file: Express.Multer.File, // memoryStorage — file.buffer is populated, file.path/filename are not
) => {
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, isDeleted: false },
  });
  if (!existing) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid transaction id !!!");
  }

  if (existing.receiptFilePublicId) {
    // best-effort, replaces old asset — resourceType must match what it was uploaded with
    await deleteCloudinaryImage(
      existing.receiptFilePublicId,
      (existing.receiptFileResourceType as "image" | "raw" | null) ?? "image",
    );
  }

  const { url, publicId, resourceType } = await uploadDocumentBuffer(
    file.buffer,
    file.originalname,
    file.mimetype,
  );

  return prisma.transaction.update({
    where: { id: transactionId },
    data: {
      receiptFileUrl: url,
      receiptFilePublicId: publicId,
      receiptFileResourceType: resourceType,
      receiptFileOriginalName: file.originalname,
    },
  });
};

const deleteReceiptFile = async (transactionId: string, userId: string) => {
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, isDeleted: false },
  });
  if (!existing) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid transaction id !!!");
  }
  if (!existing.receiptFilePublicId) {
    throw new AppError(httpStatus.BAD_REQUEST, "No receipt file to delete");
  }

  await deleteCloudinaryImage(
    existing.receiptFilePublicId,
    (existing.receiptFileResourceType as "image" | "raw" | null) ?? "image",
  );

  return prisma.transaction.update({
    where: { id: transactionId },
    data: {
      receiptFileUrl: null,
      receiptFilePublicId: null,
      receiptFileResourceType: null,
      receiptFileOriginalName: null,
    },
  });
};
```

Ownership-guard shape (`findFirst({ id, userId, isDeleted: false })`, `AppError(400, "Invalid transaction id !!!")`) and message wording matches the exact pattern `updateTransaction`/`deleteTransactionData` already use in this same file (`transaction.service.ts:242-268`) — nothing new invented here, just extended to two more entry points.

Unlike the previous (image-only) draft, this upload path calls `uploadDocumentBuffer` explicitly from the service layer rather than reading `req.file.path`/`req.file.filename` off an auto-populated `CloudinaryStorage` — a direct consequence of `uploadReceiptFile.ts` using `memoryStorage` (Design §2). Same manual-upload-from-buffer shape as `bikelog_server`'s `bikeDocument.service.ts#addBikeDocumentFilesIntoDB`.

### 6. `transaction.controller.ts` — two new thin wrappers

Same `catchAsync` + `sendResponse(res, { status, success, message, data })` shape as every other controller function in this file; `data` is the full updated `Transaction` record (matching `updateTransaction`'s existing return-the-record convention).

### 7. `transaction.route.ts` — two new routes

```ts
// ! multer.MulterError (e.g. exceeding the 10MB size limit) isn't an AppError and has no
// ! `.status`, so globalErrorHandler's generic fallback would otherwise turn it into an
// ! unhelpful 500 — normalize it to a clean 400 here, scoped to just this route. Same fix
// ! bikelog_server's bikeDocument.route.ts applied for the same underlying multer behavior.
const handleReceiptFileUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploadReceiptFile.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      return next(new AppError(httpStatus.BAD_REQUEST, error.message));
    }
    if (error) {
      return next(error);
    }
    next();
  });
};

router.put(
  "/receipt-file/:transactionId",
  authCheck,
  handleReceiptFileUpload,
  transactionControllers.uploadReceiptFile,
);

router.delete(
  "/receipt-file/:transactionId",
  authCheck,
  transactionControllers.deleteReceiptFile,
);
```

No `validateRequest` — these are multipart uploads with no JSON body fields to validate (same reasoning Bike Log's uploads use). Route naming (`/receipt-file/:transactionId`, fixed-segment-then-id) matches this file's existing flat style (`/update-transaction/:transactionId`, `/delete-transaction/:transactionId`), not a nested-resource (`/transactions/:id/receipt-file`) convention — no router-mounting change needed since these live inside the already-registered `transactionRouter`.

**Note on real `PUT`/`DELETE` verbs**: `budget.route.ts` (spec 12) already introduced this backend's first real hard `DELETE`. This spec adds the first real `PUT` (every other "update" in this app is a `PATCH`) — intentional, matching the HTTP semantics of "replace this sub-resource," not an inconsistency to normalize away. `authCheck`/`validateRequest`/Express handle both verbs identically to any other.

## Implementation notes

Files touched/added:

- `server/src/app/config/index.ts` (edit — add 3 cloudinary config fields)
- `server/src/app/util/cloudinary.ts` (new)
- `server/src/app/middleware/uploadReceiptFile.ts` (new)
- `server/src/app/interface/image.interface.ts` (new)
- `server/prisma/schema.prisma` (edit — 4 new columns on `Transaction`)
- `server/src/app/modules/transaction/transaction.interface.ts` (edit)
- `server/src/app/modules/transaction/transaction.service.ts` (edit — 2 new functions)
- `server/src/app/modules/transaction/transaction.controller.ts` (edit — 2 new functions)
- `server/src/app/modules/transaction/transaction.route.ts` (edit — 2 new routes + `handleReceiptFileUpload` wrapper)
- `.env` (edit — add `CLOUDINARY_CLOUD_NAME`; `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` already present)

No new npm packages — `cloudinary`, `multer`, `@types/multer` are already installed (confirmed in `package.json`); `multer-storage-cloudinary` stays installed but goes unused by this spec (Design §2).

## Verify when done

- [ ] `npx prisma migrate dev --name add_transaction_receipt_file` runs clean.
- [ ] With real `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` set, `PUT /api/transactions/receipt-file/:id` with an image file returns `200` and the response's `data.receiptFileUrl`/`receiptFilePublicId`/`receiptFileResourceType` (`"image"`)/`receiptFileOriginalName` are populated.
- [ ] `PUT /api/transactions/receipt-file/:id` with a PDF file returns `200`, `receiptFileResourceType` is `"raw"`, and the returned `receiptFileUrl` is fetchable (not a broken `image`-typed URL for a raw asset).
- [ ] Re-uploading (`PUT` again, either type) to the same transaction replaces the file — the old Cloudinary asset is destroyed with the correct `resource_type` (verify via a direct request to the old URL, now 404), the fields hold only the new file, never both.
- [ ] `DELETE /api/transactions/receipt-file/:id` unsets all four fields and destroys the Cloudinary asset (correct `resource_type` for whichever kind was stored).
- [ ] `DELETE` on a transaction with no receipt file returns `400` with "No receipt file to delete", not a silent no-op.
- [ ] Both routes 400 on a `transactionId` belonging to another user, a soft-deleted transaction, or a nonexistent id — matching `updateTransaction`'s existing "Invalid transaction id !!!" behavior exactly.
- [ ] A non-image/non-PDF file upload is rejected by `fileFilter` with a clean `400` before ever reaching Cloudinary, not a `500`.
- [ ] A file exceeding the 10MB limit triggers `multer.MulterError`, caught by `handleReceiptFileUpload` and surfaced as a clean `400`, not a `500`.
- [ ] `POST /api/transactions/new-transaction` is confirmed unchanged (diff review) — no file field accepted or required at create time.
- [ ] `yarn build` / `npx tsc --noEmit` / `yarn lint` clean.
