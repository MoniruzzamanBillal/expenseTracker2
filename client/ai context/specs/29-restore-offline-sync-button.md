# 29: Restore the "Sync now" button for offline transactions

## Problem

An entry saved while offline could be seen but never sent. It showed on Today as a
"pending" `TransactionCard` and could be edited or deleted there, and that was all —
there was no way to push it to the server.

The sync machinery was never missing. `useSyncPendingTransactions().syncAll`
(`hooks/usePendingTransactions.ts:56`) is complete: it walks the queue, POSTs each item
to `/transactions/new-transaction` one at a time, removes what succeeds, marks the rest
`failed`, invalidates the transaction queries and toasts a summary. It simply had **zero
call sites**.

The only thing that ever called it, `components/main/shared/PendingSyncBanner.tsx`, was
added by spec 02 (`b62adf8`) and **deleted in `630363c`** — Nocturne redesign phase 4a,
which rewrote Today. The redesign kept the pending rows and dropped the control that
flushed them, so the queue became visible but unflushable. Nothing in spec 27 records
this as intentional; the component it deleted even carries a comment explaining why it
was being kept.

## Goal

A queued entry can be sent to the server from Today, with one tap.

## Scope

**In:**
- Restore `components/main/shared/PendingSyncBanner.tsx`.
- Mount it on Today (`components/main/Home/HomePage.tsx`).

**Out:**
- `syncAll` itself — unchanged. See "Known rough edge" below.
- Automatic sync on reconnect. Spec 02 chose manual-only deliberately ("No automatic
  background sync; the user explicitly triggers it") and no `NetInfo` dependency exists.
  Reversing that is its own spec.
- The queue payload still carries no `categoryId` (spec 13 scope), so a synced entry
  arrives uncategorized regardless of what was picked when it was saved.

## Design

The deleted file was already on the Nocturne design system — `Ionicons`,
`C.warningBg`/`C.warning`, `PrimaryButton variant="outline"` — so it is restored from
`630363c^` rather than rewritten. Two edits: a note recording why it disappeared, and copy
that reflects the button existing again ("Sync to send them to the server" rather than
"They'll sync when you're back online", which described a sync that could not be triggered).

It self-hides on an empty queue (`if (!pendingCount) return null`), so it costs nothing
when there is nothing to sync.

**Placement — two mount points, on purpose.** On Today it sits directly under the
"Spent on" card (`CategoryBreakdown`) and above the Entries list, per direct user
instruction.

That position is inside the branch that only renders once `daily-transaction` has
loaded. Being offline is exactly when the queue is non-empty *and* when that query
fails — which would hide Sync now precisely when it is needed. So it is **also** rendered
next to `ErrorState` in the `isError` branch. Only one branch renders at a time, and the
component self-hides when the queue is empty, so there is no risk of two banners.

## Known rough edge (pre-existing, not introduced here)

`syncAll` has the same flaw spec 28 fixed in the save paths: it reads any non-success as a
failure, so tapping **Sync now while still offline** marks every item `status: "failed"`
with "Sync failed — check connection or re-login", and toasts "0 synced, N failed".

Nothing is lost — the items stay queued and the next tap while online syncs them normally
— but "failed" overstates what happened. `apiPostOutcome`/`usePostOutcome` from spec 28
would fix it properly (offline → leave `pending`; server rejection → `failed` with the
server's real message). Deliberately left out of this spec's scope.

## Implementation notes

Implemented 2026-09-29.

- `client/components/main/shared/PendingSyncBanner.tsx` — restored from `630363c^`, two copy/comment edits.
- `client/components/main/Home/HomePage.tsx` — import; mounted under `CategoryBreakdown`; second mount beside `ErrorState` (the `isError` branch became a fragment to hold both).
- `client/ai context/code-standards.md` — its shared-components list already named `PendingSyncBanner.tsx` while the file did not exist; that line is correct again now, so no edit was needed.

## Verify when done

- [x] `npx tsc --noEmit` and `yarn lint` clean.
- [x] `npx expo export --platform web` succeeds — all 22 routes bundle and static-render, including `/` with the restored banner in the tree. Same check spec 02 used for this component.
- [ ] With a non-empty queue, the card appears on Today directly under "Spent on", above Entries.
- [ ] With an empty queue, nothing renders in that slot.
- [ ] Offline, with a queued entry, the card is still reachable on Today's error state.
- [ ] Tap "Sync now" while online: each entry leaves the pending list and comes back as a normal server-backed row; toast reports the count.
- [ ] Tap "Sync now" while offline: entries stay in the queue (see Known rough edge for the misleading "failed" label).
