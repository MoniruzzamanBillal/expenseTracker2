# 25: Fix AUTH-2 — sync in-memory session state on a 401

Status: 📝 Plan only — not implemented. Written for review; do not build from this until it's approved (see `progress-tracker.md`'s Known Gaps entry for `AUTH-2`).

## Problem

`utils/axiosInstance.ts`'s response interceptor, on a `401`, clears `AsyncStorage` (`"user"`, `"token"`) and redirects to `/auth`:

```ts
if (error?.response?.status === 401) {
  await AsyncStorage.removeItem("user");
  await AsyncStorage.removeItem("token");

  Toast.show({ type: "error", text1: "Token expired , please login ", position: "top" });
  router.replace("/auth");
}
```

It never touches `UserProvider`'s in-memory `user`/`token` React state (`context/user.context.tsx`). `UserProvider` only reads from `AsyncStorage` once, in a `useEffect(() => {...}, [])` on mount (`loadUserData`) — it has no listener for storage changing out from under it. Since `UserProvider` is mounted once at the app root (`app/_layout.tsx`) and never remounts on navigation, `user`/`token` stay stale in memory after a 401 until either a full app reload (re-runs `loadUserData`) or the user manually taps Settings' "Log out" (which calls `logoutFunction`, the one place that already clears both storage *and* memory correctly).

Concretely: any screen reading `useUserContext().user` (e.g. Settings, or anything gating on "am I logged in") can keep showing the old logged-in user/UI for up to the current screen's lifetime after the token has already been invalidated server-side and wiped from storage — until something forces a remount or the user logs out manually.

Reference: `client/ai context/known-issues.md#AUTH-2`, tracked open in `progress-tracker.md`'s Known Gaps.

## Goal

On a 401, in-memory `UserProvider` state must be cleared in the same step as the existing `AsyncStorage` clear + redirect — so no screen can observe a stale "logged in" user after a session has already been invalidated.

## Scope

**In:**
- `utils/axiosInstance.ts` — the 401 branch of the response interceptor.
- `context/user.context.tsx` — expose `logoutFunction` to code outside the React tree.
- One new small bridge module (see Design) to connect the two without turning `axiosInstance` into a React-lifecycle-bound thing.

**Out (explicitly not touched by this spec):**
- `AUTH-1` (dead "already logged in, redirect off /auth" branch in `AuthGuard`) — separate known issue, separate fix.
- `AUTH-3` (hardcoded `"user"`/`"token"` string literals duplicated across three files) — this spec incidentally removes one duplicate pair of `AsyncStorage.removeItem` calls (see Design), but does not introduce a shared constants file for the key names; that's AUTH-3's own fix.
- `AUTH-4`, `AUTH-5`, `AUTH-6` — untouched.
- The double-toast behavior on 401 (the interceptor's own "Token expired" toast, immediately followed by the generic error-message toast a few lines later, both fire for the same 401) — not part of AUTH-2, not touched here.

## Design

`utils/axiosInstance.ts` is a plain module-level singleton (constructed once, imported everywhere via `utils/api.ts`) — it runs outside any component, so it cannot call the `useUserContext()` hook directly to reach `logoutFunction`. The standard, minimal-footprint way to bridge a non-React module to React context state in this kind of app is a tiny module-level "registered callback" indirection:

**1. New file `client/utils/authEvents.ts`:**

```ts
type TLogoutHandler = () => void;

let logoutHandler: TLogoutHandler | null = null;

export const registerLogoutHandler = (fn: TLogoutHandler) => {
  logoutHandler = fn;
};

export const triggerForcedLogout = () => {
  logoutHandler?.();
};
```

**2. `context/user.context.tsx`:** register `logoutFunction` once, on mount:

```ts
useEffect(() => {
  registerLogoutHandler(logoutFunction);
}, []);
```

`logoutFunction` only closes over the stable `setUser`/`setToken` setters (no other outside state), so registering it once on mount carries no stale-closure risk — it doesn't need to be re-registered on every render.

**3. `utils/axiosInstance.ts`'s 401 branch:** replace the two direct `AsyncStorage.removeItem` calls with a single call into the bridge:

```ts
if (error?.response?.status === 401) {
  triggerForcedLogout();

  Toast.show({ type: "error", text1: "Token expired , please login ", position: "top" });
  router.replace("/auth");
}
```

`logoutFunction` (already defined in `user.context.tsx`) already does exactly the right two things — clears both `AsyncStorage` keys *and* resets `user`/`token` state — so this both fixes AUTH-2 and removes a duplicate copy of the `AsyncStorage.removeItem("user")`/`removeItem("token")` pair that today exists independently in two places (`axiosInstance.ts`'s 401 handler and `user.context.tsx`'s `logoutFunction`). One source of truth for "what does logging a user out actually mean" instead of two that have to be kept in sync by hand.

**Ordering note:** `logoutFunction` is `async`, but the interceptor doesn't need to `await` it before calling `router.replace("/auth")` — the redirect and the state clear can happen concurrently; there's no user-visible difference between "storage cleared, then redirect" and "redirect fires while storage clear is in flight" since the destination screen (`/auth`) doesn't read `user`/`token` itself.

**Edge case:** could `triggerForcedLogout()` ever fire before `UserProvider` has mounted (i.e. `logoutHandler` is still `null`)? No — a 401 only happens in response to an authenticated request, which requires a token that was itself read from `AsyncStorage` inside `UserProvider`'s render tree already being up. By the time any request carrying a token can round-trip to the server and come back 401, `UserProvider` has necessarily already mounted and registered its handler. Not defended against in code; noted here so it isn't re-litigated as a "TODO: handle null" during implementation.

**Alternatives considered and rejected:**
- *Move axios interceptor setup into a hook/component so it can call `useUserContext()` directly* — would require restructuring `axiosInstance` from "constructed once, imported as a singleton everywhere via `utils/api.ts`" into something lifecycle-bound to a React tree. Much larger blast radius (every `apiGet`/`apiPost`/etc. call site would need to change how it obtains the instance) for no benefit over the bridge module.
- *Pull in a global state library (Zustand/Redux/Jotai)* — solves a one-callback problem with a new dependency; against this project's existing minimal Context + React Query approach, and known-issues/code-standards docs don't mention wanting one.

## Implementation notes (planned files touched)

- `client/utils/authEvents.ts` — **new file**, ~10 lines, the bridge described above.
- `client/context/user.context.tsx` — add the `useEffect` registering `logoutFunction`; add the `registerLogoutHandler` import.
- `client/utils/axiosInstance.ts` — 401 branch: remove the two `AsyncStorage.removeItem` lines, remove the now-unneeded `AsyncStorage` import *if* nothing else in the file still uses it (check the request interceptor above — it also reads `AsyncStorage.getItem("token")`, so the import stays; only the two `removeItem` calls go away), add `triggerForcedLogout()` call and its import.

## Verify when done

- [ ] Force a 401 (e.g. temporarily corrupt/expire the stored token server-side, or hit a protected endpoint after manually invalidating it) and confirm, without any manual reload or logout tap:
  - [ ] `AsyncStorage` no longer has `"user"`/`"token"`.
  - [ ] A currently-mounted screen reading `useUserContext().user` (e.g. Settings) immediately reflects `user === null`.
  - [ ] The app navigates to `/auth`.
- [ ] Settings' existing manual "Log out" button (still calling `logoutFunction` directly) behaves identically to before — no regression from the new registration indirection.
- [ ] `yarn lint` and `npx tsc --noEmit` pass.
- [ ] No new double-toast or other regression around the existing 401 Toast/redirect sequence beyond what already existed before this fix.
