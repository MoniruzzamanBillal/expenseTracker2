# 22: Smart Add — category picker on draft cards

> Ported from the reference implementation in `../../../Expense tracker app redesign/uploads/client`. Verified against the live server: `POST /transactions/many-transaction` (`transaction.service.ts`, `createManyTransactions`) already reads `categoryId` per item and calls `assertCategoryOwnership` on each — it's accepted today, just never sent by this client.

## Goal
Allow users to assign a category to each parsed draft transaction before saving, matching the behaviour of the manual Add Transaction form (spec 13).

## Scope
**In**: add `CategoryPicker` to each draft card in `SmartAdd.tsx`; include `categoryId` in the online `many-transaction` save payload.
**Out**: offline-queue path (per spec 13's explicit scope decision, the offline queue carries no `categoryId`); no change to `manage-money`, `many-transaction`, or any hook.

## Implementation
- `components/main/smartAdd/SmartAdd.tsx`:
  - `TDraftTransaction = TTransaction` already carries `categoryId?: string | null` — no type change needed.
  - Import `CategoryPicker` from `@/components/main/shared/CategoryPicker`.
  - Inside each draft card, add `<CategoryPicker value={draft.categoryId ?? null} onChange={(v) => updateDraft(i, "categoryId", v)} />` below the TypeToggle row. `updateDraft`'s `value` param widened to `string | number | null` to accept the picker's `null` (no category).
  - In `handleSaveAll`'s online path, add `categoryId: d.categoryId ?? null` to the per-draft payload passed to `many-transaction`.
  - Offline-queue path: intentionally left unchanged (no `categoryId`), same as Add Transaction's offline branch.

## Verify when done
- [x] CategoryPicker renders in each draft card and persists changes through `updateDraft`
- [x] `many-transaction` payload includes `categoryId` (null when unset)
- [x] Offline-queue path still has no `categoryId`
- [x] `yarn lint` / `npx tsc --noEmit` clean
