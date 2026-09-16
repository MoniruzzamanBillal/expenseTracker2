# 24: Type drift fixes (G4, G5, G6)

> Ported from the reference implementation in `../../../Expense tracker app redesign/uploads/client`. Verified against `server/prisma/schema.prisma`: `Transaction.receiptFileOriginalName`, `Transaction.receiptFileResourceType`, and `Transaction.isDeleted` already exist server-side; this closes the corresponding `known-issues.md#TYPE-2` gaps on the client type.

## Goal
Close three small TYPE-2 gaps between server and client types, and surface two pieces of already-fetched data that are currently unused.

## Changes

### G4 — receipt file metadata fields
- `types/Transaction.tyes.ts`: add `receiptFileOriginalName?: string | null` and `receiptFileResourceType?: string | null` to `TTransaction`.
- `components/main/shared/ReceiptViewerModal.tsx`: add optional `fileName?: string | null` prop; display as a bottom-of-screen text overlay when present.
- `components/main/shared/TransactionCard.tsx`: pass `transactionData.receiptFileOriginalName` as `fileName` to `ReceiptViewerModal`.

### G5 — History `transactionCount`
- `components/main/HistoryPage/HistoryPage.tsx`: render `m.transactionCount` as a small caption alongside the month row (e.g. "12 tx") for both the current-month expanded row and the compact rows.

### G6 — `isDeleted` type field
- `types/Transaction.tyes.ts`: add `isDeleted?: boolean` to `TTransaction`. Additive only — no behaviour change, just closes the server-client type gap (the server already filters `isDeleted: false` everywhere it queries).

## Verify when done
- [x] Receipt viewer shows filename overlay when `receiptFileOriginalName` is present
- [x] History month rows show transaction count
- [x] `npx tsc --noEmit` clean (no new type errors)
- [x] `yarn lint` clean
