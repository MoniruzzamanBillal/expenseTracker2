# 10: User profile endpoints (view + update name)

Status: ✅ Completed 2026-09-14

## Cross-repo context

Third of three specs implementing categories + a settings page — independent of the other two (`08`/`09`), grouped here only because it's the server-side counterpart to the same new Settings page:

- `08-category-management.md` / `09-wire-category-to-transaction.md` — categories, unrelated to this doc.
- `client/ai context/specs/15-settings-profile-page.md` — the new Settings screen that displays/edits the profile this doc exposes, and also houses category management (`13-category-management-ui.md`).

Source: user's follow-up on `feature-plan-proposals.md` §1 — "I want a settings page... from where user can... update their information."

## Goal

Give the client a way to fetch the logged-in user's own profile and update their display name, so the new Settings page has something to show and edit beyond what's already cached client-side from login.

## Scope

**In scope:**

- `GET /auth/me` — returns the logged-in user's own profile (name, email, createdAt), **excluding the password hash**.
- `PATCH /auth/update-profile` — updates `name` only.

**Out of scope, with reasons:**

- **Email change** — `email` doubles as the user's login identity and (per `server/ai context/specs/07-bikelog-transaction-request-sync.md`) the matching key bikelog uses to route incoming `TransactionRequest`s to the right account. Changing it has real consequences beyond a simple field edit (uniqueness, re-verification, breaking that cross-repo match) and deserves its own dedicated spec if actually wanted, not a rider on this one.
- **Password change** — security-sensitive (should require re-entering the current password, and arguably session invalidation elsewhere); bundling it into a generic "update profile" endpoint risks doing it hastily. Separate spec if wanted.
- **Profile picture upload** — `User.profilePicture` exists as a bare `String?` column but there's currently no upload path anywhere in the app (registration's own validation schema doesn't even accept it today) and no image storage decision has been made yet — the trimmed feature-plan's "Receipt/photo attachment" item already flags that a cloud storage account/bucket needs picking. Adding a raw "paste an image URL" field here would be a half-built UX nobody asked for; proper photo upload is a follow-up once that storage decision is made.
- Fixing `AUTH-3` (password hash returned by _register_/_login_) — not touched here. This spec's own new `GET /me` endpoint is written to exclude the password from the start (see below), but the older endpoints are left as they are; "fix a known issue as a side effect of unrelated work" is explicitly against this project's own convention.

## Design

### 1. Service — `server/src/app/modules/user/user.services.ts`

```ts
const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      profilePicture: true,
      createdAt: true,
      updatedAt: true,
      // password intentionally excluded — see AUTH-3 scope note above
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return { ...user, _id: user.id };
};

const updateProfile = async (userId: string, payload: { name: string }) => {
  const result = await prisma.user.update({
    where: { id: userId },
    data: { name: payload.name },
    select: {
      id: true,
      name: true,
      email: true,
      profilePicture: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { ...result, _id: result.id };
};
```

Using Prisma's `select` (rather than the existing pattern elsewhere of returning the raw row) is the deliberate mechanism for excluding `password` — no destructuring/`delete` needed, and it can never accidentally regress to leaking the hash if another field is added later.

### 2. Validation — `user.validation.ts`

```ts
const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
  }),
});
```

### 3. Controller — `user.controller.ts`

```ts
const getMe = catchAsync(async (req, res) => {
  const result = await userServices.getMe(req.user.userId);
  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const updateProfile = catchAsync(async (req, res) => {
  const result = await userServices.updateProfile(req.user.userId, req.body);
  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});
```

### 4. Route — `user.route.ts`

```ts
router.get("/me", authCheck, userController.getMe);
router.patch(
  "/update-profile",
  authCheck,
  validateRequest(userValidations.updateProfileSchema),
  userController.updateProfile,
);
```

Mounted under the existing `/auth` prefix (`server/src/app/router/index.ts` already maps `userRouter` there) — resulting endpoints:

- `GET /api/auth/me`
- `PATCH /api/auth/update-profile`

## Implementation notes

Files touched:

- `server/src/app/modules/user/user.services.ts` (edit — add `getMe`, `updateProfile`)
- `server/src/app/modules/user/user.validation.ts` (edit — add `updateProfileSchema`)
- `server/src/app/modules/user/user.controller.ts` (edit — add `getMe`, `updateProfile` controllers)
- `server/src/app/modules/user/user.route.ts` (edit — mount both new routes)

## Verify when done

- [x] `GET /api/auth/me` with a valid JWT returns the user's profile with **no `password` field present at all** (not just blanked — absent from the JSON).
- [x] `GET /api/auth/me` without a token returns `401` (via existing `authCheck`).
- [x] `PATCH /api/auth/update-profile` with `{ name: "New Name" }` updates and returns the new name.
- [x] `PATCH /api/auth/update-profile` with an empty `name` is rejected by validation with `400`.
- [x] `PATCH /api/auth/update-profile` does not accept/change `email` even if included in the body (validation schema doesn't allow the field, so it's silently ignored, not applied).
- [x] `yarn build` / `npx tsc --noEmit` / `yarn lint` clean.

Exercised live against the real dev Neon database via `yarn dev` + curl, same throwaway user as specs 08/09.
