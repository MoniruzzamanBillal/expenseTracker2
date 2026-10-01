# 34 — Fix dead Delete confirms on Budgets and Categories (`UX-3`)

**Status**: Completed 2026-09-30
**Scope**: `client/` only — `BudgetsPage.tsx`, `BudgetFormModal.tsx`, `CategoryFormModal.tsx`. No server
change, no data-layer change.

Third round of the same defect spec 30 closed for transactions. Same cause, same fix, different screens.

## Reported symptom

User, on the budget edit sheet: "when i click the delete button nothing happens…"

This came immediately after a request to fix that button's *size* (commit `035f521`), so the size work was
cosmetic and the button was dead the whole time.

## Root cause — `known-issues.md#UX-3`

`Alert.alert` is a hard no-op on the web target, which is where this is being tested. Every one of these
confirms put the delete **inside** the alert's `onPress`, so when the alert didn't render, the confirm
step and the deletion went with it — a silent nothing, no error, no toast.

Three dead confirms, not one:

| Site | Reached by | Before |
|---|---|---|
| `BudgetFormModal` | Edit sheet → Delete button | `Alert.alert("Delete this budget?", …)` |
| `BudgetsPage` | The trash icon on a budget row | `Alert.alert("Delete this budget?", …)` |
| `CategoryFormModal` | Settings → category → Delete | `Alert.alert("Delete category?", …)` |

The `BudgetsPage` one matters: it is the trash icon recoloured to `C.expense` in `aefa326` one commit
earlier. That icon was dead too, and the user could equally have meant it. Fixing only the sheet would
have left a dead delete one tap away from a working one — the same reasoning spec 30 used for converting
all three sites in the transaction flow at once.

## Fix

All three now drive the existing cross-platform `components/main/shared/ConfirmModal.tsx`, which is what
`TransactionCard`, `UpdateTransactionModal` and `TransactionRequestsPage` already use. `Alert` is no
longer imported in any of the three files.

The two sheets follow `UpdateTransactionModal`'s shape exactly — a `confirmOpen` boolean and the dialog
rendered as a sibling of `KeyboardAwareScrollView` inside `Sheet`.

`BudgetsPage` needed a different shape because the dialog sits one node outside the list it belongs to:
it holds `deleteTarget: TBudget | null` instead of a boolean, `visible={!!deleteTarget}` opens it, and
`handleDelete` reads the target from state. Clearing it in a `finally` means a failed delete closes the
dialog rather than leaving it stuck open over a row.

Each dialog also gained a message naming the consequence rather than just echoing the category name,
which is all the alerts passed as their body:

- budgets — "The monthly limit on \<category\> will be removed."
- categories — "\"\<name\>\" will no longer be available when adding a transaction."

## Carried over from spec 30, unchanged

**Nested Paper portals.** `ConfirmModal` and `Sheet` are both `react-native-paper` `Portal` + `Modal`, so
the two sheet dialogs nest a Paper modal inside a Paper modal. Paper hoists both to the root `PortalHost`
and orders the dialog after the sheet, so it should layer on top. Spec 30 flagged this as unverified for
`UpdateTransactionModal` and it is **still unverified** — now in three places instead of one. If the
dialog renders behind the sheet, the fix for all three is the same: hoist it out into the parent screen,
the way `BudgetsPage`'s already is.

**`FETCH-1`.** Every one of these still reports success off `result?.success`, which under the interceptor
that never rejects cannot tell a rejected delete from a successful one. Out of scope here, same as in
spec 30 — it is `progress-tracker.md` Next Up item 1.

## Verify when done

- [x] `npx tsc --noEmit` clean
- [x] `yarn lint` clean
- [x] `Alert` no longer imported or referenced in any of the three files (grep count 0)
- [ ] **On web**: Budgets → edit a budget → Delete → dialog appears → Cancel dismisses it → Delete removes the budget and the summary card's totals move
- [ ] **On web**: Budgets → a row's trash icon → same dialog, correct category named, deletes that row
- [ ] **On web**: Settings → a category → Delete → dialog appears and deletes
- [ ] **On a device**: all three again, since `Alert.alert` did work on native and these paths have now changed for native too
- [ ] **On a device / web**: each dialog layers **above** its sheet, not behind it (the nested-portal caveat)
- [ ] The row dialog names the right budget when several rows are present

## Note

`progress-tracker.md`'s `UX-3` line previously listed `BudgetsPage`, `BudgetFormModal` and
`CategoryFormModal` as open; it has been updated. What remains: `PendingTransactionEditModal`, `SmartAdd`
and `ReceiptImagePicker`. Those are unreported so far and were left alone, per the workflow rule against
fixing known-issues entries as a side effect of unrelated work — but on current evidence they are all
dead on web too, and the user is testing on web. Worth picking up deliberately rather than waiting for
three more reports.
