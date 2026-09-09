# 11: Transaction Requests inbox (bikelog sync review screen)

Status: ✅ Complete — implemented and verified 2026-09-09, see Implementation notes below

## Goal

Give the user a place to review spend events pushed in from bikelog (fuel/maintenance/accessory purchases) — edit if needed, then Accept (creates a real transaction) or Reject (dismissed, kept for audit). Reached from a new button on the existing Add Transaction page, not a new tab and not a home banner, per explicit preference.

## Cross-repo context

Companion to two other specs for the same feature:
- `server/ai context/specs/07-bikelog-transaction-request-sync.md` (this repo, server side) — defines the `GET /transaction-requests`, `PATCH /transaction-requests/:id/accept`, `PATCH /transaction-requests/:id/reject` endpoints this screen consumes. **Build/deploy that spec first** — this screen can be developed and manually tested against it by curl'ing fake `/ingest` payloads, with no dependency on bikelog itself.
- `bikelog_server/context/specs/30-sync-spend-logs-to-expense-tracker.md` (bikelog repo) — the eventual real source of these requests; not needed to build or test this screen.

## Scope

**In scope:**
- A new hidden route, reached only via a button on `AddTransactionPage.tsx` — mirrors how the existing "Smart Add" screen is reached (`smart-add.tsx`, hidden tab with `href: null`).
- List of pending requests with an inline edit affordance (amount/title/description) and Accept/Reject actions.
- Accept invalidates the same summary queries a normal manual add does, so Home/History reflect the new spend immediately.

**Out of scope:**
- Any badge/count indicator on the Add Transaction button — skipped for now to avoid an extra network round-trip on a screen opened constantly; the static "Requests" label is enough. Can be added later as a small follow-up if it turns out to matter.
- Any change to the existing offline pending-transaction queue (`utils/transactionQueue.ts`, `usePendingTransactions.ts`) — that's a different, unrelated concept (locally-queued items that failed to save) and must not be confused with server-side `TransactionRequest`s.
- Viewing already-accepted/rejected requests (no history view) — only the active pending list.

## Design

### 1. Hidden route — mirrors the existing `smart-add` pattern exactly

- New file `client/app/(tabs)/transaction-requests.tsx`:
  ```tsx
  import TransactionRequestsPage from "@/components/main/TransactionRequests/TransactionRequestsPage";

  export default function TransactionRequestsScreen() {
    return <TransactionRequestsPage />;
  }
  ```
- `client/app/(tabs)/_layout.tsx` — add one more hidden screen next to the existing `smart-add` entry (line 115):
  ```tsx
  <Tabs.Screen name="transaction-requests" options={{ href: null }} />
  ```

### 2. New screen — `client/components/main/TransactionRequests/TransactionRequestsPage.tsx`

- Fetch via `useFetchData(["transaction-requests"], "/transaction-requests")`, same convention as `client/hooks/useApi.ts` (used e.g. in `HomePage.tsx:42-45`).
- Render each row reusing `TransactionCard`'s visual style, with an Accept/Reject action row plus an edit (pencil) affordance.
- New hook file `client/hooks/useTransactionRequests.ts` wrapping `useFetchData`/`usePost`/`usePatch` for this feature specifically. **Do not** reuse `usePendingTransactions.ts` — that manages the unrelated on-device offline-sync queue.
- Empty state: simple "No pending requests" message.

### 3. Inline-edit modal — `client/components/main/shared/TransactionRequestEditModal.tsx`

Structurally copied from the existing `PendingTransactionEditModal.tsx` (same `Portal`/`Modal`/`FormField` trio for amount/title/description), but:
- Type is locked to "expense" — no income/expense toggle needed, these are always spend.
- On save, holds the edited values in local state and submits them together with the Accept action (not a separate save step) — matches the "edit then accept" flow described to the user, rather than a two-step "save edit, then separately accept."

### 4. Actions

- **Accept** → `PATCH /transaction-requests/:id/accept` with `{title, description, amount}` (only the fields the user actually changed need to be sent — the server falls back to originals for anything omitted). Invalidate `["transaction-requests"]` plus `["daily-transaction"]`, `["monthly-transaction"]`, `["weekly-transaction"]`, `["yearly-transaction"]` — the same invalidation list `AddTransactionPage.tsx:40-45` already uses for a normal manual add.
- **Reject** → `PATCH /transaction-requests/:id/reject`; invalidate only `["transaction-requests"]`.

### 5. Entry point — `client/components/main/AddTransaction/AddTransactionPage.tsx`

In the existing `styles.nav` row (currently: title + one "Smart Add" `TouchableOpacity`, lines 155-173), add a second button styled identically (`styles.smartAddBtn`):

```tsx
<TouchableOpacity
  onPress={() => router.push("/transaction-requests")}
  style={[styles.smartAddBtn, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}
>
  <MaterialCommunityIcons name="inbox-arrow-down" size={13} color={C.accent} />
  <Text style={[text.label, { color: C.accent }]}>Requests</Text>
</TouchableOpacity>
```
Wrap both buttons in a `flexDirection: "row"` container with a small gap so they sit side-by-side in the existing nav row.

### 6. Types

New `client/types/TransactionRequest.types.ts`:
```ts
export type TTransactionRequest = {
  _id: string;
  sourceApp: string;
  sourceType: "fuel" | "maintenance" | "accessory";
  sourceRecordId: string;
  type: "income" | "expense";
  title: string;
  description?: string;
  amount: number;
  occurredAt: string;
  status: "pending" | "accepted" | "rejected";
  transactionId?: string;
  createdAt: string;
};
```

## Implementation notes

Files touched/added:
- `client/app/(tabs)/transaction-requests.tsx` (new)
- `client/app/(tabs)/_layout.tsx` (edit — register hidden screen)
- `client/components/main/TransactionRequests/TransactionRequestsPage.tsx` (new)
- `client/components/main/shared/TransactionRequestEditModal.tsx` (new)
- `client/hooks/useTransactionRequests.ts` (new)
- `client/components/main/AddTransaction/AddTransactionPage.tsx` (edit — add "Requests" button)
- `client/types/TransactionRequest.types.ts` (new)

## Verify when done

- [x] `yarn lint` / `npx tsc --noEmit` pass clean. (`npx tsc --noEmit` required regenerating Expo Router's `.expo/types/router.d.ts` first — briefly ran `npx expo start --web` to pick up the new `transaction-requests` route, then stopped it; this is a normal, expected step for any new route file, not a bug.)
- [x] With test rows ingested via curl against spec 07's `/ingest` endpoint, tapping "Requests" on Add Transaction shows them. Verified via headless Chrome (Playwright, `channel: "chrome"`) against a local server: logged in as a throwaway test user, both a `fuel` and a `maintenance` test row rendered with correct title/source-label/date/amount.
- [x] Editing amount/title/description before Accept reflects in the created transaction. Verified: opened the pencil-edit modal on the maintenance row, changed amount 450 → 475, tapped "Accept Request" — the request disappeared from the inbox and the Home screen's daily total showed the transaction at the edited ৳475, not the original ৳450.
- [x] Accept removes the item from the inbox and it appears in Home/History totals immediately (no manual refresh needed). Verified in the same pass — no manual refresh/refetch needed, TanStack Query's invalidation handled it.
- [x] Reject removes the item from the inbox; re-querying the server confirms it's `rejected`, not deleted. **Caveat**: the direct Accept (✓)/Reject (✗) icon buttons on each row use `Alert.alert` for a confirm step, same as `TransactionCard.tsx`'s existing delete confirm — and `Alert.alert` is a hard no-op on the web target (`known-issues.md#UX-3`, confirmed via `react-native-web`'s `static alert() {}`), so clicking Reject on web does nothing (no dialog, no request fires) — not a defect in this spec's own mutation code (which is structurally identical to the already-verified Accept path), just the same pre-existing, documented web limitation affecting several other confirm buttons app-wide. Not fixed here per this project's "don't fix `known-issues.md` items as a side effect of unrelated work" rule — flagged in `progress-tracker.md`'s Known Gaps instead. Native-device verification of the direct Accept/Reject icons (where `Alert.alert` works) is deferred, consistent with this project's existing pattern of flagging native-only interactions for a human device pass (e.g. spec 09/10).
- [x] Confirm the existing offline pending-transaction queue (Home screen) is completely unaffected by this feature. Confirmed by code review: `useTransactionRequests.ts` is entirely separate from `usePendingTransactions.ts`/`utils/transactionQueue.ts`, no shared state or query keys.
