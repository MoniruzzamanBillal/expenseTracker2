# 15 — Harden the receipt upload: Vercel body cap, missing-file guard, Cloudinary error shape

**Status**: ✅ Completed 2026-10-05 — defects 1–3 implemented and verified locally; defect 4 deliberately not applied (see Implementation notes). Spawned `16-fix-cloudinary-sync-throw-root-cause.md`.
**Scope**: `server/` — `middleware/uploadReceiptFile.ts`, `modules/transaction/transaction.service.ts`,
`util/cloudinary.ts`, `vercel.json`. No schema change, no migration, no route-shape change.
Companion: `client/ai context/specs/35-fix-receipt-upload-failure-on-add-transaction.md` (holds the full
diagnosis, the reproduction steps and the client-side fix).

## Why now

User-reported: attaching a receipt on the client's Add Transaction page fails with a generic
"something went wrong". The client swallows the real message (`client/ai context/known-issues.md#FETCH-1`),
so the cause is not yet identified — the client spec's Step 0/1 (Vercel env + logs, then a curl matrix)
establish that. This spec covers only what the **server** should do differently regardless of which suspect
it turns out to be: the current code can fail in three ways that produce an unreadable 500 or a response
that never reaches our error handler at all.

Spec 13 built this endpoint and is correct about the contract. Nothing here changes the contract.

## What is already right — don't touch it

- `PUT /api/transactions/receipt-file/:transactionId`, `authCheck` → `handleReceiptFileUpload` → controller.
  Field name `file`, `memoryStorage` (no disk writes — Vercel-safe), `image/*` or `application/pdf` only.
- Ownership is guarded: `findFirst({ id, userId, isDeleted: false })` before anything else
  (`transaction.service.ts:361-366`).
- `resource_type` is picked per-file from the mimetype, and `receiptFileResourceType` is persisted so
  `destroy()` can't silently no-op later. Spec 13 explains both; both still hold.
- The route **is** live on the deployed function — `curl -X PUT .../receipt-file/test123` returns
  `401 "Authorization header missing or malformed"` from `authCheck`, not the 404 handler's `"API NOT FOUND!"`.

## Defect 1 — multer's 10 MB limit is above Vercel's 4.5 MB body cap

`middleware/uploadReceiptFile.ts:19` sets `limits: { fileSize: 10 * 1024 * 1024 }`. Vercel's Node serverless
runtime rejects a request body over ~4.5 MB **at the platform edge**, before the function is invoked. So for a
file between 4.5 and 10 MB:

- multer never sees it, so no `MulterError` is raised;
- `handleReceiptFileUpload`'s wrapper (`transaction.route.ts:16-30`) — written precisely to turn a `MulterError`
  into a clean 400 — never runs;
- `globalErrorHandler` never runs either, so the response isn't our shape. It's Vercel's
  `{error:{code:"FUNCTION_PAYLOAD_TOO_LARGE",message:...}}`, where `data.message` is **undefined** — which is why
  even a client that reports errors correctly would show a blank reason.

The client contributes: both image pickers use `quality: 0.7` with no resize, so a modern phone photo can clear
4.5 MB. Nothing in spec 13 or `known-issues.md` mentions the platform cap.

**Fix**: lower `limits.fileSize` to **4 MB** (`4 * 1024 * 1024`), comfortably under the cap, so an oversized
upload produces our own `400 "File too large"` through the existing wrapper. The client spec's Step 4 adds a
downscale pass so 4 MB is not a practical ceiling for a photo, and updates the "up to 10 MB" UI copy to match.

## Defect 2 — `file.buffer` is dereferenced with no guard

`transaction.service.ts:356-379` takes `file: Express.Multer.File` and reads `file.buffer` at `:377`. If multer
parsed no `file` part — wrong field name, a malformed multipart body, a boundary-less `Content-Type` — then
`req.file` is `undefined` and the controller passes `undefined` straight through (`transaction.controller.ts:124`
casts it: `req.file as Express.Multer.File`). Result: `TypeError: Cannot read properties of undefined (reading
'buffer')` → a 500 with a stack trace, for what is a client mistake.

**Fix**: guard before the ownership lookup, so the cheap check comes first:

```ts
if (!file) {
  throw new AppError(httpStatus.BAD_REQUEST, "No receipt file received");
}
```

## Defect 3 — a Cloudinary failure is an un-shaped 500

`util/cloudinary.ts:32-48` rejects with Cloudinary's raw error. It isn't an `AppError`, so
`globalErrorHandler.ts:16` falls back to `error.status || 500` — and Cloudinary uses `http_code`, not `status`, so
even an auth failure (bad or missing credentials) surfaces as a 500 carrying an internal message plus a full stack
trace in production (`known-issues.md#ERR-1`).

There's a second, quieter problem in the same block: `if (error || !result) return reject(error)`. When `result` is
falsy but `error` is also falsy, this calls `reject(undefined)`, which `catchAsync` forwards as `next(undefined)` —
and Express treats that as "no error", continuing to the 404 handler. The caller would get `"API NOT FOUND!"` for a
failed upload.

**Fix**, in `uploadDocumentBuffer`:

```ts
(error, result) => {
  if (error || !result) {
    console.error("Cloudinary upload failed", error);
    return reject(
      new AppError(httpStatus.BAD_GATEWAY, "Receipt upload failed, please try again"),
    );
  }
  ...
}
```

Keep `deleteCloudinaryImage`'s swallow-and-log exactly as it is — spec 13 is explicit that a failed cleanup must
never block the caller's actual action.

## Defect 4 — no `maxDuration`, so a slow upload can 504

`vercel.json` sets no `maxDuration`, so the platform default applies while the client allows 60 s
(`client/utils/axiosInstance.ts:13`). Several MB in plus a Cloudinary re-upload out can exceed it, and a 504 is
another response that never passes through `globalErrorHandler`.

**Fix, only if Step 0's Vercel logs actually show 504s on this route** — with the legacy `builds` format this goes
in the build entry's config rather than a `functions` block:

```json
{
  "src": "dist/server.js",
  "use": "@vercel/node",
  "config": { "maxDuration": 60 }
}
```

Defect 1's smaller limit plus the client's downscale should make this unnecessary; don't add it speculatively.

## Deployment note — a `git push` does not ship this

`vercel.json` uses the legacy `builds`/`routes` format pointing at **`dist/server.js`**. `dist/` is gitignored and
untracked (`git ls-files server/dist` is empty), `package.json` has no `vercel-build` script, and the legacy format
bypasses Vercel's auto-detected build step. So every change here needs:

```bash
cd server && yarn build && npx vercel --prod
```

This is the open item spec 01 line 195 flagged ("`vercel.json`: not yet verified against a real deploy"). Worth
closing properly — a `vercel-build` script plus the modern `functions` format would remove the hand-built-`dist`
footgun — but that's its own spec, not a rider on a bug fix.

## Out of scope

- **`#ERR-1`** — the unconditional stack trace in every error response. Defect 3 stops the _Cloudinary_ path leaking
  one, but the general fix (gate `stack` on `node_env`) is a separate, tracked item.
- **`#AUTH-2`** — `POST /manage-money` still has no `authCheck` (`transaction.route.ts:83-87`), an open
  unauthenticated path to the OpenRouter key. Still live, Critical, and unrelated to receipts.
- **`#AUTH-3`** — password hashes in auth responses.
- Receipt **OCR / AI parsing**. There is none, by design: spec 13 line 51 puts it explicitly out of scope, and the
  only AI path in the codebase is the text-prompt parser on `/manage-money`. If the user wants receipt scanning,
  that's a new feature spec.

## Known-issues file drift found while scoping this

- `CFG-3` still reads as though `cloudinary`/`multer` are unwired; spec 13 resolved it. The entry is stale.
- `AUTH-1` (no ownership check on transaction update/delete) is stale — the shipped Prisma service guards every
  path with `findFirst({ id, userId, isDeleted: false })`. Its line references point at the Mongoose-era code specs
  01–03 replaced. `AUTH-2` and `ERR-1` in the same file **are** still live.
- `interface/image.interface.ts`'s `TCloudinaryFile` has zero importers, and spec 13 lines 112-137 still show
  `uploadDocumentBuffer` taking 3 args (`buffer, originalname, mimetype`) where the shipped signature takes 2.
  Spec text only; the implementation is internally consistent.

## Implementation notes (2026-10-05)

**Defects 1–3 applied as specified.** Three files, no contract change, no migration:

- `middleware/uploadReceiptFile.ts` — `limits.fileSize` 10MB → **4MB**, with a comment recording why the limit
  has to sit *below* the platform cap for the clean 400 to be reachable at all.
- `modules/transaction/transaction.service.ts` — `if (!file) throw new AppError(400, "No receipt file received")`
  as the first statement in `uploadReceiptFile`, before the ownership query.
- `util/cloudinary.ts` — the callback's `if (error || !result)` branch now rejects with
  `AppError(502, "Receipt upload failed, please try again")` and `console.error`s the real cause.

**Defect 4 (`maxDuration`) NOT applied**, exactly as the spec instructed: it was conditional on Vercel logs showing
504s on this route, and the Vercel CLI is not authenticated in this environment (`npx vercel env ls production`
times out on a login prompt). Nothing was added speculatively. Still open for the user to check — see the two
unchecked boxes below.

**Defect 3 turned out to be incomplete, and the missing half was the reported bug.** `cloudinary.uploader.upload_stream`
validates credentials *synchronously* and throws a bare **string**, so the callback this spec wrapped never runs.
Confirmed by execution, and then demonstrated end-to-end against the running server: with `CLOUDINARY_CLOUD_NAME`
absent, the pre-fix code answered **`500 "Something went wrong!!"`** with empty `errorSources` and no `stack` —
verbatim the message the user reported. Written up and fixed in
[`16-fix-cloudinary-sync-throw-root-cause.md`](16-fix-cloudinary-sync-throw-root-cause.md); the same request now
answers `502` with `Must supply cloud_name` in the server log.

That also settles suspect A from `client/ai context/specs/35`: **a missing `CLOUDINARY_CLOUD_NAME` on Vercel produces
exactly the reported symptom.** `server/.env.local` (pulled from Vercel 2026-09-02, before spec 13 added the var) has
`CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` but no `CLOUDINARY_CLOUD_NAME`. Confirming and setting it on the
deployment is the one remaining user-side action.

**Flagged, not fixed** (new finding, now `known-issues.md#ERR-7`): `globalErrorHandler` mishandles any thrown
non-`Error`. A thrown string/number/plain object yields `500 "Something went wrong!!"` with empty `errorSources` and
no `stack`, losing the cause entirely — which is why this bug was so opaque. Global error-handling concern, not a
receipt one; per `ai-workflow-rules.md` it is flagged rather than patched as a side effect.

## Verify when done

Local `yarn dev` + curl against the Neon dev database — the repo's convention, since there is no test suite. Two
throwaway users (`spec15test@example.com`, `spec15test2@example.com`) and one throwaway transaction were used and
hard-deleted afterwards via a temporary in-tree script (`src/scripts/__tmpSpec1516Cleanup.ts`, reusing the app's own
`prisma` client, removed immediately after running) — same convention as specs 07/08–12/13–14. All three Cloudinary
test assets were deleted from the origin via the Admin API and re-confirmed `404`.

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` — same **4 pre-existing** errors as spec 02's baseline (`app.ts`, `builder/Queryuilder.ts`,
      `interface/index.d.ts`, `middleware/globalErrorHandler.ts`), no new ones. Warnings went 2 → 4: the pre-existing
      `openRouter.ts` + `cloudinary.ts` `no-console`, plus the two new `console.error`s in `cloudinary.ts`, matching
      the convention spec 13 accepted for this file.
- [x] Small JPEG → `200`, body carries `receiptFileUrl`/`receiptFilePublicId`/`receiptFileOriginalName` and
      `receiptFileResourceType: "image"`
- [x] PDF → `200`, `receiptFileResourceType: "raw"`
- [x] Oversized JPEG → **our** `400 "File too large"` with the `errorSources` shape (defect 1). Used a **9.46 MB**
      file rather than 5 MB on purpose: it is under the old 10 MB limit, so it would have been *accepted* before this
      change — it proves the new limit specifically, not just that some limit exists.
- [x] `curl -X PUT ...` with no `-F` → `400 "No receipt file received"`, not a 500 `TypeError` (defect 2)
- [x] `.txt` file → `400 "Only image or PDF files are allowed"` (unchanged behaviour, regression check)
- [x] Bad transaction id → `400 "Invalid transaction id !!!"` (unchanged)
- [x] Another user's transaction id → `400 "Invalid transaction id !!!"`, not a leak (ownership guard holds)
- [x] With `CLOUDINARY_CLOUD_NAME` temporarily unset locally → `502 "Receipt upload failed, please try again"`, no
      internal message in the body (defect 3). Verified for **both** failure modes: an empty-string cloud name takes
      the callback path (Cloudinary answers `401 Invalid cloud_name`), an absent one takes the synchronous-throw path
      (spec 16). Both now return the same shaped 502.
- [x] Replace path: uploaded repeatedly to the same transaction; each previous `publicId` confirmed **gone at the
      origin** via a direct Cloudinary Admin API `resources` lookup (`404`), not merely by trusting a CDN URL — same
      method spec 13 used
- [ ] **Needs the user** — Deployed: `yarn build && npx vercel --prod`, then re-run the whole matrix against
      `https://exp2server.vercel.app`. Not done here: the Vercel CLI is unauthenticated in this environment, and a
      production deploy is the user's call. Remember `dist/` is gitignored and untracked, so a `git push` ships
      nothing on its own.
- [ ] **Needs the user** — `vercel env ls production` lists `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
      `CLOUDINARY_API_SECRET`. This is the likely root cause in production; see Implementation notes.
