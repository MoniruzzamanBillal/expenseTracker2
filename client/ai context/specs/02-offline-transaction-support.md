# 02: Offline Transaction Support (Add + Manual Sync)

## Goal

Let the user add a transaction — single (manual form) or multiple (Smart Add's AI-parsed batch) — while offline, see it reflected locally, and push it to the server with a manual "Sync now" action once back online. No automatic background sync; the user explicitly triggers it.

## Scope

**In scope:**

- Detecting that a save attempt didn't reach the server and queueing it locally instead of losing it.
- A local pending-transaction queue, persisted in `AsyncStorage`, covering both save paths that exist today:
  - `AddTransactionPage.tsx`'s single-item save (`POST /transactions/new-transaction`)
  - `SmartAdd.tsx`'s reviewed-batch save (`POST /transactions/many-transaction`)
- Displaying pending items merged into the existing list screens (home / monthly / weekly / history), visually marked as unsynced.
- A "Sync now" control that flushes the queue against the server.

**Out of scope (explicitly):**

- Automatic background sync / connectivity-change listeners (`NetInfo` auto-retry) — sync is manual only, per the request.
- Any change to `server/src` — no new endpoint, no schema change. Sync uses `/transactions/new-transaction` exclusively (see Design → "Why not `/many-transaction` for sync").
- Categories, budgets, or any other roadmap item from the earlier feature discussion — this spec is offline support only.
- Editing or deleting a transaction while offline — only **adding** is in scope.
- Fixing `FETCH-1` (axios interceptor never rejects) — this spec works _around_ it rather than fixing it, since that's a separately tracked known issue and this feature doesn't strictly require the fix (see Design below). If it's fixed later, the detection logic here should be revisited.

## Design

### The actual failure-detection mechanism (verified against current code, not assumed)

The naive plan — "wrap `mutateAsync` in try/catch, queue on network error" — **does not work in this codebase** and was corrected after reading the real code:

- `axiosInstance.ts`'s response interceptor never rejects on any failure path (HTTP error _or_ pure network/offline error): it shows a Toast and does `return error;`, not `Promise.reject(error)`. This is `known-issues.md#FETCH-1`.
- `apiPost` (`utils/api.ts`) does `const resule = await axiosInstance.post(...); return resule?.data;`. On success, `resule` is `{ data, meta }` (the interceptor's success shape), so `resule.data` is the real API body (`{ success, message, data, statusCode }`). On _any_ failure, `resule` is the raw Axios error object, which has no top-level `.data` — so `resule?.data` resolves to `undefined`.
- `usePost`'s `mutationFn` returns that same `apiPost` promise, which therefore **always resolves**, never rejects, for either save path.

**Consequence for this feature**: detect "the save didn't actually happen" by checking the _resolved value_, not by catching a thrown error:

```ts
const result = await addTransactionMutation.mutateAsync({
  url: "...",
  payload,
});
if (!result?.success) {
  // queue locally instead of treating this as done
}
```

This covers both a true offline/network failure and a server-side error (validation failure, 401, 500) with one check — all of them resolve to `undefined`/falsy `.success` today. That's acceptable for this spec's purpose (anything that didn't succeed gets queued for a later retry), but it does mean a transaction that failed for a _permanent_ reason (e.g. bad payload) will keep failing on every sync attempt — see Open Questions.

### Queue shape and storage

One `AsyncStorage` key (e.g. `pendingTransactions`), holding a JSON array. Each entry:

```ts
type TPendingTransaction = {
  localId: string; // client-generated (e.g. crypto.randomUUID() or a uuid lib)
  payload: {
    type: TTransactionType; // reuse TransactionTypeConst, per code-standards.md's single-enum rule
    amount: number;
    title: string;
    description?: string;
  };
  origin: "manual" | "smart-add";
  batchId?: string; // shared across one Smart Add save; display grouping only
  status: "pending" | "failed";
  error?: string; // last failure message, for display
  createdAt: string; // ISO timestamp, used for date-range filtering when merging into screens
};
```

A small service module, `utils/transactionQueue.ts`, owns all reads/writes: `enqueue(items: TPendingTransaction[])`, `getAll()`, `remove(localId)`, `updateStatus(localId, status, error?)`. All list-screen and sync code goes through this module — nothing touches the `AsyncStorage` key directly elsewhere.

### Single vs. batch: normalized to the same flat queue, always synced one at a time

Both save paths call `usePost`'s `mutateAsync` and both hit the `!result?.success` check above; on failure, both call `transactionQueue.enqueue(...)`:

- `AddTransactionPage.tsx`'s `handleAddTransaction` → enqueues **one** entry, `origin: "manual"`, no `batchId`.
- `SmartAdd.tsx`'s `handleAddPromptData` → enqueues **one entry per item** in `chatResponseData`, all sharing one generated `batchId` — not one queue entry holding an array.

**Why not `/many-transaction` for sync**: that endpoint has no request validation (`known-issues.md#VALID-1`). Routing sync through it would mean a single bad item in a Smart Add batch could fail (or partially apply) the whole request with no clean per-item error. Instead, sync always POSTs to `/transactions/new-transaction` once per queued item — regardless of `origin` — so a failure only affects that one entry and the rest of the batch still succeeds. `batchId` is carried purely so the pending-list UI can render "Smart Add: 3 pending" as one collapsible group; it has no effect on how syncing behaves.

### Where pending items are shown

No new screen. Each existing list screen (`home`'s today list, `monthlyTransactions.tsx`, `weeklyTransactions.tsx`, `history.tsx`) already fetches its own date-scoped data via `useFetchData`. Each gets a small addition: read the queue via a `usePendingTransactions()` hook (wraps `transactionQueue.getAll()` in a `useQuery` so it's cache-friendly and easy to invalidate), filter those entries to the screen's date range using `createdAt`, and merge them into the rendered list. Pending items render through the existing `TransactionCard.tsx` with one added prop/variant (e.g. `pending?: boolean`) that dims the card or adds a small clock icon — no new card component.

A banner (new small component, e.g. `components/main/shared/PendingSyncBanner.tsx`) shown on the home screen only, when `pendingTransactions.length > 0`: "`N transactions pending sync`" + a "Sync now" button. This is the single, always-reachable entry point for syncing, independent of which date-scoped screen the pending items actually belong to.

### Sync mechanics

`transactionQueue.syncAll()`, called from the banner's button:

1. Read all entries with `status !== "synced"` (i.e. everything currently queued).
2. Loop **sequentially** (not `Promise.all`) — POST each entry's `payload` to `/transactions/new-transaction` via the existing `usePost`-backed mutation.
3. On `result?.success` → `transactionQueue.remove(localId)`, then invalidate the four existing query keys (`daily-transaction`, `monthly-transaction`, `weekly-transaction`, `yearly-transaction`) — same keys `AddTransactionPage.tsx` already invalidates on a normal save — so the merged view drops the pending version once the real one is fetched.
4. On failure → `transactionQueue.updateStatus(localId, "failed", message)`, continue to the next item (don't abort the whole loop on one failure).
5. Report a summary at the end via Toast ("2 synced, 1 failed — check connection or re-login").

Sequential looping is deliberate: it keeps failure attribution to one specific item, and personal-use volumes (a handful of queued items at most) make the extra request count irrelevant.

### Token/session handling

The queue stores only transaction data — never a token or user id. Sync reads whatever token is currently in `AsyncStorage` (via the same `axiosInstance` request interceptor every other authenticated call already uses), so identity resolution happens at sync time, not at enqueue time. If the 10-day JWT expired while offline, every sync attempt will fail with a 401; per `axiosInstance.ts`'s existing interceptor behavior, this already clears the stored session and redirects to `/auth` — so the failure is visible, just not queue-item-specific (see Open Questions).

## Implementation notes

- New files: `utils/transactionQueue.ts` (queue CRUD), `hooks/usePendingTransactions.ts` (the query/enqueue/`syncAll` hooks), `components/main/shared/PendingSyncBanner.tsx`.
- Edited files: `components/main/AddTransaction/AddTransactionPage.tsx` (checks `result?.success`, enqueues on falsy), `components/main/smartAdd/SmartAdd.tsx` (same, one queue entry per batch item sharing a `batchId`), `components/main/shared/TransactionCard.tsx` (added a `pending` variant — early-return branch placed *after* its existing `useState`/`usePatch` hook calls, not before, to satisfy rules-of-hooks), `components/main/Home/HomePage.tsx` (mounts `PendingSyncBanner`, merges pending items into the today-list).
- `TransactionCard`'s `onSwipeOpen` prop became optional (`onSwipeOpen?: (ref: Swipeable) => void`) since pending cards don't use `Swipeable` at all; the one real call site (`onSwipeableOpen`) was updated to `onSwipeOpen?.(...)`.
- `TransactionTypeConst` (from `constants/TransactionType.constant.ts`) is what the new queue module's `TPendingTransactionPayload.type` is typed against, per `code-standards.md`'s single-enum-source rule — no fourth enum copy introduced.
- No new dependency. `createBatchId`/the queue's internal id generator checks for `crypto.randomUUID` and falls back to a manual id if it's unavailable in the Hermes runtime, rather than adding a `uuid` package.

### Scope deviation from the original Design section (flagging per `ai-workflow-rules.md`)

While implementing, reading the actual code showed `history.tsx` (`HistoryPage.tsx`) renders **per-month totals only** (`HistoryCard.tsx` summary rows) — it has no per-transaction list at all, so there's no natural slot to merge a pending transaction into. Separately, `monthlyTransactions.tsx`/`weeklyTransactions.tsx` group transactions into day-buckets (`TransactionAccordion.tsx`) using date-range logic (esp. the Friday–Thursday week boundary) that's computed **server-side** — re-deriving that client-side just to place a transient, pre-sync visual item felt like real duplication risk for a cosmetic concern, not something this spec's goal required.

**What was actually built**: pending items are merged and shown only on **Home** (today's list), alongside the `PendingSyncBanner`. This still satisfies the spec's core requirement — the pending queue is visible, marked as unsynced, with one reachable "Sync now" control — without the day/week-bucket duplication. Monthly, Weekly, and History are untouched by this pass. If per-day/per-week placement is wanted later, it should be its own follow-up rather than folded into this one.

### Open questions — resolved for this pass

1. **Permanent vs. transient failure**: deferred, as anticipated. A failed item stays in the queue with `status: "failed"` and a generic error message, and is retried on the next "Sync now" tap; there's no remove/discard/edit affordance for a queued item in this pass.
2. **Batch grouping in the UI**: not built. `batchId` is stored on each queue entry (so it's available for a future grouped view) but the pending list today renders as a flat list of individually-pending cards, Smart Add-originated or not.
3. **Pending banner placement**: Home-only, as proposed — and, per the scope deviation above, that's also the only screen showing the pending items themselves.
4. **Proactive `NetInfo` check**: not added. "Sync now" is always tappable when the queue is non-empty; a failed attempt just reports via the existing Toast summary path.

## Verify when done

- [x] `yarn lint` and `npx tsc --noEmit` both pass clean on the full changeset.
- [x] `npx expo export --platform web` succeeds — Metro bundles and static-renders `/`, `/addTransaction`, `/smart-add`, `/monthlyTransactions`, `/weeklyTransactions` with no errors, confirming the component tree (including the new `pending` `TransactionCard` branch and `PendingSyncBanner`) renders without throwing.
- [ ] Turn off network, add a single transaction via the manual form — it appears in Home's list marked pending, and the pending banner shows "1 transaction pending sync." **Not yet manually verified in a running app** (no device/simulator session in this pass — see note below).
- [ ] Turn off network, run Smart Add, review the parsed list, save it — all N items appear pending on Home (flat list, not grouped — see resolved open question 2). **Not yet manually verified.**
- [ ] Reconnect, tap "Sync now" — each item disappears from "pending" and reappears as a normal, server-backed transaction after the relevant query invalidates. **Not yet manually verified.**
- [ ] Simulate one item failing sync (e.g. stop the server mid-loop) — confirm the other queued items still sync successfully and only the failed one remains queued with an error message. **Not yet manually verified.**
- [ ] Confirm queued items survive an app restart (persisted in `AsyncStorage`, not just in-memory state). **Not yet manually verified.**
- [x] Sync never calls `/transactions/many-transaction` — confirmed by code inspection: `useSyncPendingTransactions`'s `syncAll` only ever calls `apiPost("/transactions/new-transaction", ...)`, once per queued item, in a sequential `for` loop.
- [ ] Expired-token case: let the stored JWT lapse, attempt sync — confirm the existing 401 interceptor behavior (session cleared, redirected to `/auth`) fires and the queue is left intact for retry after re-login. **Not yet manually verified.**

**Note on verification depth**: same caveat as spec 01 — this pass verified compilation, linting, and that every affected route statically renders without throwing. It has **not** been manually exercised in Expo Go/a simulator with airplane mode toggled against a real running server, which is the only way to confirm the actual offline→queue→reconnect→sync round-trip behaves as designed end-to-end. Recommend that pass before considering this fully done.
