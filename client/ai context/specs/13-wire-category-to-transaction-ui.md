# 13: Wire category to transaction UI (picker, badge, breakdown & filter)

Status: 📝 Drafted — awaiting review before implementation starts. **Depends on `12-category-management-ui.md` (needs categories to pick from) and `server/ai context/specs/09-wire-category-to-transaction.md`.**

## Cross-repo context

Second of three client specs implementing categories + a settings page:
1. `12-category-management-ui.md` — create/edit/delete categories. **Build first** — this doc's picker has nothing to show without it.
2. **This doc** — the category picker on Add/Edit, the badge on `TransactionCard`, and the breakdown-with-filter UI on Monthly/Weekly.
3. `14-settings-profile-page.md` — unrelated to this doc's changes, same overall ask.

Server companion: `server/ai context/specs/09-wire-category-to-transaction.md` (build/deploy first — this UI is tested against its response shape).

Supersedes `15-transaction-categories-superseded.md`'s client-side design — see that file's superseded banner. The key difference from that discarded design: categories now come from `useCategories()` (spec 12's live, user-owned list), not a hardcoded `constants/Category.constant.ts` with 7 fixed values.

## Goal

Let the user tag a transaction with one of *their own* categories when adding/editing it, see that category at a glance in transaction lists, and see a per-category spend breakdown (with tap-to-filter) on the Monthly/Weekly overview.

## Scope

**In scope:**
- A `CategoryPicker` component (chip grid, sourced from `useCategories()`) added to `AddTransactionPage.tsx`, `UpdateTransactionModal.tsx`, and `PendingTransactionEditModal.tsx`. Selection is optional — a transaction with no category is valid (`categoryId: null` / "Uncategorized"), unlike the discarded spec `15`'s design which always defaulted to a fixed `"other"` value.
- A category badge/icon on `TransactionCard.tsx` (both the normal and `pending` render branches), falling back to a generic "Uncategorized" look when `categoryId` is `null`.
- A `CategoryBreakdown` component on `MonthlyTransactionPage.tsx` (monthly + weekly), sourced from the server's `categoryBreakdown` field (spec 09) — tapping a chip filters the visible transaction list to that category, client-side.
- `categoryId` added to the offline queue payload shape (`transactionQueue.ts`).

**Out of scope:**
- `HistoryPage.tsx` (yearly view) — unchanged, same boundary as server spec 09.
- Category input inside `SmartAdd.tsx` — unchanged, defaults to `null`/"Uncategorized" server-side.
- `TransactionRequestEditModal.tsx` (bikelog inbox) — unchanged, same reasoning as server spec 09.
- What happens when the user has zero categories yet: the picker simply renders empty with a small "No categories yet — add one in Settings" hint instead of a chip grid (a `TouchableOpacity` linking to Settings is a nice-to-have, not required for this spec — a plain hint text is enough).

## Design

### 1. Types — `client/types/Transaction.tyes.ts`

Add `categoryId?: string | null` and `category?: TCategory | null` to `TTransaction` (`TCategory` imported from `client/types/Category.types.ts`, spec 12) — the server's `toApiShape` returns the raw `categoryId` scalar on create/update responses, but the summary endpoints' nested `transactions` arrays now come back `include`-d with the related `Category` row (per server spec 09's query change), so the client type needs to account for both shapes being possible on the same field name. Simplest: keep `categoryId` as the source of truth for editing, and treat `category` as an optional denormalized read-convenience field for display (badge/list rendering) that may or may not be present depending on which endpoint returned the transaction.

### 2. `CategoryPicker` — `client/components/main/shared/CategoryPicker.tsx` (new)

```tsx
type TProps = { value: string | null; onChange: (categoryId: string | null) => void };

export default function CategoryPicker({ value, onChange }: TProps) {
  const C = useTheme();
  const { data } = useCategories();
  const categories = data?.data ?? [];

  if (categories.length === 0) {
    return (
      <Text style={[text.caption, { color: C.textMuted, marginBottom: spacing.base }]}>
        No categories yet — add one from Settings.
      </Text>
    );
  }

  return (
    <View style={styles.grid}>
      {categories.map((cat) => {
        const active = value === cat._id;
        return (
          <TouchableOpacity
            key={cat._id}
            onPress={() => onChange(active ? null : cat._id)}
            style={[styles.chip, { borderColor: active ? C.accent : C.border, backgroundColor: active ? C.accentDim : "transparent" }]}
          >
            {cat.icon ? <MaterialCommunityIcons name={cat.icon as any} size={14} color={active ? C.accent : C.textSecondary} /> : null}
            <Text style={[text.caption, { color: active ? C.accent : C.textSecondary }]}>{cat.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
```

Tapping the already-active chip clears the selection (`onChange(null)`) — since category is optional, there needs to be a way back to "no category" without a separate "Clear" button.

### 3. Wire into the three add/edit forms

Same integration points as the discarded spec `15`, now storing `categoryId: string | null` instead of a `TCategory` enum value:
- **`AddTransactionPage.tsx`**: `const [categoryId, setCategoryId] = useState<string | null>(null)`. Render `<CategoryPicker value={categoryId} onChange={setCategoryId} />` after `<TypeToggle .../>`. Include `categoryId` in both the manual-add payload and the offline-enqueue payload (the same shared `payload` object both paths already build). Reset to `null` alongside the other field resets on success. **Category stays optional at the form level too, confirmed by user instruction (2026-09-14)**: the existing `PrimaryButton`'s `disabled={!title || !amount}` condition (`AddTransactionPage.tsx`) is left exactly as-is — `categoryId` is deliberately *not* added to it, so a transaction saves fine with no category picked, the same way it already does with no description.
- **`UpdateTransactionModal.tsx`**: `categoryId` state initialized from `initialValue?.categoryId ?? null`, synced in the existing `useEffect`, included in the PATCH payload.
- **`PendingTransactionEditModal.tsx`**: same pattern, written through `updatePendingTransaction` (local queue) instead of a PATCH request.

### 4. Offline queue — `client/utils/transactionQueue.ts`

Add `categoryId?: string | null` to `TPendingTransactionPayload`. One caveat worth flagging (not solving here): a category picked while offline, then deleted from the server before the queue syncs, would fail server spec 09's ownership check on sync (`categoryId` no longer resolves to an owned, non-deleted category) — same class of edge case as any offline-then-server-state-changed conflict, not new to this feature, and not handled specially here (the existing queue's `status: "failed"` + retry/edit flow already covers "this item failed to sync, user can edit and retry").

### 5. Category badge — `client/components/main/shared/TransactionCard.tsx`

Add a small icon + label (from `transactionData.category?.icon`/`.name`, falling back to a generic "tag-outline" icon and "Uncategorized" label when `category` is absent/null) next to the existing description/time caption line, in both the `pending` and normal branches — same slot/styling as the discarded spec `15`'s design (prefixed onto the existing caption text, not a new row).

### 6. Category breakdown + filter — `CategoryBreakdown` component (new, `client/components/main/shared/CategoryBreakdown.tsx`)

```ts
type TBreakdownEntry = { categoryId: string | null; name: string; icon: string | null; income: number; expense: number };
type TProps = {
  data: TBreakdownEntry[];
  selected: string | null; // categoryId, or the literal string "uncategorized", or null = no filter
  onSelect: (key: string | null) => void;
};
```

Horizontal scrollable row of chips, sorted by `expense` descending, each showing icon + name + `৳{fmt(expense)}` — this is a direct port of the discarded spec `15`'s `CategoryBreakdown` design, just keyed by the dynamic `categoryId ?? "uncategorized"` instead of a fixed enum value. Tapping toggles the filter (tap again to clear).

### 7. Wire into `MonthlyTransactionPage.tsx`

- New state: `const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null)`, reset to `null` on `view`/`selectedMonth` change (same reasoning as the discarded spec `15`: a stale filter silently hiding data after navigating is worse than always resetting).
- Render `<CategoryBreakdown data={...categoryBreakdown} selected={selectedCategoryKey} onSelect={setSelectedCategoryKey} />` after `SummaryPills`.
- Filter `monthlyBuckets`/`weeklyBuckets` via `useMemo`: when a filter is active, map each day's `transactions` to only those where `(t.categoryId ?? "uncategorized") === selectedCategoryKey`. Purely client-side over already-fetched data.
- `TransactionAccordion.tsx` needs no prop changes — filtering happens one level up, same as the discarded spec `15`'s design.

## Implementation notes

Files touched/added:
- `client/types/Transaction.tyes.ts` (edit — add `categoryId`/`category` fields)
- `client/components/main/shared/CategoryPicker.tsx` (new)
- `client/components/main/shared/CategoryBreakdown.tsx` (new)
- `client/components/main/AddTransaction/AddTransactionPage.tsx` (edit — picker + payload field)
- `client/components/main/shared/UpdateTransactionModal.tsx` (edit — picker + payload field)
- `client/components/main/shared/PendingTransactionEditModal.tsx` (edit — picker + payload field)
- `client/components/main/shared/TransactionCard.tsx` (edit — category badge, both branches)
- `client/components/main/MonthlyTransaction/MonthlyTransaction.tsx` (edit — breakdown component + client-side filter)
- `client/utils/transactionQueue.ts` (edit — add `categoryId` to payload type)

## Verify when done

- [ ] `yarn lint` / `npx tsc --noEmit` pass clean.
- [ ] With at least 2 categories created (via spec 12's UI), adding a transaction and picking one persists and displays correctly on the card.
- [ ] Adding a transaction with **no** category selected persists with `categoryId: null` and displays as "Uncategorized" — confirms category is genuinely optional, unlike the discarded spec `15`'s always-defaulted design.
- [ ] With zero categories, the Add Transaction picker shows the "add one in Settings" hint, not a broken/empty grid, and the transaction can still be saved.
- [ ] Editing an existing transaction's category (including clearing it back to Uncategorized by tapping the active chip again) persists.
- [ ] An offline-queued transaction with a category, once synced, shows the correct category.
- [ ] Monthly and Weekly views each show a `CategoryBreakdown` matching the server's totals for that period, including an "Uncategorized" bucket when applicable.
- [ ] Tapping a category chip filters the accordion to that category; tapping again clears the filter.
- [ ] Switching month/week or toggling monthly↔weekly clears any active category filter.
- [ ] Deleting a category (via spec 12) that some past transactions still reference: those transactions keep showing the category's name/icon (server spec 09's soft-delete design), and the picker on *new* transactions no longer offers it.
- [ ] History (yearly) screen is visibly unchanged.
