# 04: Edit / Delete a Pending (Offline-Queued) Transaction

## Goal

Spec 02 (offline transaction support) deliberately deferred this, as its own open question 1: a pending item has no way to be corrected or removed from the queue — it just sits there, retried on every "Sync now" tap forever, even if it was entered wrong or will permanently fail (e.g. a bad amount typed while offline). This spec closes that gap: let the user edit a pending item's details, or delete it outright, entirely locally — before it's ever synced.

## Scope

**In scope:**

- Deleting a pending transaction from the local queue (with a confirmation, mirroring the existing real-transaction delete confirm).
- Editing a pending transaction's `type`/`amount`/`title`/`description` in place, entirely locally — no network call.
- Both actions available from Home's pending-item cards (the only place pending items are shown, per spec 02's Home-only scope decision).

**Out of scope (explicitly):**

- Editing or deleting an already-synced (real) transaction — completely unchanged, still goes through `usePatch`/the server as today.
- Undo for a delete (once removed from the queue, it's gone — same as the existing real-transaction delete, which also has no undo).
- A bulk "delete whole batch" action for a Smart Add `batchId` group — this spec only adds per-item edit/delete, not group-level actions.
- Any change to `syncAll`, the sync endpoint choice, or spec 02/03's Home-only display decisions.

## Design

### Queue layer: one new operation

`utils/transactionQueue.ts` already has `enqueue`/`remove`/`updateStatus`. Add:

```ts
const updatePayload = async (
  localId: string,
  payload: TPendingTransactionPayload,
): Promise<void> => {
  const queue = await readQueue();
  const updated = queue.map((item) =>
    item.localId === localId
      ? { ...item, payload, status: "pending", error: undefined }
      : item,
  );
  await writeQueue(updated);
};
```

Resetting `status` to `"pending"` and clearing `error` on edit is deliberate: editing is the user's way of trying to fix whatever was wrong, so the corrected item should be retried cleanly on the next sync rather than staying flagged `"failed"` with a stale error message from before the edit.

### Hook layer: two new hooks, mirroring `useEnqueuePendingTransactions`

In `hooks/usePendingTransactions.ts`:

```ts
export const useUpdatePendingTransaction = () => {
  const queryClient = useQueryClient();

  return async (localId: string, payload: TPendingTransactionPayload) => {
    await transactionQueue.updatePayload(localId, payload);
    await queryClient.invalidateQueries({ queryKey: PENDING_QUERY_KEY });
  };
};

export const useRemovePendingTransaction = () => {
  const queryClient = useQueryClient();

  return async (localId: string) => {
    await transactionQueue.remove(localId);
    await queryClient.invalidateQueries({ queryKey: PENDING_QUERY_KEY });
  };
};
```

### UI: two small icon actions on the pending card, an edit modal

`TransactionCard.tsx`'s pending branch (added in spec 02, currently a plain non-`Swipeable` `View` with title/date/amount only) gains two `IconButton`s (`react-native-paper`, same component `SmartAdd.tsx` already uses for its own inline delete-from-list action) in the top-right, next to the amount:

- **Delete** (`delete-outline` icon): `Alert.alert` confirmation, same copy pattern as the real card's own delete (`"Delete transaction?" / "This item will be deleted from the list"`), then calls `useRemovePendingTransaction()`.
- **Edit** (`pencil-outline` icon): opens a new local-state-controlled modal, `PendingTransactionEditModal`.

No `Swipeable`/gesture wiring is added for pending cards — plain tappable icon buttons are simpler and sufficient here, consistent with `SmartAdd.tsx`'s own precedent for an inline delete action on a not-yet-saved item.

### New component: `components/main/shared/PendingTransactionEditModal.tsx`

Structurally mirrors `UpdateTransactionModal.tsx` (same income/expense toggle, amount/title/description `TextInput`s, same `Portal`/`Modal`/`KeyboardAwareScrollView` shell) — but:

- Takes a `TPendingTransaction` as `initialValue` (not `TTransaction`), pre-filling from `initialValue.payload`.
- Imports `TransactionTypeConst` from `constants/TransactionType.constant.ts` for its type-toggle state — **not** `transactionConstants`/`TTransactionType` from `AddTransactionPage.tsx`, unlike `UpdateTransactionModal.tsx`'s existing (pre-dating this spec) import. This is new code, so it follows `code-standards.md`'s single-enum-source rule properly rather than perpetuating `known-issues.md#TYPE-1` a third time.
- On save, calls `useUpdatePendingTransaction()` with the edited payload instead of `usePatch`/a server PATCH — no network request, no `_id`, no server involvement at all.

This is a duplicate-rather-than-generalize decision, same precedent as spec 01's `MonthlyAverageCard` vs. `WeeklyAverageCard` call: `UpdateTransactionModal.tsx` is wired tightly to a real `_id` and a server PATCH; branching it internally for a "local-only, no id, no request" mode would be more invasive than a small, focused sibling component.

## Implementation notes

- New file: `client/components/main/shared/PendingTransactionEditModal.tsx`.
- Edited files: `client/utils/transactionQueue.ts` (`updatePayload`), `client/hooks/usePendingTransactions.ts` (`useUpdatePendingTransaction`, `useRemovePendingTransaction`), `client/components/main/shared/TransactionCard.tsx` (icon buttons + modal wiring in the pending branch only — the real-transaction branch is untouched).
- No server changes, no new dependency.

## Implementation notes — actual vs. planned

- `PendingTransactionEditModal`'s `initialValue` prop is typed `TTransaction` (same as `UpdateTransactionModal`'s prop), not a raw `TPendingTransaction`, since `TransactionCard`'s pending branch only ever receives the already-adapted `TTransaction`-shaped object (`HomePage.tsx`'s `pendingAsTransactions` mapping, where `_id` **is** the queue's `localId`). This avoids introducing a second prop shape for no benefit — `initialValue._id` is passed straight through to `useUpdatePendingTransaction`/`useRemovePendingTransaction` as the `localId`.
- The pending branch reuses the existing `modalOpen`/`setModalOpen` state (already declared unconditionally above the `if (pending)` check, originally for the real card's `UpdateTransactionModal`) for `PendingTransactionEditModal`'s open state too, rather than adding a second `useState`.
- `useRemovePendingTransaction()` is called at the top of the component (alongside `patchMutation`), unconditionally, to satisfy rules-of-hooks — same discipline spec 02 already established for this file.

## Verify when done

- [x] `yarn lint` and `npx tsc --noEmit` both pass clean.
- [x] `npx expo export --platform web` statically renders `/` (and all other routes) without error.
- [ ] Queue a pending transaction, tap delete, confirm the Alert, confirm it's removed from `AsyncStorage` and disappears from Home. **Not yet manually verified** (no device/simulator session in this pass).
- [ ] Queue a pending transaction, tap edit, change the amount/title, save — confirm the queue entry reflects the new payload and the card updates without a network call. **Not yet manually verified.**
- [ ] Edit a pending item that's currently `status: "failed"` — confirm its status resets to `"pending"` and its old `error` is cleared, so the next "Sync now" retries it cleanly. **Not yet manually verified** (confirmed by code inspection: `transactionQueue.updatePayload` unconditionally sets `status: "pending"` and `error: undefined`).
- [ ] Confirm a real (synced) transaction's swipe-to-edit/delete behavior is completely unaffected. **Not yet manually verified** — unchanged by code inspection (the non-pending branch below the early return is untouched).

## Open questions

1. Should the edit modal warn if the user changes `type` away from what a Smart Add-parsed item originally had (since Smart Add batches are AI-derived and a manual type change might indicate the AI misclassified it) — or is that indistinguishable from a normal correction and not worth a special warning? **Not addressed this pass** — no warning added.
2. This spec doesn't add a "delete whole Smart Add batch at once" action (per Scope) — worth a follow-up spec if reviewing a 5-item AI-parsed batch one-by-one turns out to be tedious in practice? **Deferred, unresolved** — left for a future spec if it comes up.
