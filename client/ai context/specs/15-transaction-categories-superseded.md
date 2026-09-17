# [Superseded] Transaction categories (originally drafted as spec 12)

Status: ⛔ Superseded 2026-09-14 — before any implementation started, user redirected: categories must be user-created/editable, not a fixed hardcoded constant as designed below. Also folded into a broader ask for a Settings/profile page. Replaced by:
- `12-category-management-ui.md` (create/edit/delete categories, part of the new Settings page)
- `13-wire-category-to-transaction-ui.md` (the picker/badge/breakdown UI this doc originally tried to do in one step, now sourced from the user's own categories instead of a hardcoded list)
- `14-settings-profile-page.md` (the new page that houses category management + profile editing)

Renumbered 2026-09-14 out of the live 12-14 sequence (which it originally occupied as `12-transaction-categories.md`) so the three specs above could run 12→13→14 in the order the user actually wants to build them. Kept below, under this filename, as a historical record of the discarded design — do not implement from this doc.

## Cross-repo context

Companion to the server-side spec for the same feature:
- `server/ai context/specs/11-transaction-categories-superseded.md` — expenseTracker2 server: the `category` field + `categoryBreakdown` addition to the daily/monthly/weekly summary endpoints this screen consumes (also since renumbered out of that repo's live sequence, for the same reason). **Build/deploy that spec first** — this UI can be developed and manually tested against it via curl'd/local responses.
- This doc — expenseTracker2 mobile client: the category picker on Add/Edit, the badge on `TransactionCard`, and the breakdown-with-filter UI on Monthly/Weekly.

Source proposal: `feature-plan-proposals.md` §1 ("Transaction categories") — this spec is that proposal promoted for actual implementation, per `00-build-plan.md`'s convention.

## Goal

Let the user tag a transaction with a category when adding/editing it, see that category at a glance in transaction lists, and see a per-category spend breakdown (with tap-to-filter) on the Monthly/Weekly overview — turning flat totals into "where did the money go."

## Scope

**In scope:**
- New `constants/Category.constant.ts` — single source of truth for the 7 category values + their label/icon, learning from `known-issues.md#TYPE-1` (don't repeat the three-copies-of-an-enum mistake this app already made once).
- A new `CategoryPicker` component (chip grid, styled after the existing `TypeToggle`) added to `AddTransactionPage.tsx`, `UpdateTransactionModal.tsx`, and `PendingTransactionEditModal.tsx`.
- A small category badge/icon on `TransactionCard.tsx` (both the normal and `pending` render branches).
- A `CategoryBreakdown` component on `MonthlyTransactionPage.tsx` (both monthly and weekly views), sourced from the server's new `categoryBreakdown` field — tapping a category chip filters the visible transaction list to that category (client-side only, no new request).
- `category` added to the offline queue payload shape (`transactionQueue.ts`) so a category picked while offline survives into the eventual sync.

**Out of scope:**
- `HistoryPage.tsx` (the yearly month-bar view) — unchanged, matching the discarded server spec's scope boundary (`server/ai context/specs/11-transaction-categories-superseded.md`, no per-month `categoryBreakdown` from `yearly-transaction` yet). Natural to revisit alongside the trimmed proposal's Charts item (§4, the category donut) later.
- Any category input inside `SmartAdd.tsx` (AI-parsed transactions) — those keep defaulting to `other` server-side. Not silently expanded into this spec.
- `TransactionRequestEditModal.tsx` (bikelog inbox) — those requests are always `expense` with no category concept from the source app; left as `other` on accept, same as the server-side scope note.
- Any new tab/screen — this is additive UI on three existing screens/modals, no navigation changes.

## Design

### 1. Single source of truth — `client/constants/Category.constant.ts` (new)

```ts
export const CategoryConst = {
  food: "food",
  bills: "bills",
  transport: "transport",
  shopping: "shopping",
  health: "health",
  entertainment: "entertainment",
  other: "other",
} as const;

export type TCategory = keyof typeof CategoryConst;

export const CATEGORY_META: Record<
  TCategory,
  { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"] }
> = {
  food: { label: "Food", icon: "food" },
  bills: { label: "Bills", icon: "receipt" },
  transport: { label: "Transport", icon: "bus" },
  shopping: { label: "Shopping", icon: "cart" },
  health: { label: "Health", icon: "heart-pulse" },
  entertainment: { label: "Entertainment", icon: "movie-open" },
  other: { label: "Other", icon: "shape" },
};
```

**Values must exactly match the discarded server spec's `TransactionCategory` Prisma enum** (`server/ai context/specs/11-transaction-categories-superseded.md`). There's no shared/generated types package between client and server (same pre-existing gap noted in `known-issues.md#TYPE-2`/`TYPE-3`) — keeping these two lists in sync is a manual, load-bearing step whenever a category is ever added/renamed.

### 2. Types — `client/types/Transaction.tyes.ts`

Add `category?: TCategory` to `TTransaction`. Optional at the type level (mirrors the server default), but always present in real responses once spec 08 ships.

### 3. `CategoryPicker` — `client/components/main/shared/CategoryPicker.tsx` (new)

A wrapping chip grid (7 options don't fit a two-way `TypeToggle`-style fixed track), each chip an icon + label from `CATEGORY_META`, active chip colored with `C.accent`/`C.accentDim`/`C.accentBorder` (there's no per-category color system, and inventing one is out of scope — accent color for "selected", `C.surface2`/`C.border` for idle, same palette `TypeToggle` already uses for its idle state):

```tsx
type TProps = { value: TCategory; onChange: (v: TCategory) => void };

export default function CategoryPicker({ value, onChange }: TProps) {
  const C = useTheme();
  return (
    <View style={styles.grid}>
      {(Object.keys(CATEGORY_META) as TCategory[]).map((cat) => {
        const active = value === cat;
        const meta = CATEGORY_META[cat];
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onChange(cat)}
            style={[
              styles.chip,
              {
                borderColor: active ? C.accent : C.border,
                backgroundColor: active ? C.accentDim : "transparent",
              },
            ]}
          >
            <MaterialCommunityIcons name={meta.icon} size={14} color={active ? C.accent : C.textSecondary} />
            <Text style={[text.caption, { color: active ? C.accent : C.textSecondary }]}>{meta.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
// styles.grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }
// styles.chip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 }
```

### 4. Wire into the three add/edit forms

- **`AddTransactionPage.tsx`**: `const [category, setCategory] = useState<TCategory>(CategoryConst.other)`. Render `<CategoryPicker value={category} onChange={setCategory} />` right after `<TypeToggle .../>`. Include `category` in the manual-add payload (line ~84-89) and in the offline-enqueue payload (line ~116) — both paths build the same `payload` object today, so this is a one-line addition to that shared object, not two separate edits. Reset `category` to `other` alongside the other field resets on success (lines ~98-101, ~118-121).
- **`UpdateTransactionModal.tsx`**: same pattern — `category` state initialized from `initialValue?.category ?? CategoryConst.other`, synced in the existing `useEffect` (line 67-74), included in the PATCH payload (line ~101-106), picker rendered next to `TypeToggle`.
- **`PendingTransactionEditModal.tsx`**: same pattern, but writes through `updatePendingTransaction` (local queue update) instead of a PATCH request — `category` flows into the same payload object passed there (line ~96-101).

### 5. Offline queue — `client/utils/transactionQueue.ts`

Add `category?: TCategory` to `TPendingTransactionPayload`. No other change needed — `enqueue`/`updatePayload` already pass the whole payload object through untyped-opaquely; this is purely a type-shape addition so a category picked offline round-trips correctly when the queue eventually syncs.

### 6. Category badge — `client/components/main/shared/TransactionCard.tsx`

Add a small icon (from `CATEGORY_META[transactionData.category ?? "other"]`) next to the existing title/description text block, in both the `pending` branch (~line 116-135) and the normal branch (~line 321-346) — same visual slot, reusing the existing `text.caption`/`C.textSecondary` styling already used for the description/time line, e.g. prefixing it: `🏷 Food · 2:30 PM` rendered as an icon + the existing caption text, not a new row (keeps row height unchanged for `compact` mode in the accordion).

### 7. Category breakdown + filter — `CategoryBreakdown` component (new, `client/components/main/shared/CategoryBreakdown.tsx`)

```ts
type TBreakdownEntry = { category: TCategory; income: number; expense: number };
type TProps = {
  data: TBreakdownEntry[];
  selected: TCategory | null;
  onSelect: (cat: TCategory | null) => void;
};
```

Renders a horizontal scrollable row of chips (same visual language as `CategoryPicker`, reusing its chip style rather than duplicating it — factor the chip into a small shared sub-piece if the styling diverges, but default to literal reuse first), sorted by `expense` descending, each chip showing icon + label + `৳{fmt(expense)}`, **skipping entries where both `income` and `expense` are 0** (no point showing 5 empty categories every month). Tapping a chip toggles `selected` (tap again to clear → show all).

### 8. Wire into `MonthlyTransactionPage.tsx`

- New state: `const [selectedCategory, setSelectedCategory] = useState<TCategory | null>(null)`, reset to `null` whenever `view` or `selectedMonth` changes (a stale filter silently hiding data after navigating is worse than always resetting).
- Render `<CategoryBreakdown data={monthlyTransaction?.data?.categoryBreakdown ?? []} selected={selectedCategory} onSelect={setSelectedCategory} />` (and the weekly equivalent using `weeklyTransaction?.data?.categoryBreakdown`) right after `SummaryPills`, before the loading/accordion branch.
- Filter what reaches `TransactionAccordion`: when `selectedCategory` is set, map `monthlyBuckets`/`weeklyBuckets` to the same `TDailyData[]` shape but with each day's `transactions` array filtered to `t.category === selectedCategory` (days with zero matching transactions still render, just empty — simplest correct behavior, matches how the accordion already tolerates empty day buckets per spec 07 client-side... actually per **server** spec's fixed accordion-crash bug, `client/ai context/specs/07-fix-accordion-crash-on-empty-day-bucket.md`). This filtering is purely a `useMemo` over already-fetched data — no new request.
- `TransactionAccordion.tsx` itself needs no prop changes — it already just renders whatever `dailyData` it's given; the filtering happens one level up in `MonthlyTransactionPage.tsx` before the data reaches it.

## Implementation notes

Files touched/added:
- `client/constants/Category.constant.ts` (new)
- `client/types/Transaction.tyes.ts` (edit — add `category` field)
- `client/components/main/shared/CategoryPicker.tsx` (new)
- `client/components/main/shared/CategoryBreakdown.tsx` (new)
- `client/components/main/AddTransaction/AddTransactionPage.tsx` (edit — picker + payload field)
- `client/components/main/shared/UpdateTransactionModal.tsx` (edit — picker + payload field)
- `client/components/main/shared/PendingTransactionEditModal.tsx` (edit — picker + payload field)
- `client/components/main/shared/TransactionCard.tsx` (edit — category badge, both branches)
- `client/components/main/MonthlyTransaction/MonthlyTransaction.tsx` (edit — breakdown component + client-side filter)
- `client/utils/transactionQueue.ts` (edit — add `category` to payload type)

## Verify when done

- [ ] `yarn lint` / `npx tsc --noEmit` pass clean.
- [ ] Adding a transaction with each of the 7 categories selected persists and round-trips (visible on the card with the right icon/label after a refetch).
- [ ] Leaving category unset on Add defaults visibly to "Other" (picker shows Other pre-selected, matching the server default).
- [ ] Editing an existing transaction's category via `UpdateTransactionModal` persists the change.
- [ ] An offline-queued (airplane mode) transaction with a non-default category, once synced, shows the correct category — not silently dropped to `other`.
- [ ] Editing a pending (not-yet-synced) transaction's category via `PendingTransactionEditModal` updates the locally queued payload.
- [ ] Monthly and Weekly views each show a `CategoryBreakdown` row matching the server's `categoryBreakdown` totals for that period.
- [ ] Tapping a category chip filters the accordion to only that category's transactions across all visible days; tapping it again clears the filter.
- [ ] Switching month/week or toggling monthly↔weekly clears any active category filter (no stale filter silently hiding data on the new period).
- [ ] History (yearly) screen is visibly unchanged — confirms the scope boundary held.
