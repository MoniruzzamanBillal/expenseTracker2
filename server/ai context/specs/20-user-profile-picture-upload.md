# 20 — User profile picture: upload, replace, remove

**Status**: ✅ Implemented and verified against the Neon dev DB 2026-10-17 (curl, throwaway user deleted). **Not deployed** — run `yarn db:migrate` first, then `yarn build` + deploy. Deviation: a wrong field name (`image=`) is rejected by multer itself with 400 `"Unexpected field"`, so the service-level `"No image file received"` guard is only reachable if no file part is sent at all.
**Scope**: `server/` only — one Prisma migration, one new multer middleware, two new routes under `/api/auth`, small
changes to `util/cloudinary.ts`, `user.services.ts`, `user.controller.ts`, `user.route.ts`.
**Companion**: `client/ai context/specs/46-user-profile-picture.md` (Settings upload UI + avatar rendering on Home).
**Build and deploy this first** — the client spec is tested against the response shape defined here.

---

## Request

> in setting page i have the functionality for editing user, but i cant upload a user image. now in setting page, i
> should able to upload user image and edit user image. and currently in home page, in left side i see user avatar
> and if there is no user profile image, i see first text of the name, when i upload image, i should see user image.

The server half is "somewhere to put the image and a way to point the user row at it". The `users.profilePicture`
column already exists (and is already in `PUBLIC_USER_SELECT` and the login response), but nothing can write it:
`updateProfileSchema` only accepts `name`, and `register`'s schema has no `profilePicture` field, so every row today
holds `NULL`.

---

## Goal

Let the logged-in user upload, replace and remove their own profile picture, stored on Cloudinary, with the URL kept
in the existing `users.profilePicture` column and the old asset cleaned up on replace/remove.

---

## Design

### Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | **Dedicated endpoints**, not a `profilePicture` field on `PATCH /auth/update-profile` | That route is JSON + Zod; an image is multipart. Same split the receipt feature already made (`PUT /transactions/receipt-file/:id`). The name edit and the photo stay independent mutations. |
| D2 | `PUT /api/auth/profile-picture` (multipart, field name **`file`**) and `DELETE /api/auth/profile-picture` | Mirrors `receipt-file` naming and the field name the client's upload code already uses. Both behind `authCheck`. |
| D3 | **Images only**, no PDF, cap **2 MB** | An avatar has no PDF case. The client resizes to 512 px (~50–150 KB), so 2 MB is generous, and it stays well under Vercel's ~4.5 MB body cap — a body over that cap never reaches multer, so the clean 400 would be unreachable (see the comment in `middleware/uploadReceiptFile.ts`). |
| D4 | New column **`profilePicturePublicId String?`** on `users` | Needed to `destroy` the old Cloudinary asset. Receipts store the same pair. It is **not** added to `PUBLIC_USER_SELECT` — an internal storage id is not the client's business (same reasoning as `isDeleted` in spec 19). |
| D5 | **Upload new → write DB → delete old**, in that order | The receipt flow deletes the old asset *before* uploading, so a failed upload leaves the transaction with a dangling URL. For an avatar that is a visibly broken image. With this order the worst case is an orphaned Cloudinary asset (storage waste, invisible to the user), because the delete is already best-effort. |
| D6 | Server-side Cloudinary transformation: `{ width: 512, height: 512, crop: "fill", gravity: "face" }` at upload | Normalises whatever the client sends (web has no crop UI), keeps the stored asset small, and `gravity: "face"` centres on the face when there is one, falling back to centre. |
| D7 | Cloudinary `folder: "exptracker/avatars"` | Keeps avatars apart from receipts in the media library. |
| D8 | Responses return `PUBLIC_USER_SELECT` shape | Same fields `getMe` returns, so the client can read `data.profilePicture` from either. |

### Contract

```
PUT /api/auth/profile-picture
  Headers : Authorization: Bearer <access token>
  Body    : multipart/form-data, one part named "file" (image/*, ≤ 2 MB)
  200     : { success: true, message: "Profile picture updated successfully",
              data: { id, name, email, profilePicture, createdAt, updatedAt } }
  400     : no file part / not an image / over 2 MB / multipart malformed
  401     : missing or expired access token (client refreshes and replays — routine)
  502     : Cloudinary rejected the upload or is mis-configured

DELETE /api/auth/profile-picture
  200     : same data shape, profilePicture: null
  400     : "No profile picture to remove"
```

### Schema

```prisma
model User {
  ...
  profilePicture         String?
  profilePicturePublicId String?   // Cloudinary public_id of the current avatar, for destroy()
  ...
}
```

Additive and nullable — no backfill, no downtime, safe against the live table. Existing rows keep `NULL` for both.

---

## Implementation

### 1. Migration

Edit `prisma/schema.prisma` as above, then `npx prisma migrate dev --name add_user_profile_picture_public_id`
(creates `prisma/migrations/<timestamp>_add_user_profile_picture_public_id/`). `prisma generate` runs on `postinstall`
and as part of `migrate dev`. Do **not** hand-edit the generated SQL.

### 2. Cloudinary helper — `src/app/util/cloudinary.ts`

`uploadDocumentBuffer` hardcodes the failure message `"Receipt upload failed, please try again"`, which would be
wrong for an avatar. Add **one optional options argument** rather than copying the 60-line function (and its
hard-won sync-throw handling, specs 15/16):

```ts
const uploadDocumentBuffer = (
  buffer: Buffer,
  mimetype: string,
  options?: {
    folder?: string;
    transformation?: Record<string, unknown>[];
    failureMessage?: string; // default keeps today's receipt wording
  },
)
```

- Pass `folder` and `transformation` into the `upload_stream` options object.
- Replace the two `"Receipt upload failed, please try again"` literals with
  `options?.failureMessage ?? "Receipt upload failed, please try again"`.
- **Existing receipt callers pass nothing and behave byte-for-byte as before.** That is the check that this step is
  safe.

Add a thin wrapper next to it so call sites read clearly:

```ts
const uploadAvatarBuffer = (buffer: Buffer, mimetype: string) =>
  uploadDocumentBuffer(buffer, mimetype, {
    folder: "exptracker/avatars",
    transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }],
    failureMessage: "Profile picture upload failed, please try again",
  });
```

Export it. `deleteCloudinaryImage` is reused as-is (`resourceType` defaults to `"image"`, which is correct here).

### 3. Multer middleware — `src/app/middleware/uploadAvatarFile.ts` (new)

Same shape as `uploadReceiptFile.ts`, but:

- `fileFilter` accepts only `file.mimetype.startsWith("image/")`; otherwise
  `cb(new AppError(httpStatus.BAD_REQUEST, "Only image files are allowed"))`.
- `limits: { fileSize: 2 * 1024 * 1024 }`.
- Keep the comment explaining *why* the cap sits under Vercel's body limit — it is the reason the number is not 10 MB.

Also export the `MulterError → 400` normaliser. `transaction.route.ts` has this wrapper inline
(`handleReceiptFileUpload`); **do not refactor that file** (not part of this feature). Write the equivalent wrapper in
`user.route.ts`, or as a small `uploadAvatarFile.single("file")` wrapper function in the new middleware file and
import it. Either is fine; the second keeps `user.route.ts` clean.

### 4. Service — `src/app/modules/user/user.services.ts`

```ts
// ! for setting/replacing the logged-in user's profile picture
const updateProfilePicture = async (userId: string, file: Express.Multer.File) => {
  // multer leaves req.file undefined when no "file" part was parsed (wrong field name,
  // malformed body) — without this guard file.buffer below is a raw TypeError → 500.
  if (!file) throw new AppError(httpStatus.BAD_REQUEST, "No image file received");

  const existing = await prisma.user.findUnique({
    where: { id: userId, isDeleted: false },
    select: { profilePicturePublicId: true },
  });
  if (!existing) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const { url, publicId } = await uploadAvatarBuffer(file.buffer, file.mimetype);

  const result = await prisma.user.update({
    where: { id: userId },
    data: { profilePicture: url, profilePicturePublicId: publicId },
    select: PUBLIC_USER_SELECT,
  });

  if (existing.profilePicturePublicId) {
    await deleteCloudinaryImage(existing.profilePicturePublicId); // best-effort, after the DB write (D5)
  }

  return result;
};

// ! for removing the logged-in user's profile picture
const removeProfilePicture = async (userId: string) => {
  const existing = await prisma.user.findUnique({
    where: { id: userId, isDeleted: false },
    select: { profilePicture: true, profilePicturePublicId: true },
  });
  if (!existing) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (!existing.profilePicture) {
    throw new AppError(httpStatus.BAD_REQUEST, "No profile picture to remove");
  }

  const result = await prisma.user.update({
    where: { id: userId },
    data: { profilePicture: null, profilePicturePublicId: null },
    select: PUBLIC_USER_SELECT,
  });

  if (existing.profilePicturePublicId) {
    await deleteCloudinaryImage(existing.profilePicturePublicId);
  }

  return result;
};
```

Match the file's existing `findUnique`/`isDeleted` idiom (read `getMe` and `updateProfile` just above before writing —
copy how they scope the `where`). Export both from the services object.

### 5. Controller — `user.controller.ts`

Two `catchAsync` handlers following `updateProfile`'s exact shape, `req.user.userId`, `req.file as Express.Multer.File`
for the PUT, messages `"Profile picture updated successfully"` / `"Profile picture removed successfully"`. Add both to
the exported `userController` object.

### 6. Routes — `user.route.ts`

```ts
// ! for uploading/replacing the logged-in user's profile picture
router.put("/profile-picture", authCheck, handleAvatarFileUpload, userController.updateProfilePicture);

// ! for removing it
router.delete("/profile-picture", authCheck, userController.removeProfilePicture);
```

No `validateRequest` — multipart has no Zod-able body, same as the receipt route.

### 7. Docs

- `server/ai context/progress-tracker.md`: add a row for this spec (convention in `CLAUDE.md`).
- `server/ai context/architecture.md`/`project-overview.md`: add the two routes if those files list the auth endpoints.
- Do not touch `known-issues.md` (frozen snapshot).

---

## Dependencies

**None to install.** `multer`, `cloudinary` and `@types/multer` are already in `package.json` (receipt upload).

Environment: `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` already exist in `server/.env` and — per the receipt
feature's history (specs 15/16) — need to be set in Vercel. **Verify they are** before blaming the new code for a 502.

**Deployment (needs the user's go-ahead; both are outward-facing):**
1. `yarn db:migrate` (`prisma migrate deploy`) against production — runs through `DATABASE_URL_UNPOOLED`. The migration
   is additive/nullable, but it is still a production schema change.
2. `yarn build` + deploy from `server/` (`server/vercel.json` serves the gitignored `dist/server.js`, so a `git push`
   ships nothing). Migrate **before** deploying, otherwise the new code queries a column that does not exist yet.

---

## Verify

Follow the repo's convention: `yarn dev` + curl against the real Neon **dev** database, throwaway user, cleaned up
afterwards by a temporary in-tree script.

- [ ] `npx tsc --noEmit` clean; `yarn lint` has no errors beyond the documented baseline (3 errors, 4 warnings).
- [ ] Migration applies on dev; `users` has `profilePicturePublicId` as nullable; existing rows are untouched.
- [ ] Register + login a throwaway user → `userData.profilePicture` is `null`.
- [ ] `PUT /api/auth/profile-picture` with a small JPEG (`-F "file=@x.jpg"`) → 200, `data.profilePicture` is an
      `https://res.cloudinary.com/.../exptracker/avatars/...` URL; the image at that URL is 512×512.
- [ ] The response contains **no** `password` and **no** `profilePicturePublicId`.
- [ ] `GET /api/auth/me` now returns the same `profilePicture`; a fresh login returns it too.
- [ ] Upload a **second** image → 200, URL differs, and the first public_id is gone from Cloudinary (check the media
      library or `cloudinary.api.resource` → 404).
- [ ] `DELETE /api/auth/profile-picture` → 200, `profilePicture: null`; asset gone from Cloudinary; `me` shows `null`.
- [ ] `DELETE` again → 400 `"No profile picture to remove"`.
- [ ] Negative cases: no `Authorization` → 401; wrong field name (`-F "image=@x.jpg"`) → 400 `"No image file received"`
      (not a 500); a PDF → 400 `"Only image files are allowed"`; a >2 MB file → 400 with multer's size message.
- [ ] A soft-deleted user's valid token cannot upload (matches how `getMe` treats `isDeleted`).
- [ ] **Regression**: receipt upload (`PUT /transactions/receipt-file/:id`) still works and its failure message is still
      `"Receipt upload failed, please try again"` — proves the `uploadDocumentBuffer` change was backward compatible.
- [ ] Error-log row is written for one of the 400s (spec 17 behaviour unchanged).
- [ ] Throwaway user deleted and its Cloudinary asset removed; temporary cleanup script deleted.

---

## Out of scope

- Changing email/password (unchanged from spec 10's reasoning).
- Accepting `profilePicture` on `register` — the field stays unused there.
- Orphan-asset sweeper for Cloudinary (D5 makes orphans possible but rare; not worth a cron).
- Image moderation, EXIF stripping beyond what Cloudinary's re-encode already does.
- A `profilePicture` Zod field on `update-profile` — deliberately not added (D1).
