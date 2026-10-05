# 36 — Admin error-log viewer

**Status**: ✅ Completed 2026-10-05 — Steps 0–6 and 8 implemented and verified against a local server + headless browser. Step 7 (filters) was explicitly optional and is **not** built.
**Verified**: `npx tsc --noEmit` clean, `yarn lint` clean, `expo export --platform web` clean, plus a headless click-through (10/10 checks) against `yarn dev` on `localhost:5000` with a throwaway admin, since the **deployed** server does not yet have the errorLog router (`/api/admin/error-logs` → 404 there). Throwaway users were deleted afterwards and `utils/envConfig.ts` was reverted to the deployed URL.
**Scope**: `client/` only. The server side already shipped (`server/ai context/specs/17-error-log-module-with-30-day-retention.md`, commit `2bebf50`); nothing in `server/` is touched by this spec.

---

## Goal

Give an admin a read-only error-log viewer inside the app: a new entry row in Settings (visible **only** to admins) that opens a dedicated `/error-logs` screen, which lists the rows from `GET /api/admin/error-logs` with paging and opens any one row in a detail sheet showing its stack trace and context.

Non-admins never see the entry row, and the screen itself refuses to render a list for them even if the route is reached directly.

---

## Design

Everything comes from the existing Nocturne design system — **no new visual primitives, no new tokens, no raw hex values**.

| Rule                                | Source                                                                                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors via `useTheme()` only        | `theme/colors.ts` (`ColorScheme`)                                                                                                                                                                           |
| Type via `text.*`                   | `theme/typography.ts` — `h2` screen title, `h3` sheet title, `bodyMd`, `bodySm`, `caption`, `kicker`, `captionMd`                                                                                           |
| Spacing/radius/elevation via tokens | `spacing.*`, `radius.*`, `elevation(C, dark)`                                                                                                                                                               |
| **Icons: `Ionicons` only**          | UI chrome is Ionicons since the Nocturne redesign. `MaterialCommunityIcons` is reserved for category icons — do not use it here (`CLAUDE.md`)                                                               |
| Screen shell                        | `SafeAreaView` from `react-native-safe-area-context` with `edges={["top"]}`, `backgroundColor: C?.background`, `paddingHorizontal: spacing.screenPad`                                                       |
| Back-nav header                     | Copy the `styles.nav` row from `components/main/Settings/SettingsPage.tsx:86-92` verbatim in shape: `chevron-back` (size 22, `C?.text`, `hitSlop={8}`, `marginLeft: -10`) + `text.h2` title                 |
| Cards                               | `backgroundColor: C?.surface`, `borderColor: C?.border`, `borderWidth: 1`, `borderRadius: radius.card`, `padding: spacing.md`, plus `elevation(C, dark)?.card` where `dark = C?.statusBarStyle === "light"` |
| Bottom sheet                        | `components/main/shared/Sheet.tsx` (`visible` / `onDismiss` / `children`, optional `maxHeightPct`)                                                                                                          |
| Empty state                         | `components/main/shared/EmptyState.tsx`                                                                                                                                                                     |
| Error state                         | `components/main/shared/ErrorState.tsx` — its `message` is rendered verbatim, by contract                                                                                                                   |

### Status-code color mapping

One small addition, built from existing tokens — no new colors:

| Status        | Text / icon       | Badge background |
| ------------- | ----------------- | ---------------- |
| `>= 500`      | `C.expense`       | `C.expenseBg`    |
| `400–499`     | `C.warning`       | `C.warningBg`    |
| anything else | `C.textSecondary` | `C.surface2`     |

404s are expected to be the single highest-volume row type (bot scans — see server spec 17), which is exactly why they must read as the calmer `warning`, not as `expense`.

### Layout sketch

```
┌─────────────────────────────────────────┐
│  ‹  Error logs                          │   nav row (back + text.h2)
│                                         │
│  142 errors · page 1 of 8          ⟳    │   meta line (text.bodySm/caption)
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ [500]  POST /api/transactions     │  │   status badge + method + path
│  │ Cannot read property 'id' of und… │  │   message, 2 lines max
│  │ TypeError · 5 Oct, 2:14 PM        │  │   errorName · timestamp
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ [404]  GET /api/.env              │  │
│  │ API NOT FOUND!                    │  │
│  │ · 5 Oct, 1:02 PM                  │  │
│  └───────────────────────────────────┘  │
│                                         │
│      ‹ Prev        Next ›                │   pager, disabled at the ends
└─────────────────────────────────────────┘
```

Tapping a card opens the detail sheet: status badge, method + path, timestamp, `errorName`, full `message`, `userEmail` (or "unauthenticated"), `errorSources`, and the `stack` in a horizontally scrollable monospace block.

---

## Implementation

### ✅ Step 0 — Make `userRole` visible to the client (the blocker)

The client currently has **no way to know whether the logged-in user is an admin**. `IUser` has no `userRole`, and `app/auth.tsx` drops it when building the stored user object even though the login response already carries it (`server/src/app/modules/user/user.services.ts:72-109` does a bare `findUnique` and returns the whole row).

1. `types/global.types.ts` — add the field to `IUser`:

   ```ts
   export type IUser = {
     _id: string;
     name: string;
     email: string;
     userRole?: "user" | "admin"; // ← new
     profilePicture?: string;
     createdAt?: string;
     updatedAt?: string;
     __v?: number;
   };
   ```

   Also add `userRole?: "user" | "admin"` to `TUserToken` in the same file so the decoded-token type matches the claim the server now mints.

2. `app/auth.tsx` — carry it into the persisted payload:

   ```ts
   const userPayload = {
     _id: userData?._id,
     name: userData?.name,
     email: userData?.email,
     userRole: userData?.userRole, // ← new
   };
   ```

   `app/register.tsx` needs no change — it never calls `handleSetUser`, so registration does not log the user in.

3. `utils/isAdmin.ts` — one tiny helper, so the check is spelled the same way in both places:

   ```ts
   import { IUser } from "@/types/global.types";

   /**
    * Mirrors server middleware/adminCheck.ts, which is a pure JWT-claim check.
    * `userRole` on the stored user and `userRole` in the token both come from the
    * same login response, so this is true exactly when the token's claim is "admin".
    */
   export const isAdmin = (user?: IUser | null) => user?.userRole === "admin";
   ```

> **Why read `userRole` from the login response and not from `/auth/me`:** `getMe`'s `select` omits `userRole` (`user.services.ts:34-52`), so `profile?.data?.userRole` is always `undefined`. Adding `userRole: true` there would be a one-line server change, but it would be **worse**: it would let the Settings row appear for a session whose token predates spec 17 and which `adminCheck` therefore 403s. Reading it from the login response gives the exact invariant we want — _the row is visible iff the token actually carries the claim._
>
> **Consequence to expect, not a bug:** a user already logged in (including an admin promoted by DB write) sees no row until they **log out and log back in**. That matches the server side exactly, where the same re-login is required for `adminCheck` to pass.

### ✅ Step 1 — Row type

New file `types/ErrorLog.types.ts`, hand-mirroring `server/src/app/modules/errorLog/errorLog.interface.ts` + its `toApiShape`. There is no shared types package — keeping these in sync by hand is the documented convention (`known-issues.md#TYPE-2`):

```ts
export type TErrorLogSource = { path: string; message: string }[];

export type TErrorLog = {
  _id: string;
  id: string;
  status: number;
  message: string;
  errorName?: string | null;
  errorSources?: TErrorLogSource | null;
  stack?: string | null;
  method: string;
  path: string;
  userId?: string | null;
  userEmail?: string | null;
  createdAt: string;
};

export type TErrorLogListPayload = {
  result: TErrorLog[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
```

`errorSources` is a JSON column, so treat it defensively at render time (`Array.isArray(...)`) rather than trusting the type.

### ✅ Step 2 — The route file

New file `app/error-logs.tsx`, following the `app/quick-add.tsx` precedent:

```tsx
import ErrorLogsPage from "@/components/main/ErrorLogs/ErrorLogsPage";
import AuthGuard from "@/utils/AuthGuard";

// Outside the (tabs) group, so it needs its own AuthGuard — the root layout renders a
// <Slot />, not a Stack, and the tabs layout's guard doesn't apply here.
export default function ErrorLogs() {
  return (
    <AuthGuard>
      <ErrorLogsPage />
    </AuthGuard>
  );
}
```

**`app.json` has `experiments.typedRoutes: true`** — after adding this file, run `expo start` (or `yarn web`) **once** to regenerate `.expo/types/router.d.ts`, otherwise `npx tsc --noEmit` fails on the `"/error-logs"` href in Step 6.

No change to `app/(tabs)/_layout.tsx`: this is a top-level route, not a tab.

### ✅ Step 3 — `components/main/ErrorLogs/ErrorLogCard.tsx`

Props: `{ log: TErrorLog; onPress: () => void }`. A `TouchableOpacity` card (`activeOpacity={0.8}`) laid out as in the sketch:

- **Status badge** — `height: 22`, `paddingHorizontal: spacing.sm`, `borderRadius: radius.sm`, background/text from the mapping table above, label is `String(log.status)` in `text.caption`.
- **Method + path** — `text.bodySm` with `C?.textSecondary` for the method, `C?.text` for the path, `numberOfLines={1}` and `ellipsizeMode="middle"` (query strings on bot-scan 404s are long and the tail is the useful part).
- **Message** — `text.bodyMd`, `C?.text`, `numberOfLines={2}`.
- **Footer** — `text.caption`, `C?.textMuted`: `errorName` (omit when null) then `·` then the timestamp.

Timestamps use `date-fns`'s `format` (already a dependency, already used this way in `TransactionRequestsPage.tsx`): `format(new Date(log.createdAt), "d MMM, h:mm a")`. Wrap it so an unparseable date renders `"—"` instead of throwing — this screen exists to show failures, so it must not become one.

Put the status→color mapping in a small exported helper in this file (e.g. `statusTone(C, status)`) so the detail sheet reuses it rather than re-deriving it.

### ✅ Step 4 — `components/main/ErrorLogs/ErrorLogDetailSheet.tsx`

Props: `{ log: TErrorLog | null; onDismiss: () => void }`. Renders `<Sheet visible={!!log} onDismiss={onDismiss}>` with a `ScrollView` inside:

- Head row: status badge + `text.h3` title (`${log.method} ${log.path}`, `numberOfLines={1}`).
- A `kicker`-labelled detail list: **When** (full timestamp, `"EEE d MMM yyyy, h:mm:ss a"`), **Error** (`errorName ?? "—"`), **User** (`userEmail ?? "unauthenticated"`, with `userId` in `caption` beneath when present).
- **Message** — full text, no line clamp.
- **Sources** — only when `Array.isArray(log.errorSources) && log.errorSources.length`: one `caption` line per entry, `path` → `message`.
- **Stack** — only when `log.stack`; a `C?.surface2` block, `borderRadius: radius.md`, `padding: spacing.md`, inside a **horizontal** `ScrollView` so long frames don't wrap into unreadable mush. Use `fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"` and `fontSize: 11` directly here — the theme has no mono token, and this is the one place that needs one. 404 rows deliberately store no stack (they're synthetic), so this section is simply absent for them; that is correct, not missing data.

**This sheet renders the row the list already fetched — it does not call `GET /api/admin/error-logs/:id`.** The list endpoint returns complete rows (`stack` included), so a second request would add a loading state and a second FETCH-1 failure mode for zero new information. The `/:id` route stays unused by the client, deliberately; if the list is ever trimmed to a summary shape, switch this component to `useFetchData(["error-log", id], \`/admin/error-logs/${id}\`, { enabled: !!id })`.

### ✅ Step 5 — `components/main/ErrorLogs/ErrorLogsPage.tsx`

The screen itself.

```tsx
const C = useTheme();
const router = useRouter();
const { user } = useUserContext();
const [page, setPage] = useState(1);
const [selected, setSelected] = useState<TErrorLog | null>(null);

const admin = isAdmin(user);

const { data, isLoading, isError, error, refetch, isRefetching } =
  useFetchData<TErrorLogListPayload>(
    ["error-logs", String(page)],
    `/admin/error-logs?page=${page}&limit=20`,
    { enabled: admin, placeholderData: (prev) => prev },
  );

const logs = data?.data?.result ?? [];
const meta = data?.data?.meta;
```

Points that are easy to get wrong:

1. **`meta` is nested inside `data`, not hoisted.** `sendResponse` emits `{ success, message, data, token }` and the service returns `{ result, meta }` as that `data`, so the paths are `data?.data?.result` and `data?.data?.meta`. The axios interceptor's own top-level `meta` field is a different thing with zero existing call sites — ignore it.

2. **`page` must be in the query key** (`["error-logs", String(page)]`), or TanStack serves page 1's cache for every page. `placeholderData: (prev) => prev` keeps the previous page on screen while the next loads instead of flashing the loading state — this is the first paginated read in the client, so there is no existing pattern to copy (no `useInfiniteQuery`, no `onEndReached` anywhere).

3. **A 403 does not produce `isError`.** Under `known-issues.md#FETCH-1` the response interceptor `return error` instead of rejecting, so `apiGet` **resolves with `undefined`** for a 403 exactly as it does for a 500 or a dead network. The query therefore reports success with no payload. Handle it explicitly:

   ```ts
   // The interceptor already showed the real message in a Toast (FETCH-1), so this
   // is the generic fallback — ErrorState renders `message` verbatim and must not
   // invent a cause it cannot know.
   const failed = isError || (!isLoading && !isRefetching && !data?.success);
   ```

   Render order: non-admin fallback → `failed` → `isLoading` → empty → list.

4. **Non-admin fallback** — belt and braces, so the screen never trusts navigation:

   ```tsx
   if (!admin) {
     return (
       <SafeAreaView …>
         <nav row />
         <EmptyState
           title="Admins only"
           subtitle="This screen is restricted. If you were just given admin access, log out and log back in."
           icon="lock-closed-outline"
         />
       </SafeAreaView>
     );
   }
   ```

   The subtitle names the re-login explicitly because the stale-token case from Step 0 is the one failure a real admin will actually hit.

5. **States** — `failed` → `<ErrorState title="Couldn't load error logs" message={(error as Error)?.message ?? "Please try again."} onRetry={refetch} />`; empty → `<EmptyState title="No errors logged" subtitle="Nothing has failed in the last 30 days." icon="shield-checkmark-outline" />` (30 days is the retention window, so this wording is accurate); loading → three placeholder cards filled with `C?.skeleton`. Do **not** reuse `TransactionCardSkeleton` — it is shaped for a transaction row.

6. **Scroll + refresh** — a `ScrollView` with `RefreshControl` (`refreshing={isRefetching}`, `onRefresh={refetch}`, `tintColor={C?.accent}`), same as `TransactionRequestsPage`. A `FlatList` is not needed: the page size is capped at 20 server-side.

7. **Meta line** — `{meta?.total ?? 0} errors · page {meta?.page ?? page} of {meta?.totalPages ?? 1}` in `text.bodySm` / `C?.textSecondary`.

8. **Pager** — two bordered buttons below the list, in the `logoutBtn` idiom (`height: spacing.field`, `borderWidth: 1`, `borderRadius: radius.card`, `flexDirection: "row"`, `gap: spacing.sm`) with `chevron-back` / `chevron-forward`. `Prev` is `disabled` at `page <= 1`, `Next` at `page >= (meta?.totalPages ?? 1)`; disabled renders with `C?.border` / `C?.textMuted` and `opacity: 0.5`. Hide the pager entirely when `(meta?.totalPages ?? 1) <= 1`. On page change, also `scrollTo({ y: 0 })` via a `ScrollView` ref — otherwise page 2 opens mid-list.

9. **Reset on unmount is unnecessary** — `page` is component state and the screen is pushed fresh each time.

### ✅ Step 6 — The Settings entry row (the admin's way in)

In `components/main/Settings/SettingsPage.tsx`:

- `import { isAdmin } from "@/utils/isAdmin";`
- Insert the row **between** the `<CategoryManager />` block and the logout button — i.e. after the `<View style={{ marginTop: spacing.xl }}>…</View>` at `SettingsPage.tsx:128-130`, before the logout `TouchableOpacity`. Keeps the destructive action last.

```tsx
{
  isAdmin(user) ? (
    <TouchableOpacity
      onPress={() => router?.push("/error-logs")}
      activeOpacity={0.8}
      style={[
        styles.adminRow,
        { backgroundColor: C?.surface, borderColor: C?.border },
      ]}
    >
      <Ionicons name="bug-outline" size={18} color={C?.accent} />
      <Text style={[text.bodyMd, { color: C?.text, flex: 1 }]}>Error logs</Text>
      <Ionicons name="chevron-forward" size={18} color={C?.textMuted} />
    </TouchableOpacity>
  ) : null;
}
```

New style, alongside the existing ones:

```ts
adminRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  height: spacing.field,
  paddingHorizontal: spacing.md,
  borderWidth: 1,
  borderRadius: radius.card,
  marginTop: spacing.xl,
},
```

Gate on `user` from `useUserContext()` (already destructured on line 32 — add nothing), **not** on `profile?.data`, for the Step 0 reason: `/auth/me` doesn't return `userRole`.

Note the row is a filled `surface` card rather than the logout button's tinted outline — an admin tool should not read as a destructive action. If the user would rather have it in an "Admin" `text.kicker` section like "Appearance", that's a one-line wrap and worth asking about at review time.

### ⏭️ Step 7 — Optional, only if asked: filters — NOT BUILT

The server allowlists `status` (exact Int), `method` (uppercased), `path` (case-insensitive `contains`) and `sort` (`createdAt` | `-createdAt` | `status` | `-status`, default `-createdAt`) — `errorLog.service.ts:44-77`. A method chip row (`ALL · GET · POST · PATCH · DELETE`) plus a debounced path search would slot straight into the query string and the query key. **Left out of the core scope on purpose** — the request was "admin can see the error logs", and filters are easier to add once the list is on screen. Note: `status` is an exact match, not a range, so there is no "5xx only" filter without a server change.

### ✅ Step 8 — Docs

- Add the row to `client/ai context/progress-tracker.md`'s Spec status table, and tick each step here as it lands (⏳ in progress → ✅ completed), per the house workflow.
- `client/ai context/architecture.md`'s routing section is already stale (`CLAUDE.md` says so); add `app/error-logs.tsx` to its top-level route list **only if** that section is being corrected anyway — don't expand this spec into a doc cleanup.
- Fix nothing from `known-issues.md` as a side effect. FETCH-1 is worked _around_ here (Step 5.3), not fixed; UX-3 is not touched (this screen has no confirm dialog).

---

## Dependencies

**None. No package needs to be installed.** Everything is already in `client/package.json`:

| Need            | Already available                                                         |
| --------------- | ------------------------------------------------------------------------- |
| Data fetching   | `@tanstack/react-query` via `hooks/useApi.ts` (`useFetchData`)            |
| HTTP            | `axios` via `utils/axiosInstance.ts` (auth header injected automatically) |
| Routing         | `expo-router` (`useRouter`, file-based route)                             |
| Icons           | `@expo/vector-icons` → `Ionicons`                                         |
| Date formatting | `date-fns` (`format`)                                                     |
| Sheet/modal     | `react-native-paper` via `components/main/shared/Sheet.tsx`               |
| Safe area       | `react-native-safe-area-context`                                          |

No new native module, so **no rebuild of the dev client is needed** — this is pure JS/TS and reloads over Metro.

---

## Verify

Everything below was run on **2026-10-05** against a local `yarn dev` server on `localhost:5000`, with a
throwaway admin that was deleted afterwards. It could not be run against the deployed server: the live build
predates server spec 17, so `GET /api/admin/error-logs` 404s there while `/api/auth/me` and `/api/categories`
answer 401 — i.e. the API is up, the errorLog router simply isn't in it yet. **Deploying it is still the one
outstanding step before this screen works for real** (`cd server && yarn build && npx vercel --prod`).

Server prerequisites:

- [x] A real user promoted to `admin` by direct DB write (throwaway `spec36-verify-…@example.test`, deleted
      afterwards along with the non-admin twin and the one error-log row that referenced it).
- [x] Logged in after promotion — the login response carries `userRole: "admin"` and the minted JWT's claims are
      `{ userId, userEmail, userRole: "admin" }`, confirming Step 0's premise exactly.
- [x] Error rows created: a 404 (`/api/does-not-exist`), a 400 `ZodError`, a 401, a 403, and 24 bot-scan-shaped
      404s to force a second page (28 rows ⇒ `totalPages: 2`).
- [x] `utils/envConfig.ts` was pointed at `localhost:5000` for the browser pass and **reverted** to
      `https://exp2server.vercel.app` before committing — `git status` confirms it is unmodified.

Static checks:

- [x] `expo start` run once; `.expo/types/router.d.ts` regenerated and now contains `/error-logs`.
- [x] `npx tsc --noEmit` clean. (Before regenerating, it failed on exactly the predicted line —
      `router.push("/error-logs")` — which is a useful confirmation that the typed-routes note was needed.)
- [x] `yarn lint` clean.
- [x] `npx expo export --platform web` succeeds and emits the `/error-logs` route.

Admin path (headless Chrome over CDP, 10/10 assertions passed):

- [x] Settings shows the **Error logs** row between Categories and Log out for an admin.
- [x] `/error-logs` renders under its own `AuthGuard`. _(The route was loaded directly; the Settings row's
      `router.push` was not itself clicked.)_
- [x] The list renders real rows — status badge, method + path, message, `errorName` · timestamp — and a 404
      reads as `warning` amber. _(No 5xx row was produced, so the `expense`-red branch is untested.)_
- [x] The meta line matches the API: "28 errors · page 1 of 2" against `data.meta`
      `{page: 1, limit: 20, total: 28, totalPages: 2}`.
- [ ] Pull-to-refresh — **not exercised**; `RefreshControl` has no meaningful headless-web gesture.
- [x] Tapping a row opens the detail sheet with When/Error/User (`unauthenticated` when there is no user),
      Sources, and the stack in a horizontally scrollable block; tapping the scrim dismisses it.
- [x] A 404 row's sheet shows **no** Stack section. It _does_ show Sources — 404 rows store
      `[{ path: "", message: "API NOT FOUND!" }]` — so the empty `path` is rendered without a leading `→`.
      (That empty-path case was found during this pass and fixed in `ErrorLogDetailSheet.tsx`.)
- [x] With 28 rows: `Next` advances to page 2, the meta line increments, `Prev` returns to page 1. With 3 rows
      (`totalPages: 1`) the pager is absent. _(The `scrollTo({y: 0})` on page change was not asserted
      separately.)_
- [x] Both themes render legibly — screenshotted in Dark and Light with `themePreference` seeded.

Non-admin path:

- [x] A normal user sees **no** Error logs row in Settings.
- [x] `/error-logs` opened directly shows the "Admins only" state with the re-login subtitle, and fires no
      request (`enabled: admin`).
- [x] Logged out, `/error-logs` redirects to the Sign in screen via the route's own `AuthGuard`.

Stale-token path:

- [x] A stored user with no `userRole` behaves exactly like a non-admin — no Settings row, "Admins only" on the
      screen — which is the shape a pre-spec-17 session has.
- [x] The API side confirmed independently by curl: a non-admin token gets `403 "Admin access required"` from
      `adminCheck`, so the screen's belt-and-braces gate matches the server's answer.

Known limitation, confirmed rather than fixed:

- [ ] FETCH-1's generic `ErrorState` message on a genuine transport failure — **not exercised**; it needs the
      server to be stopped mid-session. The `!data?.success` guard it depends on is the same code path the
      non-admin case proves, since a 403 also resolves with no payload.

Still open for the user (outside this spec's reach):

- [ ] Deploy the server so `/api/admin/error-logs` exists in production, then promote a real user and re-login.
- [ ] A real-device pass — everything above is the web target.
