# 05: Fix Blank Error Toast on Network Failure

## Goal

The user reported it directly: pulling to refresh on Home while offline shows the error-colored Toast container, but no message text inside it. Root cause, confirmed by reading `utils/axiosInstance.ts`'s response error interceptor: the Toast's text comes from `error?.response?.data?.message` (line 70), which is only ever populated for a real HTTP error response. For a pure network failure — offline, timeout, DNS failure, server unreachable — `error.response` doesn't exist at all, so the message is `undefined` and the Toast renders blank. Newly documented as `known-issues.md#FETCH-7`. This spec fixes that one line so a network failure always shows *some* readable message.

## Scope

**In scope:**

- Give the error interceptor's Toast a non-blank message for the no-`response` case (offline/timeout/unreachable), falling back through `error.message` (Axios's own description, e.g. "Network Error") before a final hardcoded fallback string.

**Out of scope (explicitly):**

- `FETCH-1` (the interceptor resolving instead of rejecting) — separately tracked, already prioritized in `progress-tracker.md`'s "Next Up," and a materially larger change (it has downstream effects on every `onError`/`catch` in the app). This spec does not touch the `return error;` / commented-out `Promise.reject(error)` lines at all.
- The 401 branch (lines 56-67) — already has its own hardcoded message ("Token expired , please login"), unaffected by this change.
- Any change to how `usePost`/`usePatch`/etc. or screen-level code consumes the (still-resolved, not rejected) result — purely a Toast-text fix inside the interceptor itself.

## Design

Current code (`utils/axiosInstance.ts:70-76`):

```ts
const errorMessage = error?.response?.data?.message;

Toast.show({
  type: "error",
  text1: errorMessage,
  position: "top",
});
```

Change to a fallback chain:

```ts
const errorMessage =
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong. Please try again.";

Toast.show({
  type: "error",
  text1: errorMessage,
  position: "top",
});
```

- `error?.response?.data?.message` stays first — real HTTP error responses (validation errors, 500s, etc.) keep showing the server's actual message exactly as today.
- `error?.message` is Axios's own description of what happened when there's no response at all — for a genuine offline/connectivity failure this is typically `"Network Error"`; for the request timing out (this instance's `timeout: 60000` default) it's `"timeout of 60000ms exceeded"`. Either is meaningfully better than blank, and correctly reflects what actually happened (as opposed to inventing a generic "offline" message that might mislabel a timeout as a connectivity issue).
- The final hardcoded string is a last-resort net in case `error.message` is itself somehow empty.

This is a one-line root-cause change (well, one derivation line, same as it is today) — not a UI-side patch on every screen that shows a Toast, since `axiosInstance.ts`'s interceptor is the single shared place this message is produced for the whole app.

## Implementation notes

- File touched: `client/utils/axiosInstance.ts` only — the `errorMessage` derivation on line 70.
- No new dependency, no signature change, no change to `return error;`/rejection behavior (`FETCH-1` stays exactly as-is and exactly as risky as documented — this spec doesn't reduce or increase that risk).
- Per `ai-workflow-rules.md`'s protected-file note for this exact file: this change was scoped narrowly and deliberately to avoid touching the reject/resolve behavior `FETCH-1` already flags as having wide-reaching downstream effects.

## Verify when done

- [x] `yarn lint` and `npx tsc --noEmit` both pass clean.
- [x] `npx expo export --platform web` statically renders every route without error.
- [ ] With the device/simulator offline, trigger any request (e.g. pull-to-refresh on Home) — confirm the Toast now shows a readable message (e.g. "Network Error") instead of a blank container. **Not yet manually verified** — no device/simulator session in this pass; confirmed by code inspection only (the fallback chain now guarantees a non-empty `text1` for the no-`response` case).
- [ ] Confirm a real HTTP error (e.g. an invalid login) still shows the server's actual `message` unchanged. **Not yet manually verified** — by code inspection, `error?.response?.data?.message` is still checked first and unchanged for this case.
- [x] `progress-tracker.md`'s Known Gaps checkbox for FETCH-7 flipped to checked. The `known-issues.md#FETCH-7` entry itself is left in place as historical record, per `ai-workflow-rules.md`'s documentation-sync rule (fixed issues aren't deleted from that file, just marked resolved in the tracker).

## Open questions

1. Is `error?.message`'s raw Axios wording ("Network Error" / "timeout of 60000ms exceeded") acceptable to show the user directly, or would a friendlier translated string (e.g. "No internet connection" for the network-error case specifically) be preferred? This spec defaults to showing Axios's own message as-is, since guessing "offline" vs. "server down" vs. "timeout" from `error.code`/`error.message` reliably would add meaningfully more branching for a Toast-text-only fix.
