# 46 — User profile picture: upload in Settings, show on Home

**Status**: 🔨 Code written 2026-10-17 (`tsc` + `expo lint` clean) — runtime verification and device pass still pending.
**Depends on `server/ai context/specs/20-user-profile-picture-upload.md`** — build and deploy that first; this UI is
tested against its endpoints (`PUT`/`DELETE /auth/profile-picture`) and response shape.
**Scope**: `client/` — one new component (`UserAvatar`), one new util (`prepareAvatarImage`), edits to
`SettingsPage.tsx`, `HomePage.tsx`, `types/global.types.ts`, and (optionally) `app.json` permission strings.

---

## Request

> in setting page i have the functionality for editing user, but i cant upload a user image. now in setting page, i
> should able to upload user image and edit user image. and currently in home page, in left side i see user avatar
> and if there is no user profile image, i see first text of the name, when i upload image, i should see user image.

---

## Goal

In Settings the user can add, change and remove a profile photo; wherever the app draws the user's avatar (Home header,
Settings profile card) it shows that photo, and falls back to the name initials when there is none.

---

## Design

Colours, radii and type always come from `theme/` (`useTheme()`, `spacing`, `radius`, `text`). Icons are `Ionicons`
(UI chrome — `MaterialCommunityIcons` stays for category icons only). No new visual language: this reuses the
existing accent-dim circle and the Sheet chrome.

### Today's state (what the plan changes)

- `HomePage.tsx:39` and `SettingsPage.tsx:19` each define an identical private `initials()` and each draw the circle by
  hand: `Home` 36 px (`styles.avatar`), `Settings` card 48 px (`styles.avatar`), edit sheet 56 px (`styles.avatarLg`).
  Three hand-rolled avatars, two copies of one helper. A fourth variant (photo) on top of that would be the fifth copy
  of the same circle — hence one shared component.
- Home's avatar is a `TouchableOpacity` → `router.push("/settings")`. **That stays.** Only its content changes.
- Home reads the name from `useUserContext().user`, **not** from the `["profile"]` query. So the photo must reach the
  context too, via `handleSetUser` (persisted to AsyncStorage), or Home will not update until re-login.

### D1 — one `UserAvatar` component

`components/main/shared/UserAvatar.tsx`:

```tsx
type TProps = {
  name?: string | null;
  uri?: string | null;
  size: number;            // diameter; 36 Home, 48 Settings card, 88 edit sheet
  style?: StyleProp<ViewStyle>;
};
```

- Photo present → `expo-image` `<Image source={{ uri }} contentFit="cover" cachePolicy="memory-disk" />` clipped to a
  circle (`borderRadius: size / 2`, `overflow: "hidden"`).
- No photo → the existing accent-dim circle with initials. Text token scales with size (`text.bodyMd` ≤ 48,
  `text.h2` at 88) — the Home header already overrides tokens locally for the same reason.
- **Falls back to initials if the image fails to load** (`onError` → local `failed` state). This matters offline: the
  URL is in the persisted user but the bitmap may not be cached, and a blank grey circle is worse than initials.
  Reset `failed` when `uri` changes.
- Export `initials(name)` from this file and **delete both private copies**.
- `accessibilityLabel` = the user's name.

### D2 — Settings UX: management lives in the Edit-profile sheet, the card just shows the photo

- **Profile card** (`SettingsPage.tsx:~83`): swap the circle for `<UserAvatar size={48} />`. Add a small decorative
  camera badge (corner, `Ionicons camera`, accent) as an affordance. It is **not** its own touch target — the whole
  card is already one `TouchableOpacity` that opens the sheet, and nesting a second one is what causes dead taps.
- **Edit-profile sheet** (`SettingsPage.tsx:~146`): replace the 56 px initials circle with a centred
  `<UserAvatar size={88} />` and, beneath it, two inline text-buttons:
  - `Change photo` (label is `Add photo` when none) — accent colour, `camera-outline` icon.
  - `Remove photo` — only when a photo exists; `C.expense`, `trash-outline`.
  While an upload/remove is in flight, show an `ActivityIndicator` overlay on the avatar and disable both buttons.
- **Choosing the source** uses a small `Sheet`-based list (`Take photo` / `Choose from library` / `Cancel`), **not**
  `Alert.alert`: it no-ops on the web target (`known-issues.md#UX-3`), and `ReceiptImagePicker`'s `Alert` action sheet
  has exactly that gap. This sheet opens from *inside* the Edit-profile sheet — spec 45's probe already proved a
  sheet-inside-a-sheet works here, but confirm it on a device. If it misbehaves, fall back to rendering the two source
  buttons inline in the Edit sheet instead of opening a second one.
  - Hide `Take photo` when `Platform.OS === "web"` (camera capture isn't reliable there); library only.
- **Remove** goes through the existing `ConfirmModal` (title "Remove photo?", destructive), same as the logout change.
- **Upload is immediate and independent of the sheet's Save button** — picking an image uploads it right away,
  exactly like the receipt picker (spec 17). Save still means "save my name" only. This avoids a half-saved state
  where the name is committed and the photo is not, and means there is no "unsaved photo" to lose on dismiss.
- Cropping: `allowsEditing: true, aspect: [1, 1]` so native users pick the framing. Web ignores `allowsEditing`, so the
  util below also centre-crops (D4).

### D3 — Home

`HomePage.tsx:141-145`: replace the hand-built circle with
`<UserAvatar name={user?.name} uri={user?.profilePicture} size={36} />` inside the **same** `TouchableOpacity`
(drop its `styles.avatar` background — the component owns it). Layout, tap target and header height (48) are unchanged.

### D4 — image prep

Mirror `utils/prepareReceiptImage.ts` (same `expo-image-manipulator` API, same "best-effort — return the original on
failure" contract) but avatar-shaped, in `utils/prepareAvatarImage.ts`:

- Centre-crop to a square from the reported `width`/`height` (needed on web, harmless after native crop).
- Resize to **512 × 512**, `SaveFormat.JPEG`, `compress: 0.7` → typically 50–150 KB, far below the server's 2 MB cap
  and Vercel's body cap.
- Return `{ uri, name: "avatar.jpg", type: "image/jpeg" }`; name/type must follow the re-encoded bytes (the receipt
  util's comment explains why).

### States to design for

| State | Behaviour |
| --- | --- |
| No photo | initials circle (today's look) |
| Uploading / removing | spinner over avatar, buttons disabled, no double-submit |
| Upload fails | error toast with the real reason (`outcome.message`); avatar unchanged |
| Offline | toast "You appear to be offline…" (`outcome.offline`); **not queued** — see Out of scope |
| Permission denied | toast naming which permission (camera / photos), same wording style as the receipt picker |
| Image won't load | initials fallback (D1) |
| Light / dark | all colours from tokens; verify both |

---

## Implementation

### 1. Types — `types/global.types.ts`

`IUser.profilePicture?: string` → `profilePicture?: string | null` (the server returns `null` after a remove, and
`undefined` is not what it sends). Check the handful of call sites compile; `HomePage`/`Settings` are the only readers.

### 2. `utils/prepareAvatarImage.ts` (new)

As specified in D4. Signature `prepareAvatarImage(file: TReceiptFile-shaped, width?, height?) => Promise<file>`. Reuse
the `TReceiptFile` type by importing it rather than redefining it (or move nothing — importing is enough; do not
refactor the receipt util).

### 3. `components/main/shared/UserAvatar.tsx` (new)

As specified in D1. Pure presentational, no hooks beyond `useTheme()` and `useState` for the load-failure flag.

### 4. `HomePage.tsx`

- Import `UserAvatar`; render it per D3.
- Delete the local `initials()` (lines 39–43) and `styles.avatar` once unused. `Text`/`text` are still used elsewhere
  in the file — check before removing imports.

### 5. `SettingsPage.tsx`

Remove the local `initials()`, `styles.avatar`, `styles.avatarLg` once replaced. Add:

```tsx
const [sourceOpen, setSourceOpen] = useState(false);
const [removeOpen, setRemoveOpen] = useState(false);
const uploadPhotoMutation = usePutOutcome([["profile"]]);
const removePhotoMutation = useDeleteData([["profile"]]);
const photoBusy = uploadPhotoMutation.isPending || removePhotoMutation.isPending;
const photoUrl = profile?.data?.profilePicture ?? user?.profilePicture ?? null;
```

**Single place that updates the context** — both mutations end in the same helper so Home can never lag:

```tsx
const applyPhoto = async (profilePicture: string | null) =>
  handleSetUser({ ...(user as IUser), profilePicture });
```

**Upload flow** (`pickPhoto(source: "camera" | "library")`):

1. Request the matching permission (`requestCameraPermissionsAsync` / `requestMediaLibraryPermissionsAsync`); on
   denial → error toast, stop. Same copy style as `ReceiptImagePicker`.
2. `launchCameraAsync` / `launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1],
   quality: 0.8 })`. Bail if `canceled`.
3. `const file = await prepareAvatarImage({ uri, name, type }, asset.width, asset.height)`.
4. `const formData = new FormData(); formData.append("file", file as any);`
5. `const outcome = await uploadPhotoMutation.mutateAsync({ url: "/auth/profile-picture", payload: formData })`.
   **No try/catch around this** — under `#FETCH-1` the axios interceptor resolves instead of rejecting, so a catch is
   dead code. `usePutOutcome` resolves a `TWriteOutcome` (`ok` / `offline` / `message` / `body`), which is how
   `ReceiptImagePicker` tells success from failure (spec 35). Follow that pattern.
6. `outcome.ok` → `await applyPhoto(outcome.body?.data?.profilePicture ?? null)`, success toast. Otherwise → error
   toast with `outcome.offline ? "You appear to be offline…" : outcome.message`.

**Remove flow**: `ConfirmModal` → `removePhotoMutation.mutateAsync({ url: "/auth/profile-picture" })`. `useDeleteData`
has no outcome variant, so check `result?.success` as the existing receipt remove does; on success `applyPhoto(null)` +
toast. On failure the interceptor has already toasted — do not toast a second time.

**Layout** exactly per D2. The source chooser is a `Sheet` with two `TouchableOpacity` rows + Cancel, styled like the
other sheet rows in this file. Close the chooser *before* launching the picker (a native picker over an open RN Modal
can fail to present on iOS).

### 6. Optional — `app.json`

`expo-image-picker`'s `photosPermission`/`cameraPermission` strings currently say "…to attach a receipt." Reword to
cover both ("…to attach a receipt or set your profile photo."). These strings are baked into native config, so they
only take effect in the next EAS build; **the feature itself works without a rebuild** (the plugin is already
configured). Leave as is if no build is planned soon.

### 7. Docs

Add a row to `client/ai context/progress-tracker.md`. If `architecture.md`/`project-overview.md` describe the avatar or
Settings page, update that line. Leave `known-issues.md` alone.

---

## Dependencies

**No new packages, no new native module, no new EAS build required.** Everything is already in `package.json`:
`expo-image-picker` (~17.0.11), `expo-image` (~3.0.11), `expo-image-manipulator` (~14.0.8) — all installed for the
receipt feature, and `expo-image-picker` is already registered in `app.json` `plugins`.

Hooks reused as they are: `useFetchData`, `usePutOutcome`, `useDeleteData`, `useUserContext().handleSetUser`.
No change to `hooks/useApi.ts`, `utils/api.ts` or `axiosInstance.ts` (its request interceptor already handles
`FormData`).

---

## Verify

Run the app against the **deployed or local** server that has server spec 20 (check `utils/envConfig.ts` — don't commit
a local URL). Headless-browser pass for web; a real-device pass is still needed for camera/crop (the headless run
can't exercise either).

- [ ] `npx tsc --noEmit` and `yarn lint` clean (no new findings vs. before).
- [ ] No photo: Home header and Settings card show initials exactly as before (visual no-regression).
- [ ] Settings → tap profile card → Edit sheet shows a large avatar with `Add photo`; `Remove photo` is **not** shown.
- [ ] `Add photo` → source sheet opens (on web: library only) → pick an image → spinner → success toast → the sheet
      avatar, the Settings card avatar **and** the Home header avatar all show the photo without a reload or re-login.
- [ ] Navigate Settings → Home: Home shows the photo (context updated, not just the `["profile"]` query).
- [ ] Kill and reopen the app: photo still shows on Home (persisted via `handleSetUser`/AsyncStorage).
- [ ] `Change photo` with a different image → new photo replaces the old everywhere.
- [ ] `Remove photo` → ConfirmModal → confirm → initials return on Home and Settings; `Remove` button disappears.
- [ ] Cancel on the picker / on the confirm → nothing changes, no toast.
- [ ] Editing and saving the **name** while a photo is set keeps the photo (the name save does
      `handleSetUser({...user, name})` — make sure it spreads the *current* user, not a stale copy).
- [ ] Deny photo-library permission → error toast, no crash, no upload.
- [ ] Airplane mode → upload shows the offline toast; avatar unchanged; app still usable.
- [ ] Server rejects (e.g. 400/502 — force with a PDF renamed `.jpg` or bad Cloudinary env on a local server) →
      error toast with the server's message; avatar unchanged; spinner clears.
- [ ] Broken image URL (edit the stored user in devtools) → initials fallback, no empty circle.
- [ ] Log out and log in as another user → no trace of the previous user's photo (login response supplies the new
      `profilePicture`; query cache is cleared on logout).
- [ ] Log in on a fresh install → photo appears straight away (comes from the login payload).
- [ ] Light **and** dark theme look right; avatar remains a clean circle at 36 / 48 / 88 px.
- [ ] Both private `initials()` copies are gone (`grep -rn "function initials" client/components` finds only
      `UserAvatar`'s).
- [ ] Device pass (not headless): camera capture, 1:1 crop UI, Android back button closes the source sheet.

---

## Out of scope

- Queuing avatar uploads for offline (spec 02's queue is transaction-only; an avatar needs a server round-trip).
- Tapping the avatar for a full-screen viewer.
- Syncing a photo changed on **another device** into this one before its next login — the `["profile"]` query already
  returns `profilePicture`, so a follow-up could reconcile it into the context on Settings mount. Not built here;
  flagged because it is the one way the two avatars can disagree.
- Email/password editing, any server-side change (that is server spec 20).
- Touching `ReceiptImagePicker`/`prepareReceiptImage` (including its `Alert.alert` web gap) — different feature.
