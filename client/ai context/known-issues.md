# Known Issues — Client

Ranked backlog of real bugs and inconsistencies found in this codebase, grouped by module. These are documented, not fixed — don't silently patch one while working on something else without flagging it in `progress-tracker.md`.

## Severity legend

**Critical** — breaks core functionality silently, app-wide. **High** — real bug with a broad or confusing blast radius. **Medium** — real but narrower/conditional. **Low** — cosmetic, dead code, or a nice-to-have.

## At a glance (Critical + High only)

| ID | Severity | Issue |
|----|----------|-------|
| FETCH-1 | Critical | Axios response interceptor never rejects on HTTP errors — all downstream error handling is dead code |
| AUTH-1 | High | `AuthGuard`'s "already logged in, on auth page → redirect home" branch is dead in practice |
| TYPE-1 | High | Three independent copies of the income/expense enum exist |

## Data Fetching (`FETCH-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| FETCH-1 | Critical | The response error interceptor ends with `return error;` — `// return Promise.reject(error);` is commented out directly above it. Axios therefore **resolves** (does not reject) on every HTTP error. | `utils/axiosInstance.ts:54-80` | `utils/api.ts`'s wrappers (`apiGet`/`apiPost`/etc.) do `const resule = await axiosInstance.X(...); return resule?.data;` — on error, `resule` is the raw Axios error object with no `.data`, so they silently return `undefined`. Every `onError` in `hooks/useApi.ts`'s mutation hooks (`usePost`, `usePatch`, `useDeleteData`) is dead code — it can only fire on pre-request JS exceptions, never on 4xx/5xx. Every screen-level `try { await mutateAsync(...) } catch {}` around a mutation never enters its `catch`. The Toast fired inside the interceptor itself is the *only* real user-facing error feedback in the entire app. |
| FETCH-2 | Low | `useUpdateData` and `useDeleteData` (`hooks/useApi.ts`) are exported but have **zero call sites** anywhere in the app. | `hooks/useApi.ts:61-69,95-114` | The app's actual "delete" flow (`components/main/shared/TransactionCard.tsx`) uses `usePatch` against a PATCH endpoint (soft-delete), never a real HTTP DELETE — `apiDelete`/`useDeleteData` are orphaned. |
| FETCH-3 | Low | `SmartAdd.tsx`'s prompt-mutation calls `usePost([[""]])` — an invalidation key of `[""]` that matches no real query. | `components/main/smartAdd/SmartAdd.tsx` | No-op invalidation; looks like a copy-paste placeholder left over from the real invalidation-key arrays used elsewhere in the same file. |
| FETCH-4 | Low | The request interceptor's comment says "Skip adding Authorization header for login endpoint," but the code unconditionally attaches `Authorization: Bearer <token>` whenever a token exists in storage, regardless of endpoint. | `utils/axiosInstance.ts:29-34` | Comment/code mismatch — harmless in practice since `/auth/login` doesn't check the header, but don't trust the comment. |
| FETCH-5 | Low | The success interceptor's return shape is annotated `//@ts-expect-error: response type is not always consistent`. | `utils/axiosInstance.ts:45` | The type mismatch is already acknowledged in-code, not fixed — don't "fix" the suppression without checking why it's there first. |
| FETCH-6 | Low | Pull-to-refresh on index/history/monthly/weekly screens does `setRefreshing(true); refetch(); setRefreshing(false)` without awaiting `refetch()`. | `components/main/Home/HomePage.tsx` and siblings | `setRefreshing(false)` fires essentially immediately — the pull-to-refresh spinner typically stops before the data has actually arrived. |

## Auth & Session State (`AUTH-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| AUTH-1 | High | `AuthGuard` is mounted **only** inside `app/(tabs)/_layout.tsx`. `app/auth.tsx`/`app/register.tsx` are sibling top-level routes outside `(tabs)`, so `AuthGuard` isn't mounted while they're active — its `user && isOnAuthPage → redirect to "/"` branch can never actually observe pathname `/auth`. | `utils/AuthGuard.tsx`, `app/(tabs)/_layout.tsx` | A logged-in user can freely navigate to `/auth` or `/register` (e.g. via deep link) with no guard-based redirect back to `/`. |
| AUTH-2 | Medium | On a 401, the axios interceptor clears AsyncStorage (`"user"`,`"token"`) and redirects, but never calls `setUser(null)`/`setToken(null)`/`logoutFunction()` on `UserProvider`. | `utils/axiosInstance.ts:56-67` | In-memory React state can stay non-null (stale "logged in") after a 401 until a full app reload re-runs `loadUserData()`, or the user manually taps logout. |
| AUTH-3 | Low | The AsyncStorage key literals `"user"`/`"token"` are hardcoded independently in three places: `context/user.context.tsx`, the axios request interceptor, and the axios 401 handler — no shared constant. | `context/user.context.tsx`, `utils/axiosInstance.ts` | Renaming a key requires remembering all three call sites; easy to miss one. |
| AUTH-4 | Low | `loadUserData()` does `JSON.parse(storedUser)` with no try/catch. | `context/user.context.tsx:37` | Corrupted/malformed stored `"user"` data throws uncaught inside the effect. |
| AUTH-5 | Low | `auth.tsx`'s login handler manually rebuilds `{ _id, name, email }` from the server response before calling `handleSetUser`, dropping `profilePicture` even though `IUser` declares it (optional). | `app/auth.tsx` | `profilePicture` from a successful login response is discarded and never reaches context/storage. |
| AUTH-6 | Low | `AuthGuard` waits an arbitrary `setTimeout(..., 100)` before evaluating/redirecting on every `[user, isLoading, pathname]` change. | `utils/AuthGuard.tsx:19-25` | Works, but is a magic-number delay rather than a deliberate synchronization point. |

## Type / Enum Drift (`TYPE-`)

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| TYPE-1 | High | Three independent sources of truth for the income/expense enum: (1) `constants/TransactionType.constant.ts`'s `TransactionTypeConst`, used by `types/Transaction.tyes.ts`; (2) a second, separately declared and exported `transactionConstants`/`TTransactionType` inside `components/main/AddTransaction/AddTransactionPage.tsx`, which `components/main/shared/UpdateTransactionModal.tsx` imports **from that page component** rather than from the constants file; (3) an untyped, unexported inline copy `typeOptions` in `components/main/shared/TransactionCard.tsx` (no `as const`). | `constants/TransactionType.constant.ts`, `components/main/AddTransaction/AddTransactionPage.tsx`, `components/main/shared/TransactionCard.tsx` | Two different casings of the "same" constant (`TransactionTypeConst` vs `transactionConstants`), and an unusual dependency direction (a `shared/` component importing from a screen-level `AddTransaction/` component). All three currently agree on values (`"income"`/`"expense"`), so no value-level bug yet — but any future value change must be made in three places. **New code should import only from `constants/TransactionType.constant.ts`.** |
| TYPE-2 | Medium | Client `TTransaction` (`types/Transaction.tyes.ts`) has no `isDeleted` field at all, even though the delete flow depends on server-side soft-delete semantics. Server's `description` is required; client's is optional, worked around by sending a literal single-space string `" "` when the user leaves it blank. | `types/Transaction.tyes.ts` vs server `transaction.interface.ts` | Shape-level drift between the two hand-maintained type definitions (there's no shared/generated types package) — see server's `known-issues.md#VALID-5` for the matching server-side half of the `description` mismatch. |
| TYPE-3 | Low | `types/Transaction.tyes.ts` — filename typo ("tyes", missing the "p") — is the actual, permanent filename, imported directly (not re-exported under a correct name) from ~13 files across screens and components. | `types/Transaction.tyes.ts` | Load-bearing typo. **Do not rename reflexively** — any rename requires updating all ~13 import sites in the same change. (Carried forward from the root `CLAUDE.md`'s existing guidance.) |

## Dead / Orphaned Code (`DEAD-`)

| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| DEAD-1 | Low | `app/modal.tsx` is unmodified Expo template boilerplate (a self-referential "this is a modal" screen) with no route/link anywhere in the real app pointing to it. | `app/modal.tsx` |
| DEAD-2 | Low | Two unrelated "collapsible" implementations coexist: the unused template `components/ui/collapsible.tsx`, and the actually-used `components/main/MonthlyTransaction/TransactionAccordion.tsx`, which is built directly on the third-party `react-native-collapsible` package rather than the local wrapper. | `components/ui/collapsible.tsx`, `components/main/MonthlyTransaction/TransactionAccordion.tsx` |
| DEAD-3 | Low | `utils/api.ts` uses the variable name `resule` (typo for "result") consistently across all five of its functions. | `utils/api.ts` |

## UX Gotchas (`UX-`)

| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| UX-1 | Low | `utils/envConfig.ts`'s `baseURL` is a hardcoded production literal; the local dev URL exists only as a commented-out line directly above it. Switching environments requires a source edit, not an env var. | `utils/envConfig.ts` |
| UX-2 | Low | See `AUTH-6` above (arbitrary 100ms `setTimeout` in `AuthGuard`) — cross-referenced here since it's as much a UX timing quirk as an auth-flow one. | `utils/AuthGuard.tsx` |
