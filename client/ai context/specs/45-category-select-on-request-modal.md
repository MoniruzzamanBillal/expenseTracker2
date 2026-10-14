# 45 — Category select field on the transaction-request modal

**Status**: ✅ Completed 2026-10-14 — swapped and verified in a headless browser. This spec's probe also
closed the **sheet-inside-a-sheet** question spec 44 had to leave device-only.
**Scope**: `client/components/main/shared/TransactionRequestEditModal.tsx` only. No server change, no
data-layer change, no new component, no new dependency.

Follow-up to `specs/44-category-select-field.md`, which built the control and deliberately left this
screen on chips.

## Request

> from the request page, when i receive a request of a transaction, then i have to scroll the category .
> fix this like the add transaction page ..

Spec 44 scoped itself to Add Transaction + the edit-transaction modal because that is what was asked for
at the time; Smart Add, this modal and Budgets kept `CategoryPicker`, and 44 recorded the resulting
two-idiom split as a deliberate, temporary consequence. The user has now hit the chip row on this screen
and asked for the same treatment. This closes one of the two.

---

## Goal

Replace the horizontally-scrolling `CategoryPicker` on the bikelog request-review modal with the same
`CategorySelectField` the Add Transaction screen and the edit modal already use, so accepting a request
doesn't mean swiping through categories.

---

## Design

Nothing new is designed here — `specs/44` owns the control's design. This is the swap, plus one tidy-up
it makes possible.

**The modal already hand-rolls the label the component now renders itself.**
`TransactionRequestEditModal.tsx:155` is:

```tsx
<View style={{ marginBottom: spacing.md }}>
  <Text style={[text.captionMd, { color: C?.textSecondary, marginBottom: spacing.xs + 1 }]}>
    Category
  </Text>
  <CategoryPicker value={categoryId} onChange={setCategoryId} />
</View>
```

That `Text` is byte-identical to the label `CategorySelectField` draws from its own `label` prop
(default `"Category"`, same token, same colour, same `spacing.xs + 1`). It must be **removed**, not left
in place, or the screen shows the word "Category" twice.

**`inSheet` is required.** This modal renders inside a `Sheet`, so the trigger field must sit on
`inputBgSheet` — on `inputBg` it would be the same colour as the sheet itself and disappear. Every
`FormField` in this same modal already passes `inSheet` for that reason.

**Keep the wrapping `View`.** `CategorySelectField` carries no outer margin by design (spec 44), so the
surrounding `marginBottom: spacing.md` is what keeps it off the info row below. It stays.

**Placement is unchanged** — still after the three `FormField`s and before the "Saved with today's date"
note. The screen's field order is not part of this request.

---

## Scope

**In:** the one call site above.

**Out:**

- `SmartAdd.tsx:309`, which will then be `CategoryPicker`'s **only** remaining consumer. Not touched —
  the user asked for the request page, and a compact chip row may genuinely suit Smart Add's per-draft
  cards, where several pickers stack in one scroll view. Flag it; don't fold it in.
- `CategoryPicker.tsx` itself, and therefore its loading/empty conflation (the Known Gaps entry opened
  by spec 44). Deleting the component is a separate decision for whenever Smart Add moves.
- The Budgets create form, which uses its own hand-rolled wrapping grid, not `CategoryPicker`.
- Anything else on this modal: the amount/title/description fields, the accept mutation, the
  source-meta row.

---

## Implementation

In `client/components/main/shared/TransactionRequestEditModal.tsx`:

1. Swap the import on line 9: `CategoryPicker` → `CategorySelectField` (same `./` directory).
2. Replace the label + picker block with:

```tsx
<View style={{ marginBottom: spacing.md }}>
  <CategorySelectField value={categoryId} onChange={setCategoryId} inSheet />
</View>
```

3. Check whether `Text`, `text` and `spacing` are still used elsewhere in the file before assuming the
   removed label frees any import — they are used by the rest of the modal, so nothing else should
   change.

---

## Dependencies

None. `CategorySelectField` already exists and ships (spec 44); no package, no native module, so no new
EAS build.

---

## Implementation notes

The swap landed exactly as written; nothing else in the file changed. `Text`, `text` and `spacing` are
all still used by the rest of the modal, so removing the hand-rolled label freed no imports.

### Verified

`npx tsc --noEmit` and `yarn lint` clean, before and after the probe was deleted. `CategoryPicker` now
has exactly **one** real consumer left, `SmartAdd.tsx:309` (the other grep hits are comments).

The probe here was more valuable than a plain swap deserves: because this modal **is** a `Sheet`, a
throwaway route could mount it directly (`open` forced true, the `["categories"]` cache seeded with 8
categories) and finally exercise the nested-sheet case that spec 44 could only test standalone.

| Check | Result |
| --- | --- |
| Request modal renders | "Review expense", the three fields, Accept button |
| The word "Category" | appears **once** — the duplicate label is gone |
| Chip row gone | no category names on the closed modal |
| Tap the field | **the nested sheet opens from inside the request sheet** |
| Outer sheet during | still alive — "Review expense" and Accept still present |
| Search row | present: inputs are `0.00`, `e.g. Fuel: Shell Station`, **`Search categories`** (Description is multiline, so it renders as a `textarea`, which is why a naive input count reads 3, not 4) |
| Pick "Transport" | nested sheet closes, field shows Transport, **outer sheet survives** |
| Accept | `categoryId` travels through: `accepted=["c1"]` |
| Console / page errors | none |

**So Portal-in-Portal stacking is now confirmed on web**, matching the `ConfirmModal`-inside-`Sheet`
precedent the design leaned on. The fallback spec 44 described (rendering the list as a second step
inside the existing sheet) is not needed. Native stacking is still unverified — the same Portal
implementation, but not the same renderer.

### Still unverified

Device/session items only: the real Requests tray flow against live data, the keyboard inside the
nested sheet on iOS/Android, and both themes on a real device.

## Verify when done

- [x] `npx tsc --noEmit` clean.
- [x] `yarn lint` clean.
- [x] `grep -rn "CategoryPicker" components/` shows exactly **one** remaining call site, `SmartAdd.tsx`.
- [x] The word "Category" appears **once** on the modal, not twice — the hand-rolled label is gone.
- [x] `yarn web` bundles and the app boots with no page errors.
- [x] Open the request modal: the category row is a select field, tapping it opens the sheet, picking a
      category updates the field, and Accept still sends that `categoryId` — all four verified on the
      probe (`accepted=["c1"]`). The **live** Requests tray still needs a session.
- [~] The sheet-inside-a-sheet **stacks correctly on web** (verified here, closing spec 44's open
      question); both themes on a real device, and native Portal stacking, still need a session.
- [x] Row in `progress-tracker.md`'s Spec status table.
