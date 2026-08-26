# 03: Pending-Transaction Date Visibility on Home

## Goal

Spec 02 (offline transaction support) merges the entire local pending queue into `HomePage.tsx` unconditionally — that part already works: if you're offline for 2 days and add transactions on both days, all of them do appear on Home once the app is opened again (no date filter exists on `pendingAsTransactions` in `HomePage.tsx`). The actual gap is **visibility, not presence**: the pending `TransactionCard` variant shows only a title, a "Pending sync" label, and the amount — no date — and pending cards are interleaved directly at the top of the same "Transactions :" list that otherwise only ever shows today's real, synced transactions. So a transaction genuinely added 2 days ago looks, visually, identical to something added moments ago today. This spec makes each pending item's real date visible and visually separates the pending group from the "today" list, so age is never implied incorrectly.

## Scope

**In scope:**

- Showing each pending item's actual `createdAt` date on its card.
- Giving the pending items their own labeled section on Home, distinct from the "Transactions :" header (which stays scoped to today's real data).

**Out of scope (explicitly):**

- No change to *which* screen(s) show pending items — Home-only stays as decided in spec 02 (see that spec's "Scope deviation" section for why Monthly/Weekly/History were excluded).
- No change to `transactionQueue.ts`, `usePendingTransactions.ts`, or the sync mechanism (`syncAll`) — this is a display-only fix.
- No date-range filtering of the pending list (e.g. hiding items older than N days) — everything currently queued keeps showing, per spec 02's design.
- No change to `TotalBalanceCard`'s income/expense totals — those remain server-fetched-today-only and are not affected by pending amounts, same as today.

## Design

### 1. Show the pending item's date on its card

`TransactionCard.tsx` already imports `format` from `date-fns` and uses it for the real-transaction card's date line (`format(new Date(transactionData?.createdAt as string), "dd-MMM-yyy")`). The pending branch (added in spec 02) currently renders only:

```
[clock icon] Title
             Pending sync
                                          ±৳amount
```

Add the date using the same `format` import, next to the existing "Pending sync" label:

```
[clock icon] Title
             Pending sync · 23 Aug
                                          ±৳amount
```

Use `format(new Date(transactionData.createdAt as string), "d MMM")` — matches the short day+month style `TransactionAccordion.tsx` already uses for its own day headers (`format(new Date(day?.date as string), "d MMM")`), for visual consistency with the rest of the app rather than inventing a third date format.

### 2. Separate the pending group from today's list

`HomePage.tsx` currently renders pending cards directly under the single "Transactions :" header, with no header of their own — so structurally there's no visual break between "queued, could be from any day" and "today, confirmed." Add a small "Pending Sync" text header (same `Text` styling pattern as "Transactions :", just a smaller/secondary treatment so it doesn't compete with it), rendered only when `pendingAsTransactions.length > 0`, immediately above the pending cards and above the existing "Transactions :" header — so the screen reads as two distinct groups top-to-bottom: pending (any age) first, then today's confirmed data.

## Implementation notes

- Files touched: `client/components/main/shared/TransactionCard.tsx` (date line in the existing pending branch), `client/components/main/Home/HomePage.tsx` (new conditional "Pending Sync" header above the existing pending-cards map).
- No new imports needed in `TransactionCard.tsx` — `format`/`date-fns` is already imported. `HomePage.tsx` needs no new imports either — just another `<Text>` using its existing styling conventions.
- No server-side change, no new dependency, no change to the pending data model.

## Verify when done

- [x] `yarn lint` and `npx tsc --noEmit` both pass clean.
- [x] `npx expo export --platform web` statically renders `/` (and all other routes) without error.
- [ ] Manually queue an item, then (for a quick check without waiting a real day) inspect/edit its `createdAt` in the persisted `AsyncStorage` queue to a date 2 days in the past — confirm the pending card shows that actual date, not today's date, and that it still renders under a distinct "Pending Sync" header separate from "Transactions :". **Not yet manually verified in a running app** (no device/simulator session in this pass).
- [ ] Confirm today's real transactions still render exactly as before under "Transactions :", unaffected by the new header above them. **Not yet manually verified** — unchanged by code inspection (the new header is purely additive, ahead of the untouched real-transactions block), but not exercised live.

## Open questions — resolved for this pass

1. **Header text**: kept as a plain "Pending Sync" label, no count — `PendingSyncBanner` right above it already states the count ("N transactions pending sync"), so repeating it in the section header would be redundant.
2. **Sort order**: not addressed in this pass — pending items still render in whatever order `AsyncStorage`/the queue array returns them (append order, i.e. oldest-first in practice, since `enqueue` appends to the end of the array). No explicit re-sort was added since insertion order already happens to satisfy "oldest first" for the common case; revisit only if that stops being true (e.g. if a future retry-reordering changes it).
