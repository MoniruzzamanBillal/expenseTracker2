/**
 * Bridge from non-React module code to UserProvider's logout (specs 25 + 39).
 *
 * `utils/axiosInstance.ts` is a module-level singleton constructed once and imported
 * everywhere via `utils/api.ts`, so it runs outside any component and cannot call
 * `useUserContext()` to reach `logoutFunction`. Registering the callback here keeps the
 * interceptor as a plain module while still letting a forced logout clear React state.
 *
 * Without this, a 401 clears storage but leaves `UserProvider`'s in-memory `user` non-null,
 * so screens keep rendering a logged-in UI for a session that is already over
 * (`known-issues.md#AUTH-2`).
 */

type TLogoutHandler = () => void;

let logoutHandler: TLogoutHandler | null = null;

export const registerLogoutHandler = (fn: TLogoutHandler) => {
  logoutHandler = fn;
};

/**
 * Safe to call before UserProvider has mounted (it is a no-op then), though that can't
 * actually happen: a 401 requires an authenticated request, which requires a token that
 * UserProvider itself hydrated (spec 25, "Edge case").
 */
export const triggerForcedLogout = () => {
  logoutHandler?.();
};
