# 48 — Manual transaction date (date picker)

**Status**: 🔨 Code written 2026-10-26 — `tsc` and `expo lint` clean; the server half (`server/ai context/specs/21`) was verified end-to-end against the dev DB. **Not yet exercised in a running app** and no device pass — the native picker is a native-UI surface the web fallback doesn't exercise.
**Needs a new EAS build**: `@react-native-community/datetimepicker` is a native module (added as an `app.json` config plugin). Expo Go bundles it so dev works immediately, but the shipped APK must be rebuilt — same situation as `expo-secure-store` in spec 39.
**Scope**: `client/` only — one new dependency, a new shared `DateField` (native + `.web` split), a new `utils/occurredAt.ts`, and wiring into the add/update/accept screens plus the per-transaction date display sites.
**Companion**: `server/ai context/specs/21-transaction-occurred-at.md` — defines the `occurredAt` contract. Must be deployed for this to work against prod.

---

## Request

> when i add any transaction or request any transaction, i can't give the transaction date manually… I should have a
> date input field (default current date, can pick any past date, the frontend should prevent selecting future
> dates). I should see the date input in update transaction also.

## Goal

A date field — default today, future dates non-selectable — on Add Transaction, the Edit entry modal, and the
accept-request review modal. Display the chosen date (`occurredAt`) wherever a transaction's date is shown.

---

## Design

### Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | `@react-native-community/datetimepicker` (chosen by the user) | Standard native picker, bundled in Expo Go, so no EAS build needed. |
| D2 | Shared `DateField` component, **platform-split**: `DateField.tsx` (native, uses the lib) + `DateField.web.tsx` (HTML `<input type="date" max={today}>`) | The lib's web support is weak and the web target is the headless-verification surface (CLAUDE.md). Metro resolves `.web.tsx` on web / `.tsx` on native, so the native module never enters the web bundle. Future dates blocked by `maximumDate` (native) / `max` (web). |
| D3 | `utils/occurredAt.ts` → `toOccurredAtISO(date)` pins a **past** date to **local noon**, "today" to **now** | The server groups by UTC calendar date while the device displays local; local noon keeps the picked day identical in both for every realistic timezone (noon ± offset stays inside the same UTC day). "Today" uses the real time so a new entry sorts naturally. `parseOccurredAt(occurredAt, createdAt)` gives the picker its initial value with a createdAt fallback. |
| D4 | Every per-transaction date display reads `occurredAt ?? createdAt` | Fallback keeps older cached rows and offline-queued entries rendering correctly. |
| D5 | `occurredAt` added to the offline queue payload (`transactionQueue.ts`) | A queued entry may sync days later; the chosen date must survive, not be re-stamped at sync time. |

---

## Implementation notes

- New files: `components/main/shared/DateField.tsx`, `DateField.web.tsx`, `utils/occurredAt.ts`.
- `AddTransactionPage.tsx`: `date` state (default `new Date()`), `DateField` after the category field, `occurredAt`
  in `basePayload` (so both the online POST and the offline queue carry it), reset on save.
- `UpdateTransactionModal.tsx`: `date` initialized from `occurredAt ?? createdAt`, `DateField` in the body,
  `occurredAt` in the PATCH payload, and the hardcoded "Today · HH:mm" header replaced with the actual date.
- `TransactionRequestEditModal.tsx`: `date` from the request's `occurredAt`, `DateField`, `occurredAt` added to the
  `onAccept` shape, and the "Saved with today's date" note rewritten. `TransactionRequestsPage.tsx` threads
  `occurredAt` through `acceptRequest` into the accept payload.
- Display: `TransactionCard.tsx` (time + date), `HomePage.tsx` (offline-entry mapping), `TrendTab.tsx` (category
  detail sort + day label) all use `occurredAt ?? createdAt`; `TCategoryDetailTransaction.createdAt` renamed to
  `occurredAt` to match the server. `ErrorLogs/*` and the queue's own enqueue `createdAt` left untouched.

## Verify when done

- [x] `npx tsc --noEmit` and `expo lint` clean.
- [ ] Add an entry with a back-dated date → shows on the chosen day and in the right month (headless web + device).
- [ ] Future dates are non-selectable in the picker (native `maximumDate`, web `max`).
- [ ] Edit an entry's date and save.
- [ ] Accept a request → the created transaction carries the request's date (or the overridden one).
- [ ] Offline save keeps its chosen date after sync.
- [ ] Device pass in Expo Go (native picker, iOS inline "Done" path).
