# 20: Fix receipt endpoint contract mismatch in spec 17

Status: 🔧 Implementation fix — discovered while implementing `17-receipt-photo-attachment.md`, before any code was written for it.

## Problem

`17-receipt-photo-attachment.md` was drafted assuming a server contract that doesn't match what `server/ai context/specs/13-receipt-photo-upload.md` actually shipped:

| | Spec 17 assumed | Server actually implements |
|---|---|---|
| Route | `PUT /transactions/receipt-image/:transactionId`, `DELETE /transactions/receipt-image/:transactionId` | `PUT /transactions/receipt-file/:transactionId`, `DELETE /transactions/receipt-file/:transactionId` (`server/src/app/modules/transaction/transaction.route.ts`) |
| Multipart field name | `"image"` (`formData.append("image", file)`) | `"file"` — the route's multer middleware is `uploadReceiptFile.single("file")` |
| Response/type fields | `receiptImageUrl`, `receiptImagePublicId` | `receiptFileUrl`, `receiptFilePublicId`, plus two fields spec 17 didn't anticipate at all: `receiptFileResourceType` (`"image" | "raw"`) and `receiptFileOriginalName` (`server/src/app/modules/transaction/transaction.interface.ts`) |

The server's naming is deliberately broader than "image" — its own comment says "attaching/replacing a transaction's receipt file (image or PDF)" — so `receiptFile*` is the correct, intentional naming; spec 17's `receiptImage*` naming was written without checking the already-implemented server code.

## Fix

Implement spec 17 exactly as designed in every other respect (component structure, action-sheet flow, `usePut` hook shape, tap-to-view/pencil-to-replace/X-to-remove interaction, tap-anywhere-to-dismiss viewer), but with these substitutions throughout:

- Endpoint: `/transactions/receipt-file/:transactionId` (not `receipt-image`).
- FormData field name: `"file"` (not `"image"`).
- `TTransaction` gains `receiptFileUrl?: string | null` and `receiptFilePublicId?: string | null` (not the `receiptImage*` names) — `receiptFileResourceType`/`receiptFileOriginalName` are accepted from the server response but not otherwise used by this UI (the picker only ever produces images from camera/library, so `resourceType` is always `"image"` in practice; the field exists server-side to support a future PDF path, out of scope here).
- `ReceiptImagePicker`'s `value` prop and all component references use `receiptFileUrl`, matching the corrected type.

No behavioral change to the feature as experienced by the user — this is purely a naming correction to match the real, already-deployed server contract.

## Verify

- [x] No `receipt-image` string remains anywhere in the client's receipt-attachment code — grep confirms.
- [x] `formData.append("file", ...)` matches the server's `multer.single("file")` — an upload actually reaches `req.file` server-side rather than being silently dropped.
- [x] `TTransaction`'s new fields are named `receiptFileUrl`/`receiptFilePublicId`, matching `transaction.interface.ts` exactly.
