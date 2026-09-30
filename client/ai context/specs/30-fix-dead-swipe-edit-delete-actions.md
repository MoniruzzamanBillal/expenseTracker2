# 30 — Fix dead swipe Edit/Delete actions on TransactionCard

**Status**: Completed 2026-09-30 (two rounds, both from direct user reports)
**Scope**: `client/` only. No server change, no data-layer change.

Round 1 restored the panes (the `scale: 0` bug below). Round 2, after the user retested, fixed the
two things that were still wrong once the panes were visible: the Delete confirm never appeared, and
the glyph sat left of its label.

## Reported symptom

User: "in my previous version I had the functionality for editing or deleting a transaction, but in my current version you did not add these features… when I swipe left/right I see edit and delete icon and those icons were functional for deleting and updating transaction."

The features were never removed. Every piece of the edit/delete path survived the Nocturne redesign intact — the two action panes were just rendered at `scale: 0`, which makes them both invisible and untappable.

## Root cause

`components/main/shared/TransactionCard.tsx` defines two direction-specific action renderers:

| Renderer | Action | `dragX` interpolation |
|---|---|---|
| `renderLeftActions` | Delete | `inputRange: [0, 100]` → `outputRange: [0, 1]`, `extrapolate: "clamp"` |
| `renderRightActions` | Edit | `inputRange: [-100, 0]` → `outputRange: [1, 0]`, `extrapolate: "clamp"` |

`Swipeable` reveals its **left** pane when the user drags **right** (`dragX` positive) and its **right** pane when the user drags **left** (`dragX` negative). Each renderer's `inputRange` is therefore only valid for its own side.

Nocturne phase 2 (`3833c6e`, "feat(client): Nocturne redesign phase 2 — shared components") wired them crossed:

```tsx
renderLeftActions={renderRightActions}
renderRightActions={renderLeftActions}
```

With the panes crossed, each renderer receives a `dragX` of the opposite sign to the one its `inputRange` covers, so `extrapolate: "clamp"` pins the result at the zero end of its `outputRange` for the entire drag:

```
left pane  (dragX=+64) via renderRightActions → clamp(+64 → [-100,0]) → scale 0.00
right pane (dragX=-64) via renderLeftActions  → clamp(-64 → [0,100])  → scale 0.00
```

`transform: [{ scale: 0 }]` collapses the `Animated.View` to zero size, which removes the `TouchableOpacity`'s hit area along with its pixels. Both Delete and Edit were unreachable in both directions — not just mis-sided.

This is the "swapped swipe-action directions on TransactionCard" that spec 27's Implementation notes flagged for a human pass. The notes recorded it as a cosmetic direction swap; it was in fact a total loss of both actions. Nothing in the automated checks could catch it — `yarn lint` and `npx tsc --noEmit` were clean across all four Nocturne phases, and the bug only manifests under a real gesture.

## Fix

One line pair in `TransactionCard.tsx`, restoring the pairing used before `3833c6e`:

```tsx
renderLeftActions={renderLeftActions}
renderRightActions={renderRightActions}
```

Directions now match the pre-Nocturne build the user remembers:

- **Swipe right** → Delete (left pane, `C.expenseBg` / `C.expense`, `trash-outline`) → `ConfirmModal`-less `Alert.alert` confirm → `PATCH /transactions/delete-transaction/:transactionId`
- **Swipe left** → Edit (right pane, `C.accentDim` / `C.accentText`, `create-outline`) → `UpdateTransactionModal` (a `Sheet`) → `PATCH /transactions/update-transaction/:transactionId`

## What was verified as already-correct (not changed)

Checked while diagnosing, so the fix isn't masking a second break:

- `handleDeleteTransaction` posts to `/transactions/delete-transaction/${_id}` via `usePatch(INVALIDATE_KEYS)`; server route is `router.patch("/delete-transaction/:transactionId", authCheck, …)` — matches.
- `UpdateTransactionModal` holds both an update path (`/transactions/update-transaction/:id`) and its own delete path, both via `usePatch` — matches the server routes.
- `INVALIDATE_KEYS` covers `daily-`/`monthly-`/`weekly-`/`yearly-transaction` + `budgets`, so both screens that mount the card refresh after a mutation.
- Both consumers (`HomePage.tsx:184`, `TransactionAccordion.tsx:58`) pass `onSwipeOpen`, so the "one row open at a time" behavior still works.
- The `pending` branch (offline-queued rows) never used `Swipeable` — it renders tap-to-edit + a trash button and was unaffected.

## Round 2 — what was still broken once the panes rendered

### a) Delete did nothing (`known-issues.md#UX-3`)

User: "the delete icon for deleting a transaction is not functional. when i click that nothing happens.
when i click the delete icon i should see a warning modal and after confirming the transaction data
should be deleted."

`confirmDelete` used `Alert.alert`, which is a hard no-op on the web target — so the confirm step was
skipped and, with it, the delete. Replaced with the existing cross-platform
`components/main/shared/ConfirmModal.tsx` (already used by `TransactionRequestsPage`), driven by a new
`confirmOpen` state declared above the `pending` early-return so hook order is identical in both
branches.

Converted all three `Alert.alert` confirms in this flow, since a half-converted file would have left a
dead confirm one tap away from a live one:

| Site | Before | After |
|---|---|---|
| `TransactionCard` swipe-Delete pane | `Alert.alert` | `ConfirmModal`, `loading={patchMutation?.isPending}` |
| `TransactionCard` pending-row trash | `Alert.alert` | `ConfirmModal` |
| `UpdateTransactionModal` Delete button | `Alert.alert` | `ConfirmModal` nested inside `Sheet` |

`Alert` is no longer imported in either file. This closes the `TransactionCard` and
`UpdateTransactionModal` halves of `UX-3`; the remaining `Alert.alert` confirms listed in
`progress-tracker.md` are untouched.

**Caveat on the third row**: `ConfirmModal` and `Sheet` are both `react-native-paper`
`Portal` + `Modal`, so that one nests a Paper modal inside a Paper modal. Paper hoists both to the
`PortalHost` at the root, and the dialog is ordered after the sheet, so it should layer on top — but
this specific stack was **not** rendered and observed. If it misbehaves on a device, the fallback is to
hoist the dialog out of `Sheet` into `TransactionCard` alongside the one already there.

### b) Delete icon left-aligned instead of centred

User: "the delete icon and label is not aligned. the icon should be in center, now it is in left."

Each pane's `Animated.View` centres its single child, but that child is a `TouchableOpacity` with the
default `flexDirection: "column"` and `alignItems: "stretch"`. It sizes to its widest child — the
"Delete"/"Edit" label — and the narrower glyph then stretches to the left edge of that box. Added a
`styles.actionBtn` (`alignItems: "center"`) to the `TouchableOpacity` in both panes.

## Not fixed in this spec — "Spent on" staleness after an update

Also reported in round 2: "when I update a transaction, the 'Spent on' section doesn't update, it still
shows old data."

**No change was made for this, and it should be treated as still open.** The whole chain was read and
every link is correct:

- `UpdateTransactionModal`'s `usePatch(INVALIDATE_KEYS)` includes `["daily-transaction"]`, the exact key
  `HomePage` registers — and `invalidateQueries` matches by prefix, so the other screens' keys
  (`monthly-`/`weekly-`/`yearly-transaction`, `budgets`) match too. Every `useFetchData` key in the app
  was cross-checked against every `INVALIDATE_KEYS` list; there is no mismatch.
- There is exactly one `QueryClient` (`app/_layout.tsx:23`), with no `staleTime`/`refetchOnMount`
  override, so an invalidated active query refetches immediately.
- `HomePage` derives `categoryBreakdown` straight off the query result — no memo that could hold a stale
  array.
- Server-side, `getDailyTransactions` recomputes `buildCategoryBreakdown` from scratch on every call,
  and `updateTransaction` persists `categoryId` (its Zod schema allows `null`).

So a *successful* update does refresh "Spent on". The three candidate explanations that survive, none
confirmed:

1. **The PATCH is failing and `FETCH-1` hides it.** The interceptor resolves instead of rejecting, so a
   400 still reaches `usePatch`'s `onSuccess` → the cache is invalidated → the refetch returns unchanged
   data → the UI shows "old data". This fits the report exactly and is the most likely cause. It also
   predicts the sheet staying open with no success toast.
2. **The edited transaction isn't in today's window**, so Today's breakdown correctly doesn't move —
   made more likely by `server/ai context/known-issues.md#DATE-1`: `getDailyTransactions` builds its
   range with the *local* `Date` constructor from *UTC* components, so for a UTC+6 user the "today"
   window is skewed by 6 hours.
3. **Browser HTTP caching** on the web target only.

Verification was set up (a throwaway in-memory stub API on port 5000 + the web target) but stopped
before it ran, so nothing here is confirmed by execution. Distinguishing 1 from 2 needs one
observation: whether the sheet closes and a green success toast appears when saving the edit.

## Verify when done

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` clean
- [x] Interpolation math confirmed by execution (both wirings evaluated at `dragX = ±64`: crossed → `0.00`/`0.00`, matched → `0.64`/`0.64`)
- [ ] **On a device**: swipe a row right on Today → red Delete pane scales in → tap → confirm → row disappears, totals update
- [ ] **On a device**: swipe a row left on Today → Edit pane scales in → tap → `UpdateTransactionModal` opens prefilled → save → row updates
- [ ] **On a device**: same two gestures inside Activity's day groups (`TransactionAccordion`)
- [ ] **On a device**: swiping a second row closes the first
- [ ] **On a device / on web**: the Delete confirm dialog actually appears, Cancel dismisses it, Delete removes the row
- [ ] **On a device**: the trash on a pending (unsynced) row opens the same dialog
- [ ] **On a device**: `UpdateTransactionModal`'s Delete opens the dialog *above* the sheet, not behind it (see the caveat above)
- [ ] **Visual**: the Delete/Edit glyph is centred over its label in both panes
- [ ] **Open question**: when the "Spent on" staleness is retested, note whether the edit sheet closes with a success toast — that is what separates cause 1 from cause 2 above

## Known rough edge left as-is

`handleDeleteTransaction` still reports success off `result?.success`, which under `FETCH-1` cannot
distinguish a rejected delete from a successful one. Unchanged here — that is the `FETCH-1` fix
(`progress-tracker.md` Next Up item 1), not this spec's scope.
