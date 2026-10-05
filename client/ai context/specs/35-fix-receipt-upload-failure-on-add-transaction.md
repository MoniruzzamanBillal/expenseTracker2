# 35 — Fix receipt upload failing on Add Transaction (`FETCH-1` again)

**Status**: ✅ Completed 2026-10-05 — Steps 2–5 implemented; Steps 0–1 were diagnostics, already settled by server specs 15/16.
**Scope**: `client/` — `utils/api.ts`, `hooks/useApi.ts`, `components/main/AddTransaction/AddTransactionPage.tsx`,
`components/main/shared/ReceiptImagePicker.tsx`. Companion server spec: `server/ai context/specs/15-harden-receipt-upload-errors.md`.

## Reported symptom

User, on the Add Transaction page: _"when i try to add any receipt why i m getting error from the backend"_, and when
asked what the toast said: _"i get this error 'something went wrong' error message"_.

## The first finding: that message is not from the backend — ⚠️ CORRECTED 2026-10-05

"something went wrong" is a **client** string. There are two candidates and neither carries the server's message:

| Source                       | Text                                        | When                                                                                                          |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `AddTransactionPage.tsx:228` | `"Something went wrong!!"`                  | the outer `catch` of `handleAddTransaction`                                                                   |
| `axiosInstance.ts:76`        | `"Something went wrong. Please try again."` | the interceptor's last-resort fallback, when both `error.response.data.message` and `error.message` are falsy |

> **⚠️ This section was wrong, and `server/ai context/specs/16-fix-cloudinary-sync-throw-root-cause.md` proves it.**
> The message **is** the backend's. `globalErrorHandler.ts:17` has its own fallback,
> `message = error.message || "Something went wrong!!"`, and `cloudinary.uploader.upload_stream` throws a bare
> **string** (no `.message`) when a credential is missing — so a missing `CLOUDINARY_CLOUD_NAME` makes the server
> answer `500 {"message":"Something went wrong!!"}`, which the interceptor toasts verbatim. Reproduced end-to-end
> against a running server on 2026-10-05. **Suspect A below was correct.** The server side is fixed (server specs
> 15/16): that case now returns `502 "Receipt upload failed, please try again"`. What remains on the server is
> confirming the env var is actually set on Vercel.
>
> The two client strings below are still real and still reachable — keep them in mind when reading a _future_
> report — but they were not the cause of this one.

The rest of this spec stands unchanged: the client still cannot report an upload failure at all, which is why the
cause took a server-side investigation to find. Make the real error visible first, then fix what it turns out to be.

## How the flow actually works

Attaching a receipt here is a **two-step save**, not one multipart request (`AddTransactionPage.tsx:172-197`):

1. `POST /transactions/new-transaction` as JSON, via `usePostOutcome`. The server's `toApiShape`
   (`server/.../transaction.service.ts:13-17`) adds `_id`, which the client reads as `result?.data?._id`.
2. `PUT /transactions/receipt-file/<createdId>` with a `FormData` carrying exactly one field, `file`, via `usePut([])`.

The server chain is `authCheck` → `handleReceiptFileUpload` (multer `.single("file")`, `memoryStorage`, 10 MB limit,
`image/*` or `application/pdf`) → controller → Cloudinary → `prisma.transaction.update`. No Zod on that route, no disk
writes, and **no AI/OCR anywhere in the receipt path** (server spec 13 put OCR explicitly out of scope).

### What is already confirmed correct — do not "fix" these

- **The contract matches.** Path, method (`PUT`), field name (`file`) and accepted mimetypes all line up. Spec 20
  already closed the `receipt-image`/`receipt-file` and `image`/`file` drift and its checklist is ticked.
- **The route is deployed.** `curl -X PUT https://exp2server.vercel.app/api/transactions/receipt-file/test123`
  returns `401 "Authorization header missing or malformed"`, which only `authCheck` on that exact route can produce.
  An unmatched path would hit `app.ts`'s 404 handler and say `"API NOT FOUND!"` instead. So this is not a stale deploy.
- **`baseURL` is pointed at production** (`utils/envConfig.ts:2`), so the app is talking to Vercel, not localhost.
- **The missing multipart boundary is a red herring.** `axiosInstance.ts:26` sets
  `Content-Type: multipart/form-data` with no `boundary`, directly contradicting its own comment ("Let the browser set
  the correct multipart boundary"). It survives anyway: on Android OkHttp's `BridgeInterceptor` replaces the header
  from `MultipartBody.contentType()`, on iOS `RCTNetworking` appends its own boundary, and on web axios strips the
  header itself because `hasStandardBrowserEnv` is true there. Worth cleaning up (see Step 5), **not** the cause.

### Why the real error is swallowed — `known-issues.md#FETCH-1`

`axiosInstance.ts:84` ends the response interceptor with `return error;` instead of `Promise.reject(error)`. For this
path specifically:

- `apiPut` (`utils/api.ts:14-17`) resolves with `undefined` on **any** HTTP error — a 400 and a 500 are
  indistinguishable from a success that returned nothing.
- `usePut`'s `onError` (`hooks/useApi.ts:120-122`) never fires, so its `throw error` never runs.
- The `catch (uploadError)` at `AddTransactionPage.tsx:188-196` is therefore **dead code**. Its
  `"Entry saved, receipt didn't upload"` toast can never appear — which is why the user has never seen it.
- Execution continues straight into `resetForm()`, the success toast with the _create's_ message, and
  `router.push("/")`. **A failed receipt upload is presented as a fully successful save**, with at most a stray toast.

This is the same shape of defect as spec 28 (false "Saved offline"), spec 30 (the unrefreshed "Spent on" card) and
spec 34. The create leg was given `apiPostOutcome`/`usePostOutcome` by spec 28; **the PUT leg never got the
equivalent**. That is the gap this spec closes.

## Ranked suspects for the backend error

To be read **after** Step 0/1 produce a real response, not guessed at.

| #   | Suspect                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Where it's fixed                       |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| A   | `CLOUDINARY_CLOUD_NAME` not set on Vercel          | Cloudinary is the only dependency unique to the receipt path, and only the receipt path fails. `server/.env` (mtime 2026-09-14, when server spec 13 landed) has all three `CLOUDINARY_*` keys; `server/.env.local` — written by `vercel env pull`, mtime **2026-09-02**, _before_ spec 13 — has `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` but **no `CLOUDINARY_CLOUD_NAME`**. If it was never added in the dashboard, `cloudinary.config()` gets `cloud_name: undefined` and every upload fails. **CONFIRMED as the mechanism** on 2026-10-05 — server spec 16 reproduced `500 "Something went wrong!!"` from a missing cloud name against a running server. Whether the var is actually missing _on Vercel_ still needs `vercel env ls`. | Vercel dashboard / CLI, no code change |
| B   | Vercel's 4.5 MB request-body cap vs multer's 10 MB | Both image pickers use `quality: 0.7` with **no resize** (`AddTransactionPage.tsx:78-81, 95-98`), so a modern phone photo can clear 4.5 MB. The platform then rejects it with a `413` whose body is `{error:{code,message}}` — note `data.message` is undefined there, so even a fixed client would show a blank reason. The route's `MulterError`→clean-400 wrapper never runs, and the sheet's "up to 10 MB" copy (`:124`) is simply wrong.                                                                                                                                                                                                                                                                                                    | Step 4 here + server spec 15           |
| C   | Vercel function timeout → 504                      | axios allows 60 s (`axiosInstance.ts:13`); `vercel.json` sets no `maxDuration`, so the platform default applies. Several MB in plus a Cloudinary re-upload out can exceed it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | server spec 15                         |
| D   | Server 500s instead of 400-ing                     | `transaction.service.ts:356-379` dereferences `file.buffer` with no `if (!file)` guard, and Cloudinary rejections aren't wrapped in `AppError`, so they fall through `globalErrorHandler.ts:16` to a raw 500 **with a stack trace in production** (`#ERR-1`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | server spec 15                         |

## Step 0 — Read the real error first (no code change)

```bash
cd server
npx vercel env ls production          # confirms or kills suspect A
npx vercel logs exp2server --since 1h # the actual status + message for the receipt PUT
```

If `CLOUDINARY_CLOUD_NAME` is missing: `npx vercel env add CLOUDINARY_CLOUD_NAME production` (and `preview`),
redeploy, retest. That may be the entire user-visible fix — the steps below are still worth doing so the _next_
failure is legible instead of silent.

## Step 1 — Reproduce with curl

Run against **local** (`yarn dev`) and **prod** in turn; the difference between them separates a code bug from a
Vercel env/platform problem. This is the repo's verification convention (no test suite).

```bash
BASE=https://exp2server.vercel.app   # then repeat with http://localhost:5000
T=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
     -d '{"email":"...","password":"..."}' | jq -r .token)
ID=$(curl -s -X POST "$BASE/api/transactions/new-transaction" \
     -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"type":"expense","amount":1,"title":"receipt test","description":" "}' | jq -r .data._id)

curl -i -X PUT "$BASE/api/transactions/receipt-file/$ID" -H "Authorization: Bearer $T" -F "file=@small.jpg"  # ~200 KB
curl -i -X PUT "$BASE/api/transactions/receipt-file/$ID" -H "Authorization: Bearer $T" -F "file=@big.jpg"    # ~5 MB → suspect B
curl -i -X PUT "$BASE/api/transactions/receipt-file/$ID" -H "Authorization: Bearer $T"                        # no file → suspect D
```

Delete the throwaway transaction afterwards. Use a throwaway user rather than the real account if preferred.

## Step 2 — `apiPutOutcome` / `usePutOutcome`

**Do not change the response interceptor.** `FETCH-1` is global and is `progress-tracker.md` Next Up item 1 — fixing
it here would change every screen's error behaviour as a side effect of a receipt bug, which the workflow rules
forbid. Mirror the opt-in escape hatch spec 28 already established instead.

- **`utils/api.ts`** — add `apiPutOutcome`, a direct copy of `apiPostOutcome` (`:43-69`) using `axiosInstance.put`,
  returning the same `TWriteOutcome`: `{ok:true,body}` when the result isn't an `AxiosError`, `{ok:false,offline:true}`
  when there's no `response`, otherwise `{ok:false,offline:false,status,message}`.
- **`hooks/useApi.ts`** — add `usePutOutcome`, modelled on `usePostOutcome` (`:72-90`): same `{url,payload}` params,
  no throwing `onError`, and invalidate only when `outcome.ok`.

Leave `usePut`/`apiPut` in place — `ReceiptImagePicker` and any other caller keep working until migrated.

## Step 3 — Report the real reason, and invalidate on success

**`components/main/AddTransaction/AddTransactionPage.tsx`**

- `:71` — `usePut([])` → `usePutOutcome([...])` with the **same five keys** the create mutation uses (`:64-70`:
  `daily-transaction`, `monthly-transaction`, `weekly-transaction`, `yearly-transaction`, `budgets`). The current
  empty array means even a _successful_ upload refreshes nothing, so the receipt wouldn't show until a manual refetch.
- `:181-196` — drop the dead `try`/`catch` and branch on the outcome:

  ```ts
  const uploadOutcome = await uploadReceiptMutation.mutateAsync({
    url: `/transactions/receipt-file/${createdId}`,
    payload: formData,
  });

  if (!uploadOutcome.ok) {
    Toast.show({
      type: "error",
      text1: "Entry saved, receipt didn't upload",
      text2: uploadOutcome.offline
        ? "You appear to be offline. Open the entry to attach it later."
        : uploadOutcome.message,
      position: "top",
    });
  }
  ```

  The hard-coded `"File too large."` guess in the current `text2` goes — it was a guess, and it is wrong for every
  cause except B.

- Keep `resetForm()` + navigation on the create's success either way: the transaction genuinely was saved, and
  `ReceiptImagePicker` on the transaction detail is the retry path. The toast now says so truthfully.

**`components/main/shared/ReceiptImagePicker.tsx:24-38`** — same switch to `usePutOutcome`, so the post-creation
upload surface reports real errors too. It currently reads success off the same always-`undefined` return.

## Step 4 — Stop sending oversized images

Fixes suspect B at the source and makes C much less likely:

- Add `expo-image-manipulator` (via `npx expo install`) and downscale before upload in both image paths
  (`AddTransactionPage.tsx:75-107`) and in `ReceiptImagePicker.tsx`: resize to max ~1600 px on the long edge,
  JPEG compress ~0.6. PDFs (`pickReceiptPdf`, `:109-121`) pass through untouched.
- Update the sheet copy at `:124` from `"Image or PDF, up to 10 MB"` to match the limit server spec 15 settles on.

## Step 5 — Small cleanups in the same files

Flagged, low priority, explicitly optional — none of these is the cause:

- `axiosInstance.ts:22-27` — `delete config.headers["Content-Type"]` in the `FormData` branch instead of setting a
  boundary-less `multipart/form-data`, so the code matches its own comment and the platform's regenerated header is
  the only one in play.
- `ImagePicker.MediaTypeOptions.Images` is the deprecated form in `expo-image-picker ~17`; `mediaTypes: ["images"]`
  is current. 4 call sites (`AddTransactionPage.tsx:79,96`, `ReceiptImagePicker.tsx:47,62`).
- Both permission handlers (`:76-77`, `:93-94`) `return` silently when permission is denied — no toast, unlike
  `ReceiptImagePicker`. A user who declined the camera prompt gets no feedback at all.

## Out of scope

- **`FETCH-1` itself** (the interceptor) — Next Up item 1, needs its own spec.
- **`#ERR-1`** (stack traces in production) and **`#AUTH-2`** on the server (unauthenticated `/manage-money`) —
  tracked `known-issues.md` entries, not to be fixed as a side effect of unrelated work.
- **`UX-3`** — `ReceiptImagePicker`'s remove confirm still uses `Alert.alert` and is still dead on web (last of the
  three left open by spec 34). Related file, different bug; leave it unless the user asks.

## Documentation drift this uncovered

Spec 17 declares `AddTransactionPage.tsx` **"explicitly, permanently out of scope"** for receipts — "no image field at
create time, per the user's own instruction… This is the entire point of the feature's shape". Create-time upload now
lives there (`:180-197`), added by spec 27's phase 4a (`630363c`), and **spec 27 never recorded the reversal** — it only
claims "receipt upload … kept as-is". Spec 17's scope note needs correcting, or this spec needs to supersede it.

Spec 17 line 76 also records the assumption that caused the boundary bug to go unnoticed: _"`axiosInstance.ts`'s
request interceptor already branches on `config.data instanceof FormData` to set the correct multipart boundary — no
interceptor change needed."_ It branches; it does not set a boundary.

## Implementation notes (2026-10-05)

Steps 2–5 applied as written, **no deviations needed**. Steps 0–1 were the diagnostic steps and were already
settled by server specs 15/16 — the root cause (Cloudinary throwing a bare string on a missing credential,
surfacing as `500 "Something went wrong!!"`) was found and fixed there, which is also what disproved this spec's
original "the message is not from the backend" claim (corrected in place above).

Files changed: `utils/api.ts` (+`apiPutOutcome`), `hooks/useApi.ts` (+`usePutOutcome`),
`components/main/AddTransaction/AddTransactionPage.tsx`, `components/main/shared/ReceiptImagePicker.tsx`,
`utils/axiosInstance.ts` (Step 5.1 only), and a new `utils/prepareReceiptImage.ts`. One new dependency:
`expo-image-manipulator@~14.0.8` (no config plugin, so `app.json` is untouched).

**Step 4 note — the current `expo-image-manipulator` API.** `manipulateAsync` is **deprecated** in v14. The
helper uses the contextual API: `ImageManipulator.manipulate(uri)` → `.resize(...)` → `await renderAsync()` →
`await saveAsync({ format: SaveFormat.JPEG, compress: 0.6 })`. It resizes only when the long edge actually
exceeds 1600px (upscaling a small receipt would *add* bytes), caps width when the picker reports no dimensions,
and renames the output to `.jpg` with `type: "image/jpeg"` — the bytes are always re-encoded as JPEG, so the
name/type must follow or the server's mimetype-driven Cloudinary `resource_type` pick would disagree with the
content. It is best-effort: on any failure it returns the original file rather than blocking the upload, since a
too-large upload now fails with a clean 400 anyway (server spec 15). **PDFs never go through it** — they have no
pixel dimensions and re-encoding one as JPEG would corrupt it.

**Sheet copy** went to "up to 4 MB" to match server spec 15's multer limit. `ReceiptImagePicker`'s copy also
dropped the inaccurate "or PDF" — that picker has always been image-only.

**`usePut` now has zero call sites.** Step 3 migrated the last one (`ReceiptImagePicker`). The spec said to leave
`usePut`/`apiPut` in place, so they are still exported and untouched — but they have joined
`useUpdateData`/`useDeleteData` as dead hooks, which is `known-issues.md#FETCH-2`'s territory. Flagged, not
removed; deleting them is a separate cleanup.

**Out of scope, confirmed untouched**: `FETCH-1` itself (the interceptor still resolves on error — this spec adds
an opt-in escape hatch alongside it, exactly as spec 28 did), `#ERR-1`, and `UX-3` (`ReceiptImagePicker`'s remove
confirm and the Add page's attach sheet are both still `Alert.alert`, so both are still dead on web — which is
why the picker flow cannot be exercised on the web target at all, see below).

## Verify when done

Static verification plus a live integration check of the outcome mapping. The picker UI itself **cannot** be
exercised on the web target: `Alert.alert` no-ops there (`UX-3`), so the attach-receipt action sheet never opens
— that is why every UI step below is marked device-only.

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` clean (note: `expo lint` only covers `app/` and `components/`, not `utils/` or `hooks/`)
- [x] `npx expo export --platform web` succeeds, all 22 routes render — confirms the new
      `expo-image-manipulator` import resolves on the web target too
- [x] `grep -n "catch (uploadError)" components/main/AddTransaction/AddTransactionPage.tsx` → 0 hits
- [x] `grep -rn "usePut(" components/ app/ hooks/` → 0 hits (every call site migrated to `usePutOutcome`)
- [x] `grep -rn "MediaTypeOptions" components/` → 0 hits (Step 5.2, 4 call sites)
- [x] **All four `apiPutOutcome` branches verified against the real local server** (`yarn dev` + a Node harness
      replicating the new interceptor pair byte-for-byte, since the RN module itself can't run in Node):
      success → `{ok:true, body:{...}}`; bad transaction id → `{ok:false,offline:false,status:400,message:"Invalid
      transaction id !!!"}`; oversized file → `{...,message:"File too large"}`; unreachable host →
      `{ok:false,offline:true}`. The toast's `text2` therefore now carries the server's real reason instead of the
      old hard-coded "File too large." guess.
- [x] **Step 5.1 validated in the same run**: the success path worked with `Content-Type` **deleted**, i.e. the
      platform generated the boundary and the server parsed the multipart body. This was the riskiest edit.
- [x] `utils/envConfig.ts` still points at `https://exp2server.vercel.app`
- [x] Throwaway user/transaction hard-deleted and the Cloudinary test asset destroyed at the origin
- [ ] **On a device** (custom dev client — Expo Go can't run this app since spec 26): Add Transaction → Take Photo
      → save → success toast, entry listed on Today, receipt visible when the entry is opened
- [ ] **On a device**: same with Choose from Library, and with Choose PDF (confirm the PDF is *not* re-encoded)
- [ ] **On a device**: the upload refreshes Today/Activity/Budgets without a manual pull-to-refresh (the
      invalidation-keys fix)
- [ ] **On a device**: declining the camera/library permission now shows a "Permission denied" toast (Step 5.3)
- [ ] **Negative case, on a device**: force a server-side failure and confirm the toast reads "Entry saved, receipt
      didn't upload" with the server's actual message in `text2` — not "something went wrong"
- [ ] **Negative case**: airplane mode mid-save → the offline branch message, and the entry still lands in the queue
- [ ] **On a device**: confirm a camera photo now uploads well under 4 MB after the downscale (the whole point of
      Step 4) — check the stored `receiptFileUrl`'s byte size
