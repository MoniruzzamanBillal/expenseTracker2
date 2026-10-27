# 21 — Transaction occurredAt (user-editable date)

**Status**: ✅ Implemented and verified against the Neon dev DB 2026-10-26 (`yarn dev` + curl, throwaway user and its 4 transactions / 3 requests deleted afterwards). **Not deployed** — run `yarn db:migrate` against prod first, then `yarn build` + a Vercel deploy from `server/` (a `git push` ships nothing — `vercel.json` serves the gitignored `dist/server.js`).
**Scope**: `server/` only — one Prisma migration (nullable add → backfill → NOT NULL), and small changes to `transaction.{validation,interface,service}.ts` and `transactionRequest.{validation,interface,service}.ts`.
**Companion**: `client/ai context/specs/48-manual-transaction-date.md` (the date picker UI). This half defines the contract the client is tested against — build/deploy it first.

---

## Request

> when i add any transaction or request any transaction, i can't give the transaction date manually — the system
> keeps the current date. If I forget and add it 2–3 days late, it's tracked on the wrong day. Same for transaction
> requests. I should have a date input (default today, no future dates) on add, on update, and when accepting a request.

## Problem

`Transaction` had no date field — every read path (daily/monthly/weekly/yearly/trend) filtered and grouped by
`createdAt`, so a transaction was always dated to the moment it was entered. Worse, `TransactionRequest` already
carried `occurredAt` (the real date, set by bikelog), but `acceptTransactionRequest` called `addNewTransaction`
**without passing it**, so an accepted expense was silently dated `now()`.

## Goal

A dedicated, user-editable `occurredAt` on `Transaction`, defaulting to now at create time. `createdAt` stays the
true row-insertion audit timestamp. Every read path groups/filters by `occurredAt`. Accepting a request files the
transaction under the request's `occurredAt` (overridable).

---

## Design

### Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | **New `occurredAt DateTime` column** on `Transaction`, required, no default | Keeps `createdAt` as a true audit timestamp instead of overloading it. Chosen over reusing `createdAt` per direct user decision. |
| D2 | Migration adds the column **nullable**, backfills `occurredAt = createdAt`, then sets NOT NULL | 1993 existing rows — a straight required-add is impossible. `createdAt` is the value the app was already treating as the date, so it's the correct backfill. |
| D3 | New `@@index([userId, occurredAt])` | The new query key for every range read; the old `@@index([userId])` stays for other paths. |
| D4 | `occurredAt` optional on the create/update Zod schemas, defaults to now in the service when omitted | Backward-compatible: an older client / the offline sync that omits it still works. |
| D5 | Server rejects `occurredAt > now + 24h` | Defense-in-depth backstop; the **frontend** date picker is the precise no-future guard (the 24h tolerance absorbs timezone/clock skew so a legitimate "today, local noon" is never a false positive). |
| D6 | `acceptTransactionRequest` passes `edits.occurredAt ?? request.occurredAt` to `addNewTransaction` | Fixes the dropped-date bug and lets the reviewer override the date. `acceptTransactionRequestSchema` gains the same future-guarded optional `occurredAt`. |

### Contract (additive)

```
POST  /api/transactions/new-transaction      body may include  occurredAt: ISO-8601 string (≤ now+24h)
PATCH /api/transactions/update-transaction/:id   same optional field
PATCH /api/transaction-requests/:id/accept       same optional field; falls back to the request's occurredAt
```
All transaction responses now carry both `occurredAt` and `createdAt` (`toApiShape` spreads the row).

---

## Implementation notes

- `prisma/schema.prisma`: `occurredAt DateTime` + `@@index([userId, occurredAt])`.
- Migration `20261026043450_add_transaction_occurred_at` was created with `--create-only` and hand-edited to the
  three-statement nullable→backfill→NOT NULL form before applying.
- `transaction.service.ts`: `addNewTransaction` / `addManyTransaction` write `payload.occurredAt ? new Date(...) : new Date()`;
  `updateTransaction` normalizes an incoming `occurredAt` string to a `Date` before the update; all five read functions
  and `buildCategoryDetail` switched `createdAt → occurredAt` (where ranges, `orderBy`, and the in-JS grouping reads).

## Verify when done

- [x] `npx tsc --noEmit` clean; `yarn lint` matches the documented baseline (3 errors + 4 warnings, none new).
- [x] Migration applies and backfills the 1993 existing rows (`occurredAt = createdAt`).
- [x] POST with a past `occurredAt` → 201, stored verbatim, `createdAt` is now; appears under the correct day in `monthly-transaction`.
- [x] POST with a future `occurredAt` → 400 "Transaction date cannot be in the future".
- [x] POST without `occurredAt` → 201, defaults to now.
- [x] Accept a request with a past `occurredAt`: created transaction inherits it (no override), or uses the override; future override → 400.
- [ ] Deployed to prod (`yarn db:migrate` → `yarn build` → Vercel deploy).
