# Known Issues — xpns

Ranked list of real gaps in this codebase, grouped by module. These are documented, not fixed — don't silently patch one while working on something else without flagging it in `progress-tracker.md`.

## Severity legend

**Critical** — breaks core functionality silently, app-wide. **High** — real bug with a broad or confusing blast radius. **Medium** — real but narrower/conditional. **Low** — cosmetic, dead code, or a nice-to-have.

## Configuration (`CFG-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| CFG-1 | High | `baseURL` is a literal placeholder (`"https://YOUR_API_URL"`). | `utils/envConfig.ts` | Every request fails until this is set to a real API host. |

## Auth & Session State (`AUTH-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| AUTH-1 | Medium | There is no token-refresh mechanism anywhere. | `utils/axiosInstance.ts` | A 401 (only detected after a request actually fails) is the sole session-expiry signal — no proactive refresh before the JWT expires. |
| AUTH-2 | Medium | On a 401, the axios interceptor clears `AsyncStorage` and redirects to `/auth`, but never calls into `UserProvider` to clear its in-memory `user`/`token` state. | `utils/axiosInstance.ts`, `context/user.context.tsx` | In-memory React state can stay non-null (stale "logged in") after a 401 until the app fully reloads or the user manually logs out. |

## UX Gaps (`UX-`)

| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| UX-1 | Low | "Forgot password?" on the login screen (matching the approved design) has no handler — there's no forgot-password flow/screen. | `app/auth.tsx` |
| UX-2 | Low | The Weekly screen has no prev/next navigation; the API contract owns the Friday–Thursday window with no query params for other weeks, so the design's chevrons were intentionally left out rather than shipped as dead UI. | `components/main/weeklyTransactionsPage/WeeklyTransactionsPage.tsx` |
| UX-3 | Low | Smart Add's parsed drafts live only in component state — navigating away before tapping "Save" loses them. | `components/main/smartAdd/SmartAdd.tsx` |

## Scope Deviations from the Prior App (`SCOPE-`)

| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| SCOPE-1 | Low | The prior `ExpenseTracker` client had an offline transaction queue (enqueue while offline, sync banner, pending-transaction edit/delete). This redesign intentionally did not carry it over — it wasn't part of the 8-screen design brief this app was built from. Re-add by porting `hooks/usePendingTransactions.ts`/`utils/transactionQueue.ts` from the prior client if it's still wanted. | — |
| SCOPE-2 | Low | The prior client had `monthlyTransactions` as its own bottom tab; this design puts it one level deeper (reached only from History) per the approved mockup's 5-icon tab bar. | `app/(tabs)/_layout.tsx` |

## Testing

There is no automated test suite. Verify changes by running the app (`npx expo start`) against a real or local API.
