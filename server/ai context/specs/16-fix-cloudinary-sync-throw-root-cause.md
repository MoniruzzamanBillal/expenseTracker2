# 16 — Fix Cloudinary's synchronous throw: the actual source of "something went wrong"

**Status**: ✅ Completed 2026-10-05
**Scope**: `server/` — `util/cloudinary.ts` only. No schema change, no migration, no route change.
Implementation-fix spec, discovered **while implementing** `15-harden-receipt-upload-errors.md` — same
shape as the client side's specs 19/20. Defect 3 in spec 15 is correct but incomplete, and the part it
misses turns out to be the reported bug itself.

## What spec 15's defect 3 assumed

That a Cloudinary failure arrives through `upload_stream`'s **callback**, so wrapping the callback's
`if (error || !result)` branch in an `AppError` was enough:

```ts
const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
  if (error || !result) { /* now an AppError(502) */ }
});
```

## What actually happens

`cloudinary.uploader.upload_stream` validates its credentials **eagerly and synchronously**, before any
stream exists, via `cloudinary.utils.api_url` → `ensureOption`. On a missing credential it does not call
the callback at all — it `throw`s. And it throws a **bare string**, not an `Error`.

Verified by execution against the installed `cloudinary` package:

```
no cloud_name    -> SYNC THROW typeof=string "Must supply cloud_name"
no api_key       -> SYNC THROW typeof=string "Must supply api_key"
no api_secret    -> SYNC THROW typeof=string "Must supply api_secret"
all present      -> no sync throw (callback path)
```

The thrown value has **no `.message`, no `.status`, no `.stack`**:

```
typeof: string   value: "Must supply cloud_name"
err.message: undefined   err.status: undefined   err.stack: undefined
```

## Why this is the reported bug

The throw happens inside `uploadDocumentBuffer`'s `new Promise(...)` executor, so the promise rejects with
that string, `catchAsync` forwards it, and `globalErrorHandler.ts:16-17` does:

```ts
let status  = error.status  || 500;              // undefined -> 500
let message = error.message || "Something went wrong!!";  // undefined -> the literal fallback
```

So the response is exactly:

```json
{ "success": false, "message": "Something went wrong!!", "errorSources": [{ "path": "", "message": "" }] }
```

— HTTP 500, message **"Something went wrong!!"**. The client's interceptor toasts
`error.response.data.message`, which is that string verbatim.

That is the user's reported symptom, word for word. It was **not** a client fallback after all: the backend
really did say it, because the thrown string gave `globalErrorHandler` nothing else to say. This also
confirms **suspect A** from `client/ai context/specs/35`: `CLOUDINARY_CLOUD_NAME` is set in local `server/.env`
but missing from the Vercel-pulled `server/.env.local`, and a missing cloud name produces precisely this
response. Spec 35's diagnosis section should be corrected on that point — it listed the message as
client-side-only, which is now disproven.

Spec 15's callback-side `AppError` does not help here, because the callback never runs.

## Fix

Wrap the `upload_stream` construction itself, keeping spec 15's callback guard as-is (both paths are real —
the callback still fires for genuine upload/network/quota failures once credentials are valid):

```ts
return new Promise((resolve, reject) => {
  let uploadStream;

  try {
    uploadStream = cloudinary.uploader.upload_stream(opts, callback);
  } catch (configError) {
    console.error("Cloudinary upload_stream threw synchronously", configError);
    return reject(
      new AppError(httpStatus.BAD_GATEWAY, "Receipt upload failed, please try again"),
    );
  }

  uploadStream.end(buffer);
});
```

`console.error` is what makes the real cause recoverable — `"Must supply cloud_name"` lands in the Vercel
function log while the caller gets one shaped 502. That is the same best-effort-log convention
`deleteCloudinaryImage` and `helper/openRouter.ts` already use (and the same single `no-console` **warning**
spec 13 accepted for this file).

`deleteCloudinaryImage` needs no change: it already `await`s inside a `try`/`catch`, which catches a
synchronous throw from `destroy()` too.

## Deliberately not fixed here

**`globalErrorHandler` mishandles any thrown non-`Error`.** A thrown string, number or plain object yields
`500 "Something went wrong!!"` with an empty `errorSources` and no `stack`, losing the cause entirely. That
is a global error-handling gap, not a receipt one — fixing it would change every route's error behaviour as
a side effect of a receipt bug, which `ai-workflow-rules.md` forbids. It belongs in `known-issues.md`'s
`ERR-` section (alongside `ERR-1`/`ERR-4`/`ERR-5`) and then its own spec. Flagged, not touched.

Also unchanged, same reasoning as spec 15: `#ERR-1`, `#AUTH-3`, `#VALID-1`, `#AI-2`.

## Verify when done

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` — same 4 pre-existing errors as spec 02's baseline, no new ones (one extra `no-console`
      **warning** in `cloudinary.ts`, the convention spec 13 accepted for this file)
- [x] With `CLOUDINARY_CLOUD_NAME` commented out in `.env`, a receipt `PUT` returns
      **`502 "Receipt upload failed, please try again"`** — not `500 "Something went wrong!!"`
- [x] The same request logs `Cloudinary upload_stream threw synchronously Must supply cloud_name`
      server-side, so the operator can see the real cause
- [x] `.env` restored (byte-identical to the pre-change backup, confirmed by `diff`), and a receipt `PUT`
      with all three credentials present still returns `200` with a real `receiptFileUrl` — the callback
      path is untouched

### Before/after, measured against the running server

The pre-fix behaviour was not inferred — `src/app/util/cloudinary.ts` was temporarily reverted to
`HEAD`'s version against the same live server and the same request, with `CLOUDINARY_CLOUD_NAME` absent:

| | HTTP | `message` | `errorSources` | `stack` |
|---|---|---|---|---|
| Before | `500` | `"Something went wrong!!"` | `[{path:"",message:""}]` | absent |
| After | `502` | `"Receipt upload failed, please try again"` | populated | present (`#ERR-1`, out of scope) |

The "before" row is the user's reported symptom reproduced exactly, from a missing Cloudinary cloud name.

### Note on the empty-string case

Setting `CLOUDINARY_CLOUD_NAME=""` does **not** trigger the synchronous throw — `ensureOption` only rejects
an absent option, so an empty string goes out on the wire and Cloudinary answers `401 Invalid cloud_name`
through the callback. Both paths now converge on the same shaped `502`, which is why spec 15's callback
guard and this spec's wrapper are both needed rather than either alone.
