# 37: Offline Reads — Show Cached + Queued Data Instead of the Error Screen

> Status: **✅ completed 2026-10-09** — Steps 0–8 done (✅ on each heading); Step 9 deliberately not built. Device checks in *Verify when done* are still open.

## The report

User-reported with a screenshot (2026-10-08): turning off wifi/data and opening **Today** replaces the whole screen with

```
⚠ Couldn't load today
["daily-transaction"] data is undefined
[Try again]
```

…above the orange "1 entry is saved on this phone only. Sync to send it to the server." banner. The queued entry exists and the app knows about it, but the day's entries — neither the previously-loaded server ones nor the queued local one — are rendered. Expected behaviour (and what the user's previous app did): offline, the app shows whatever data it already has, including anything saved locally.

## What actually happens today (traced, not assumed)

Three independent causes stack up. All three have to be fixed for "offline shows my data" to be true.

**C1 — a failed read produces a nonsense error, not a recognisable offline state.**
`useFetchData` (`hooks/useApi.ts:30`) → `apiGet` (`utils/api.ts:4`) → `axiosInstance`'s response interceptor, which `return error`s instead of rejecting (`known-issues.md#FETCH-1`). `apiGet` then does `resule?.data` on an `AxiosError`, which has no top-level `.data`, so the query function **resolves `undefined`**. TanStack Query v5 rejects that itself with `Query data cannot be undefined … ["daily-transaction"]` — which is verbatim the string on the user's screen. The screen is showing React Query's internal complaint, not a network message.

**C2 — `isError` is the first gate on every screen, so cached data is thrown away.**
`HomePage.tsx:187` is `isError ? <ErrorState/> : isLoading ? <Skeleton/> : <content/>`. React Query _keeps_ the last successful `data` when a refetch fails, so on this path `dailyTransaction?.data` is very often still populated — the screen just never looks at it. Same shape in `MonthlyTransaction.tsx:317` and `:426`, `HistoryPage.tsx:246`, `BudgetsPage.tsx:155`, `TransactionRequestsPage.tsx:149`.

**C3 — there is no cache to fall back on after a restart.**
`app/_layout.tsx:23` is a bare `new QueryClient()`: memory-only, default `gcTime` of 5 minutes. Open the app cold while offline (or come back to it more than 5 minutes after it was last used) and there is genuinely nothing cached — C2's fix alone would still show the error card.

And the specific thing the user pointed at: **the offline queue never renders as rows on the error path.** `pendingAsTransactions` is computed at `HomePage.tsx:66` and only used inside the non-error branch; on the error branch only `PendingSyncBanner` is mounted (spec 29). So "1 entry saved on this phone" is stated but the entry itself is invisible.

## Goal

Offline (or on any failed read), every list screen shows the last data it successfully loaded — surviving an app restart — plus, on Today, the locally queued entries, with a clear "you're offline, this is saved data" notice and a working retry. A blocking error card appears **only** when there is genuinely nothing to show.

## Scope

**In scope**

- Persisting the React Query cache to `AsyncStorage` so reads survive a restart.
- Making a failed read fail with a meaningful, typed error instead of `data is undefined`.
- Demoting `ErrorState` from a gate to a last-resort fallback on the six read screens.
- Rendering the offline queue as rows on Today even when `daily-transaction` fails.
- Clearing the persisted cache on logout and on a 401, so a second account never sees the first one's figures.

**Out of scope**

- Fixing `FETCH-1` itself. The interceptor is not touched; this spec takes the same opt-in route specs 28/35 took (`apiPostOutcome`/`apiPutOutcome`) and adds the read-side counterpart.
- Automatic background sync / connectivity listeners. Sync stays manual (spec 02's standing decision). No `@react-native-community/netinfo`.
- Offline **writes** beyond the queue that already exists (no offline edit/delete, no optimistic server mutations).
- Making the queue's rows date-filtered or date-aware per screen (Today currently shows every queued entry regardless of `createdAt` — pre-existing, left alone).
- `AUTH-2` (401 vs. in-memory session state, spec 25). Step 7 touches the same 401 branch but does not fix that.

## Design

### D1 — Persist the query cache to AsyncStorage

Use TanStack's own persistence packages rather than hand-rolling it, because `PersistQueryClientProvider` already handles the thing that is easy to get wrong: gating render/fetches on an async restore that finishes _after_ first paint.

```
yarn add --exact @tanstack/react-query-persist-client@5.90.22 @tanstack/query-async-storage-persister@5.90.22
```

> **Corrected 2026-10-09 (spec 38):** this originally said `5.90.20`, "matching the installed `@tanstack/react-query`". The persist packages version independently of `query-core`: `5.90.20` pins `query-core@5.90.18`, which installs a _second_ copy next to react-query's 5.90.20 — the duplicate-`QueryClient` failure described below. **`5.90.22` is the release that pins `query-core@5.90.20`.** See `38-fix-duplicate-query-core-from-persist-packages.md`.

**Pin both exactly, to a release whose `query-core` matches the installed `@tanstack/react-query`'s.** A floating `^5` would pull 5.104.x, whose transitive `@tanstack/query-core` would be installed _nested_ alongside react-query's 5.90 copy — two `QueryClient` classes, and the `instanceof` checks inside the provider break in ways that are miserable to debug. If react-query is ever upgraded, these two move with it.

No native module is involved (both are pure JS on top of the already-present `AsyncStorage`), so **no rebuild of the dev client / APK is required** beyond the normal JS bundle.

### D2 — `apiGet` throws a typed error; the interceptor stays untouched

New export in `utils/api.ts`, mirroring the `TWriteOutcome` precedent on the write side:

```ts
export class ApiReadError extends Error {
  /** true when the request never reached a server (offline, DNS, 60s timeout) */
  readonly offline: boolean;
  readonly status?: number;
}
```

`apiGet` checks `axios.isAxiosError(result)` on the resolved value and throws an `ApiReadError` instead of returning `undefined`:

- no `result.response` → `offline: true`, message `"You're offline."`
- otherwise → `offline: false`, `status`, and the server's `message` (falling back to the axios message).

Why this and not a plain string: screens need to say "offline — showing saved data" for a dead network but "couldn't load" for a 500, and `ErrorState`'s contract is that it shows the message verbatim.

Blast radius is every `useFetchData` caller, but the _observable_ change is only the message text: those queries already end up in `isError` today (via React Query's undefined-rejection), so no screen flips from a success branch to an error branch. One comment goes stale and must be corrected in the same step — `ErrorLogsPage.tsx:54-56` claims "a 403 does NOT set `isError`". It already does (undefined-rejection); after this change it does so with a real message. Its `failed = isError || !data?.success` line stays correct either way and is **not** changed.

### D3 — `ErrorState` becomes a fallback, not a gate

Per screen, the gate becomes "do I have anything to show?":

```ts
const hasCached = !!dailyTransaction?.data; // per screen's own payload
const showErrorCard = isError && !hasCached && !hasQueued; // hasQueued: Today only
```

- `showErrorCard` → `ErrorState` (unchanged copy for a real server error; see Step 4 for the offline wording).
- `isError && !showErrorCard` → render the content as normal, with a compact `OfflineNotice` strip above it.
- Loading stays as-is, but must now be `isLoading && !hasCached` so a restored cache doesn't flash a skeleton over real data.

### D4 — Today renders the queue even with nothing cached

`allRows` (`HomePage.tsx:106`) already merges queued + server rows; the fix is to make the list branch reachable when `isError` is true and `pendingAsTransactions.length > 0`. The totals card (`NetTodayCard`) then shows the server's income/expense, which offline is either the cached figures or `0` — queued entries are deliberately **not** added into those totals, since they aren't confirmed money yet and the pending rows already carry their own "waiting to sync" treatment. Worth a sentence of agreement before building; see Open questions.

### D5 — Clear the persisted cache on logout and on 401

Persisted financial data outliving a session is the one real hazard this spec introduces. `queryClient.clear()` + `persister.removeClient()` go into `logoutFunction` (`context/user.context.tsx:68`) and into the 401 branch of the interceptor (`axiosInstance.ts:60`, which already clears `user`/`token` there). Import direction is `axiosInstance → utils/queryClient`, which introduces no cycle (`queryClient.ts` imports only AsyncStorage + TanStack).

Note for the record: the cache lands in AsyncStorage **unencrypted** — titles, amounts, category names. That is the same exposure the offline queue already accepts (`pendingTransactions`, spec 02), on a non-rooted device sandbox. Flagging it, not solving it here.

### D6 — Do not persist paused mutations

`PersistQueryClientProvider` dehydrates mutations whose state is `isPaused` by default. This app's offline-write story is the explicit queue; a resumed mutation could post the same transaction a second time next launch. Set `shouldDehydrateMutation: () => false` explicitly rather than relying on nothing ever being paused.

## Steps

### ✅ Step 0 — Dependencies

`yarn add --exact @tanstack/react-query-persist-client@5.90.22 @tanstack/query-async-storage-persister@5.90.22` (per D1 as corrected by spec 38). Confirm afterwards that `@tanstack/query-core` exists exactly once **at any depth** (`find node_modules -type d -name query-core -path '*@tanstack*'`) — a `-maxdepth 4` check misses the nested copy, which is how this was first missed.

### ✅ Step 1 — `utils/queryClient.ts` (new)

Owns the client, the persister and the teardown helper, so `_layout.tsx` stays declarative and `user.context`/`axiosInstance` have something to call that isn't a React hook.

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: SEVEN_DAYS,   // must be >= persist maxAge, or restored entries are GC'd on arrival
      staleTime: 30_000,
      retry: 2,             // default 3 + backoff ≈ 7s of skeleton before an offline screen settles
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "EXPENSE_TRACKER_QUERY_CACHE",
  throttleTime: 1000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: SEVEN_DAYS,
  buster: "v1",             // bump to invalidate every persisted cache after a payload-shape change
  dehydrateOptions: {
    shouldDehydrateMutation: () => false,                                  // D6
    shouldDehydrateQuery: (q) =>
      q.state.status === "success" && q.queryKey[0] !== "pending-transactions",
  },
};

export const clearPersistedQueryCache = async () => { … };  // clear() + removeClient()
```

`pending-transactions` is excluded because its source of truth _is_ AsyncStorage (`transactionQueue.getAll`) — persisting it would restore a stale copy of the queue for a frame before the real read lands.

### ✅ Step 2 — `app/_layout.tsx`

Drop the local `const queryClient = new QueryClient()`; swap `QueryClientProvider` for `PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}`. Provider position in the tree is unchanged.

### ✅ Step 3 — `utils/api.ts`

Add `ApiReadError` + the `axios.isAxiosError` check in `apiGet` (D2). Fix the stale comment at `ErrorLogsPage.tsx:54-56` in the same step; change no logic there.

### ✅ Step 4 — `components/main/shared/OfflineNotice.tsx` (new)

A one-line strip, visually lighter than `ErrorState` (no card/elevation — it sits _above_ real content, not instead of it): cloud-offline icon, `C.warning` tone to match `PendingSyncBanner`, text, inline "Retry". Props: `{ offline: boolean; message?: string; onRetry: () => void; updatedAt?: number }`.
Copy: offline → **"You're offline — showing saved data."**; server error → **"Couldn't refresh — showing saved data."** With `updatedAt` (from the query's `dataUpdatedAt`), append `"Last updated <relative time>."` using `date-fns`, already a dependency.

### ✅ Step 5 — `components/main/Home/HomePage.tsx`

1. `const hasCached = !!dailyTransaction?.data;` and `const hasQueued = pendingAsTransactions.length > 0;`
2. Error branch condition → `isError && !hasCached && !hasQueued`. Keep the existing `<PendingSyncBanner/>` next to `ErrorState` (spec 29's reason still holds for the nothing-at-all case).
3. Loading branch → `isLoading && !hasCached`.
4. Content branch renders `{isError ? <OfflineNotice … /> : null}` above `NetTodayCard`.
5. `NetTodayCard`'s `entryCount` currently counts server rows only (`transactions.length`); offline-with-queue-only that reads "0 entries" under a visible row. Use `allRows.length`.
6. `CategoryBreakdown` stays hidden when the breakdown is empty — no change needed, it already guards on `.length > 0`.

### ✅ Step 6 — The other read screens

Mechanical application of D3; no new components beyond `OfflineNotice`.

- `MonthlyTransaction.tsx` — both branches (`:317` monthly, `:426` weekly), each against its own `monthlyTransaction?.data` / `weeklyTransaction?.data`.
- `HistoryPage.tsx:246` — note `:197` and `:312`/`:437` also read `isError` for the chart and empty-state gates; those should key off "no data" rather than `isError` so a cached year still charts.
- `BudgetsPage.tsx:155`.
- `TransactionRequestsPage.tsx:149` — cached requests are the "offline request list" half of the user's report.

### ✅ Step 7 — Cache teardown

`clearPersistedQueryCache()` in `logoutFunction` (`context/user.context.tsx`) and in the interceptor's 401 branch (`axiosInstance.ts`). Per `ai-workflow-rules.md`, `axiosInstance.ts` is handle-with-care: this adds a call inside the existing 401 block and changes neither interceptor's return behaviour.

### ✅ Step 8 — Docs

`progress-tracker.md` row for this spec; a line in `architecture.md`'s provider-stack section (the root provider is now `PersistQueryClientProvider`, and reads are cache-first); no `known-issues.md` entry is closed by this work — `FETCH-1` stays open and the row should say so explicitly.

### ⬜ Step 9 (optional, decide at review) — Toast noise — **not built**

Offline, the interceptor fires a Toast per failed request per retry. With Today's two queries at `retry: 2` that is up to six stacked "Network Error" toasts on a screen that is already explaining itself with `OfflineNotice`. Suppressing duplicates (or skipping the toast when `!error.response`) means editing the protected interceptor, so it is deliberately a separate, optional step rather than folded into Step 3.

## Risks / easy to get wrong

- **`gcTime` < `maxAge`** → restored queries are garbage-collected immediately and the whole feature silently does nothing. They are set from one `SEVEN_DAYS` constant for exactly this reason.
- **Version drift between the three TanStack packages** → duplicate `query-core`, broken provider (D1).
- **A stale persisted cache after a response-shape change.** Any change to a payload the screens read needs a `buster` bump, or restored data of the old shape renders against new code.
- **Cross-account leakage** if Step 7 is skipped or half-done.
- **`expo-router` typed routes** are untouched (no new route files), so no regeneration is needed.
- `index.js`'s widget task handler and `quick-add.tsx` sit _outside_ the provider's control flow but use the same `queryClient` module — check that `quick-add` still invalidates `["daily-transaction"]` correctly after Step 1 moves the client out of `_layout.tsx`.

## Verify when done

- [x] `npx tsc --noEmit` clean; `yarn lint` clean.
- [x] `find node_modules -type d -name query-core -path '*@tanstack*'` returns exactly one path (no depth limit — see spec 38).
- [x] `expo export --platform web` succeeds and renders all routes (the repo's standing smoke check).
- [ ] **Device, warm cache:** open Today online, let it load, enable airplane mode, pull to refresh → entries stay on screen, `OfflineNotice` appears, no `ErrorState`, no `data is undefined`.
- [ ] **Device, cold start:** force-stop the app while still offline, reopen → Today still shows the same entries from the persisted cache.
- [ ] **Device, the reported case:** offline, add a transaction (it queues), confirm it renders as a "waiting to sync" row _and_ the sync banner shows, on both a warm and an empty cache.
- [ ] **Device:** back online → "Sync now" flushes the queue, rows become real entries, `OfflineNotice` disappears after a successful refetch.
- [ ] Activity, Insights, Budgets and Requests each show cached content offline rather than an error card.
- [ ] **Genuinely empty case:** fresh install + offline → `ErrorState` still appears (this spec must not replace a real error with a blank screen).
- [ ] Log out → log in as a different account → no figures from the previous account appear at any point.
- [ ] A real server error (e.g. point `envConfig` at a dead port while online) still surfaces a readable message, not "You're offline".

## Open questions for review

1. **Queued entries and the day's totals (D4):** leave `NetTodayCard`'s income/expense as server-only (my recommendation — a queued entry isn't confirmed), or fold queued amounts in so the net matches the visible rows?
2. **Cache lifetime:** 7 days, or longer? Longer means a month-old Activity screen can render offline; it also means more stale figures to misread.
3. **Step 9 (toast suppression)** — in or out of this spec?
4. Confirm it is acceptable that the cache sits unencrypted in AsyncStorage (D5), consistent with the existing queue.

## Implementation notes (2026-10-09)

**What was built.** Steps 0–8 as written, with these differences from the spec's text:

- **Persist packages pinned to `5.90.22`, not `5.90.20`.** The spec's pin installed a second `query-core`; found by `tsc` during Step 1, planned and fixed in `38-fix-duplicate-query-core-from-persist-packages.md`. D1 and Step 0 above are corrected in place.
- **The skeleton is gated on `isPending && !hasCached`, not `isLoading && !hasCached`.** While `PersistQueryClientProvider` restores the cache, queries are `pending` but not yet `fetching`, so `isLoading` is `false` and the screen would paint its empty state ("Nothing logged today", zeros) for a frame before the restored data lands. `isPending` covers the restore window. Every screen that touches `isLoading` for this gate was changed the same way (Today, Activity ×2, Insights' Year view, Budgets, Requests).
- **`OfflineNotice` is mounted once above the ternary chain** on Budgets, Requests, Activity and Insights (`isError && hasCached`), and inside the content branch on Today — equivalent to "inside the content branch" without restructuring each screen's chain.
- **Insights' Year view only.** The Trend segment (`TrendTab`) returns early before any of the changed gates and keeps its own `isLoading`; it is not one of the six screens in this spec's scope and is unchanged.
- **Open questions** were resolved by taking the spec's recommendations: queued amounts stay out of `NetTodayCard`'s totals (D4), 7-day lifetime, Step 9 out, unencrypted cache accepted.

**Files.** New: `utils/queryClient.ts`, `components/main/shared/OfflineNotice.tsx`. Changed: `app/_layout.tsx`, `utils/api.ts` (`ApiReadError`), `utils/axiosInstance.ts` (one call inside the existing 401 block; return behaviour untouched), `context/user.context.tsx`, `HomePage`, `MonthlyTransaction`, `HistoryPage`, `BudgetsPage`, `TransactionRequestsPage`, and the stale comment in `ErrorLogsPage`. `package.json`/`yarn.lock`: the two persist packages.

**Verified by execution** (real installed packages, in-memory storage): a cold-start restore returns the saved `daily-transaction`; `pending-transactions` and failed queries are not persisted; a `buster` change discards the cache; `clear()` + `removeClient()` leaves nothing for the next cold start. `apiGet`'s branching, reproduced against the interceptor's exact resolve-on-error shape: a 200 returns the body, a 500 throws `ApiReadError{offline:false,status:500,message:"boom"}`, a dead port throws `ApiReadError{offline:true,"You're offline."}`. `quick-add` and `index.js` use no `QueryClient` of their own (hooks only, inside the provider), so moving the client out of `_layout.tsx` leaves them as they were.

**Not verified.** Nothing was run on a device or in airplane mode: every *Device* item below is open, as is the logout → different-account check and the "real server error still reads as a server error" check. The web export only proves the bundle builds and the routes statically render.

**Left alone, worth knowing.** Offline, the interceptor still fires a Toast per failed request per retry (Step 9). With `retry: 2` that is up to three toasts per failing query, and Today runs two. Accepting/rejecting a cached request while offline fails at the PATCH exactly as it did before — it is not queued, and `acceptRequest` only toasts success on `result?.success`, so there is no false "accepted".

