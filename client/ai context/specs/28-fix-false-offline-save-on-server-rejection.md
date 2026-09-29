# 28: Fix "Saved offline" on a server rejection (uncategorized transaction)

## Problem

Adding a transaction **without picking a category**, while fully online, saves it to the
local offline queue and toasts "Saved offline — It will sync when you're back online".
The entry never reaches the server until a later sync, and it arrives without whatever
the user actually typed into the category field (the queue payload has no `categoryId`
at all, by spec 13's scope).

It is not a connectivity problem. Three separate things line up:

**1. The client sends `categoryId: null` when nothing is picked.**

`AddTransactionPage.tsx`'s `categoryId` state is `useState<string | null>(null)`, and the
online payload spreads it in unconditionally:

```ts
payload: { ...basePayload, categoryId }
```

**2. The server's create schema rejects an explicit `null`.**

`server/src/app/modules/transaction/transaction.validation.ts`:

```ts
categoryId: z.string().min(1).optional(),   // createTransactionSchema
categoryId: z.string().min(1).nullable().optional(),   // updateTransactionSchema
```

Zod's `.optional()` admits `undefined`, not `null`. Confirmed by running the real schema:

| body | result |
| --- | --- |
| `categoryId: null` | **FAIL** — `body.categoryId: Expected string, received null` |
| `categoryId` omitted | PASS |
| `categoryId: "abc"` | PASS |

So `POST /api/transactions/new-transaction` answers **400**. Note the update schema has
had `.nullable()` all along, which is why *clearing* a category on an existing entry works
while *creating* without one does not.

**3. The client reads any non-success as "offline".**

```ts
if (result?.success) { ... } else {
  // The save didn't reach the server (offline or a server-side failure —
  // both resolve here rather than throwing, see known-issues.md#FETCH-1).
  await enqueuePendingTransactions([{ payload: basePayload, origin: "manual" }]);
  Toast.show({ type: "success", text1: "Saved offline", ... });
}
```

Because of `known-issues.md#FETCH-1` the response interceptor **resolves** with the
`AxiosError` instead of rejecting, so `apiPost` returns `undefined` for a 400 exactly as it
does for a dead network. The `else` branch cannot tell the two apart, and its comment
admits as much. A 400, a 500 and airplane mode all produce "Saved offline".

The category is the trigger the user hit, but the conflation is the real defect: **any**
server rejection is currently reported to the user as a successful offline save.

## Goal

An entry is queued locally **only** when the request genuinely got no response from the
server. A server that answered — with any status — is reported as what it is, and a
transaction with no category saves normally, online, first try.

## Scope

**In:**
- `utils/api.ts` — a way for a caller to see *why* a write failed, without changing what
  the existing `apiGet`/`apiPost`/... helpers return.
- `components/main/AddTransaction/AddTransactionPage.tsx` — the save branch, and omitting
  `categoryId` when nothing is picked.
- `app/quick-add.tsx` — identical save branch, same two fixes.
- `components/main/smartAdd/SmartAdd.tsx` — same `else`-means-offline branch on the bulk save.
- `server/.../transaction.validation.ts` — accept an explicit `null` on create, matching
  the update schema. Defence in depth: the client stops sending `null`, and the server
  stops treating it as invalid if anything else does.

**Out (explicitly not touched):**
- `FETCH-1` itself. The interceptor keeps resolving on error; every other screen still
  depends on that behavior, and fixing it globally is item 1 in `progress-tracker.md`'s
  Next Up with its own blast radius. This spec adds an opt-in way to inspect a failure
  and uses it in the three save paths only.
- The offline queue's payload shape. It still carries no `categoryId` (spec 13 scope) —
  so an entry queued while genuinely offline still syncs uncategorized. Unchanged here.
- `hooks/usePendingTransactions.ts`'s `syncAll`, which has the same
  `else`-means-failure shape. It already labels the outcome "failed" rather than claiming
  success, so it misreports nothing; left alone.
- The missing `return` after `setTitleError(true)` in `handleAddTransaction` — a separate
  bug (an entry with no title still submits as "Uncategorized"). Flagged, not fixed here.

## Design

### A. Let a caller inspect the failure — `utils/api.ts`

The response interceptor resolves both paths, but with distinguishable values: `{data, meta}`
on success, the `AxiosError` on failure. `axios.isAxiosError()` separates them, and an
`AxiosError` with **no `.response`** is precisely the no-response case — offline, DNS
failure, or the 60s timeout.

Add one helper alongside the existing ones (they keep their current signatures and call sites):

```ts
export type TWriteOutcome<TBody> =
  | { ok: true; body: TBody }
  | { ok: false; offline: true }
  | { ok: false; offline: false; status?: number; message: string };

export const apiPostOutcome = async <TBody = any>(
  endPoint: string,
  payload: any,
): Promise<TWriteOutcome<TBody>> => { ... };
```

Rules:
- not an `AxiosError` → `{ ok: true, body: result.data }` (the interceptor's success shape).
- `AxiosError` with no `.response` → `{ ok: false, offline: true }`. **Queue it.**
- `AxiosError` with a `.response` → `{ ok: false, offline: false, status, message }`.
  **Don't queue it** — the server has an opinion and the user needs to see it.

A body that came back `200` but with `success: false` counts as answered, not offline.

### B. The three save paths

```
outcome.ok                      → existing success path (receipt upload, reset, navigate)
!outcome.ok && outcome.offline  → enqueue + "Saved offline"   (unchanged behavior)
!outcome.ok && !outcome.offline → error toast with the server's message; form keeps its
                                  values, nothing is queued, no navigation
```

Keeping the form populated on a server rejection matters: today the screen resets and
navigates away, so a rejected entry looks saved and the user's typing is gone.

The interceptor still shows its own toast for the failure. The rejection branch therefore
does not add a second toast of its own — it stops the false "Saved offline" claim and the
navigation, which is the visible bug.

### C. Stop sending `null`

```ts
payload: { ...basePayload, ...(categoryId ? { categoryId } : {}) }
```

Omission is what the schema already accepts, and it matches how the queue's payload is
built. Same edit in `quick-add.tsx`; `SmartAdd.tsx` maps `categoryId: d.categoryId ?? null`
per draft and gets the same treatment.

### D. Server — accept `null` on create

```ts
categoryId: z.string().min(1).nullable().optional(),
```

One word, and it makes create agree with update. `addNewTransaction` already stores
whatever it is given; `null` is the column's own "no category" value.

**Alternative rejected:** *ship only the server change.* It would fix the reported symptom
and leave the real defect — every 4xx/5xx still reported to the user as a successful
offline save.

**Alternative rejected:** *add `@react-native-community/netinfo` and check connectivity
before saving.* A new native dependency to answer a question the failed request already
answers, and it races: online at check time is not online at request time.

## Implementation notes

Implemented 2026-09-29.

- `client/utils/api.ts` — new `TWriteOutcome` type + `apiPostOutcome`. Existing helpers and
  the interceptor untouched.
- `client/hooks/useApi.ts` — new `usePostOutcome`. **Deviation from the Design above:** the
  save paths call this rather than `apiPostOutcome` directly. The draft plan had each screen
  re-invalidating its query keys by hand, which duplicated `usePost`'s list in three places
  and would silently rot; a parallel hook keeps `isPending` (the Save button's spinner reads
  it) and the invalidation list where they already live. It invalidates **only** when
  `outcome.ok`, so a rejected save no longer refetches as if something had changed.
- `client/components/main/AddTransaction/AddTransactionPage.tsx` — `usePostOutcome`;
  `ok` / `offline` / rejected branches; payload omits `categoryId` when none is picked.
- `client/app/quick-add.tsx` — same three changes.
- `client/components/main/smartAdd/SmartAdd.tsx` — same, mapped over the draft array.
  `parseMutation` stays on plain `usePost` (it isn't a save and never queues).
- `server/src/app/modules/transaction/transaction.validation.ts` — `.nullable()` on create.

Worth knowing: a **401** used to be queued as an offline save too, so an expired session
quietly buried entries in the local queue while redirecting to login. It now falls in the
rejected branch and is not queued.

Verified by execution, not by reading:

- The real `createTransactionSchema`, loaded through `ts-node` — `categoryId: null` **PASS**
  (was `FAIL — Expected string, received null`), omitted **PASS**, `"abc"` **PASS**,
  `""` still correctly **FAIL**.
- `apiPostOutcome`'s branching against every shape the interceptor can return — success →
  `ok`; 400/401/500 → `{ offline: false }` with the server's message; no `.response` →
  `{ offline: true }`. Only the last one queues.

## Verify when done

- [x] `npx tsc --noEmit` and `yarn lint` clean in `client/`; `npx tsc --noEmit` clean in `server/`, and `yarn lint` shows only the 4 pre-existing baseline errors.
- [ ] Online, add a transaction **with no category**: saves on the server, appears on Today, toast is the server's success message — **not** "Saved offline", and nothing lands in the pending queue.
- [ ] Online, add a transaction **with** a category: unchanged, category shown on the entry.
- [ ] Airplane mode, add a transaction: still "Saved offline", still appears as pending on Today, still syncs when back online.
- [ ] Force a server rejection while online (e.g. an amount of `0`, which `createTransactionSchema` rejects): an error is shown, **nothing** is queued, the screen stays put and keeps what was typed.
- [ ] Same three checks through the Quick Add widget route (`client://quick-add?type=expense`).
- [ ] Smart Add with at least one uncategorized draft: saves online in one go, no "Saved locally".
- [x] The create schema accepts `categoryId: null` — confirmed against the real schema module (see Implementation notes). Still worth one `curl` against a running server end-to-end.

**Everything unchecked above needs a running app and a live server — not done this session.**
The server change is deployed only when `server/` is redeployed to Vercel; until then a
client pointed at `https://exp2server.vercel.app` relies on the client-side fix (omitting
`categoryId`) alone, which is sufficient on its own for the reported bug.
