# 16: Budgets screen (progress bars, red when over limit)

Status: 📝 Drafted — awaiting review before implementation starts. **Depends on `12-category-management-ui.md` (categories to budget), `13-wire-category-to-transaction-ui.md` (transactions must carry `categoryId` for spend to compute), `14-settings-profile-page.md` (hosts this screen's entry point), and `server/ai context/specs/12-budgets.md`.**

## Cross-repo context

Client side of a 2-spec feature:

- `server/ai context/specs/12-budgets.md` — the `Budget` model, CRUD endpoints, and the spend-vs-limit computation this screen consumes. **Build/deploy that spec first.**
- **This doc** — the dedicated Budgets screen: one progress bar per budgeted category, red when over limit, reached via a button on Settings.

Source: user's follow-up on `feature-plan-proposals.md` §2 ("Per-category budgets with alerts"), with two explicit constraints: **never block overspending** (the progress bar can go red, but nothing ever stops a save), and **no push notifications**.

Entry-point decision (asked directly, 2026-09-14): a button on the Settings page (spec 14), not a new 6th tab and not a link from Monthly/Weekly — keeps the tab bar at its current 5 tabs, and groups this with the other category-management concepts Settings already hosts.

## Goal

Give the user one screen showing, per category with a budget set, how much they've spent this month against the limit — a plain progress bar that turns red past 100%, purely informational.

## Scope

**In scope:**

- A new hidden route, `app/(tabs)/budgets.tsx` (`href: null`, same technique as Smart Add/Requests — reached only via the button below, not shown in the tab bar).
- A "Budgets" button on `SettingsPage.tsx` (spec 14), next to or below the existing Categories section, navigating to `/budgets`. If spec 14 hasn't been implemented yet when this is built, add the button as part of that implementation; if it already has, this is a small follow-up edit to that file.
- `BudgetsPage.tsx`: one row per budget — category icon + name, a progress bar, `spent` vs `monthlyLimit` text, and a pencil/trash action pair (same visual language as `CategoryManager.tsx`'s rows from spec 12).
- **Progress bar coloring**: under/at limit → the app's existing "income" green (`C.income`); over limit → the app's existing "expense" red (`C.expense`) — reusing tokens already used throughout the app for exactly this good/bad semantic, not inventing a new color. Bar _fill width_ is capped at 100% even when spend is, say, 150% of the limit (the track can't overflow its own container) — the color change and the numeric "over by ৳X" text are what communicate the overage, not an overflowing bar.
- Create: a "+ Set Budget" button opening `BudgetFormModal` with a category picker (only categories that don't already have a budget) + a limit input.
- Edit: tapping a row's pencil opens the same modal with the category locked (read-only — category is immutable once a budget exists, per server spec 12) and only the limit editable.
- Delete: tapping a row's trash icon confirms (`Alert.alert`, same pre-existing `UX-3` web caveat as everywhere else in the app) then calls `DELETE /budgets/:id` — the app's **first real use of `useDeleteData`/`apiDelete`** (`hooks/useApi.ts`), which until now had zero call sites (`known-issues.md#FETCH-2`); noted as a side effect of this spec's design, not a deliberate fix of that entry.
- Empty states: zero budgets yet ("No budgets yet — set a limit for a category to track it here"); zero categories at all (a different hint pointing at Settings' Categories section first, since there's nothing to budget).

**Explicitly, permanently out of scope:**

- **Any blocking or warning on the transaction side.** `AddTransactionPage.tsx`, `UpdateTransactionModal.tsx`, and `PendingTransactionEditModal.tsx` (all touched by spec 13) are **not touched again by this spec** — no "you're about to exceed your budget" dialog, no disabled state, nothing. A transaction that blows past a limit saves exactly as it would with no budget at all; the only place that shows is this screen, after the fact.
- Any notification/badge (tab bar dot, push, in-app banner) when a budget goes over — the progress bar's color is the entire feedback mechanism, checked only when the user opens this screen.
- Charts/trends over time for budget history — this screen shows the current month only, matching the server's month-scoped `GET /budgets`.

## Design

### 1. Types — `client/types/Budget.types.ts` (new)

```ts
export type TBudget = {
  _id: string;
  categoryId: string;
  category: { name: string; icon?: string };
  monthlyLimit: number;
  spent: number;
  percentage: number;
  isOverLimit: boolean;
};
```

### 2. Hook — `client/hooks/useBudgets.ts` (new)

```ts
export const useBudgets = () =>
  useFetchData<TBudget[]>(["budgets"], "/budgets");
export const useCreateBudget = () => usePost([["budgets"]]);
export const useUpdateBudget = () => usePatch([["budgets"]]);
export const useDeleteBudget = () => useDeleteData([["budgets"]]);
```

`useDeleteData` (not `usePatch` against a `.../delete` path) — matches server spec 12's real `DELETE /budgets/:id`, unlike every other "delete" flow in this app.

### 3. `BudgetProgressBar` — `client/components/main/Budgets/BudgetProgressBar.tsx` (new)

```tsx
type TProps = {
  spent: number;
  limit: number;
  percentage: number;
  isOverLimit: boolean;
};

export default function BudgetProgressBar({
  spent,
  limit,
  percentage,
  isOverLimit,
}: TProps) {
  const C = useTheme();
  const barColor = isOverLimit ? C.expense : C.income;
  const width = Math.min(percentage, 100);

  return (
    <View>
      <View style={[styles.track, { backgroundColor: C.divider }]}>
        <View
          style={[
            styles.fill,
            { width: `${width}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <View style={styles.labelRow}>
        <Text style={[text.caption, { color: C.textSecondary }]}>
          ৳{fmt(spent)} of ৳{fmt(limit)}
        </Text>
        {isOverLimit ? (
          <Text
            style={[
              text.caption,
              { color: C.expense, fontFamily: fontFamily.medium },
            ]}
          >
            ৳{fmt(spent - limit)} over
          </Text>
        ) : (
          <Text style={[text.caption, { color: C.textMuted }]}>
            {Math.round(percentage)}%
          </Text>
        )}
      </View>
    </View>
  );
}
// styles.track: { height: 6, borderRadius: 3, overflow: "hidden" } — same idiom as HistoryPage.tsx's barTrack/barFill
// styles.fill: { height: "100%", borderRadius: 3 }
// styles.labelRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 }
```

### 4. `BudgetsPage.tsx` — `client/components/main/Budgets/BudgetsPage.tsx` (new)

- `useBudgets()` for the list; `useCategories()` (spec 12) for the "categories without a budget yet" set used by the create modal (`categories.filter(c => !budgets.some(b => b.categoryId === c._id))`).
- Each row: category icon + name, `BudgetProgressBar`, pencil (edit) + trash (delete, with confirm) icon pair — visually mirrors `CategoryManager.tsx`'s row layout from spec 12.
- "+ Set Budget" button, disabled with a hint ("All your categories already have a budget") when the unbudgeted-category list is empty rather than opening a picker with nothing in it.
- Empty states via the existing `EmptyState` component: zero budgets → "No budgets yet"; zero categories at all → a variant pointing back at Settings' Categories section.

### 5. `BudgetFormModal.tsx` — `client/components/main/Budgets/BudgetFormModal.tsx` (new)

Same `Portal`/`Modal`/`FormField` shape as `CategoryFormModal.tsx` (spec 12):

```tsx
type TProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  initialValue?: TBudget; // present = edit mode (category locked), absent = create mode (category picker shown)
  availableCategories: TCategory[]; // only relevant in create mode
};
```

- Create mode: a category picker (reuse `CategoryPicker`'s chip-grid visual from spec 13, but sourced from `availableCategories` instead of the full list) + a numeric `FormField` for the limit (same `decimal-pad` keyboard + regex pattern already used for `amount` in `AddTransactionPage.tsx`).
- Edit mode: category shown read-only (icon + name, no picker), only the limit `FormField` editable.
- Submit: create → `POST /budgets` with `{ categoryId, monthlyLimit: parseFloat(limit) }`; edit → `PATCH /budgets/:id` with `{ monthlyLimit }`. On the server's `409` (category already budgeted — shouldn't normally happen since create mode's picker already excludes budgeted categories, but a second device/tab could race), show the server's message via `Toast` rather than a generic error.

### 6. Route + entry point

- `client/app/(tabs)/budgets.tsx` (new, hidden):
  ```tsx
  import BudgetsPage from "@/components/main/Budgets/BudgetsPage";
  export default function BudgetsScreen() {
    return <BudgetsPage />;
  }
  ```
- `client/app/(tabs)/_layout.tsx` — add `<Tabs.Screen name="budgets" options={{ href: null }} />` alongside the existing `smart-add`/`transaction-requests` hidden entries.
- `client/components/main/Settings/SettingsPage.tsx` (spec 14) — add a "Budgets" button/row (same bordered-row visual as the existing Logout entry, or a nav-style row with a chevron) that does `router.push("/budgets")`, placed after the Categories section.

## Implementation notes

Files touched/added:

- `client/types/Budget.types.ts` (new)
- `client/hooks/useBudgets.ts` (new)
- `client/components/main/Budgets/BudgetProgressBar.tsx` (new)
- `client/components/main/Budgets/BudgetsPage.tsx` (new)
- `client/components/main/Budgets/BudgetFormModal.tsx` (new)
- `client/app/(tabs)/budgets.tsx` (new)
- `client/app/(tabs)/_layout.tsx` (edit — register hidden `budgets` route)
- `client/components/main/Settings/SettingsPage.tsx` (edit — add "Budgets" entry point)

## Verify when done

- [ ] `yarn lint` / `npx tsc --noEmit` pass clean (new route needs the same one-time Expo Router type regeneration noted in client spec 11's verify notes).
- [ ] Tapping "Budgets" on Settings navigates to the new screen.
- [ ] With zero budgets, the empty state shows; with zero categories, the "create a category first" variant shows instead.
- [ ] Setting a budget for a category shows it immediately with a correct `spent`/`limit`/percentage.
- [ ] **Adding transactions in that category past the limit is never blocked or warned against at the point of saving** — confirmed by actually doing it (add transactions until over budget, saving succeeds every time with no dialog) — then reopening Budgets shows the bar in red with an "over by ৳X" label.
- [ ] The progress bar's fill never visually overflows its track even when spend is well past 100% of the limit.
- [ ] Editing a budget's limit updates the bar/percentage immediately; the category itself is not editable from the edit modal.
- [ ] Deleting a budget (confirm accepted) removes it from the list, and a category can immediately have a new budget set for it afterward (confirms the server's hard-delete design actually works end-to-end from the UI).
- [ ] The "+ Set Budget" category picker never offers a category that already has a budget; if every category is already budgeted, the button shows the "all categories already have a budget" state instead of an empty picker.
- [ ] Deleting a category (via spec 12) that has a budget removes it from this screen without needing a manual budget delete first (server spec 12's soft-delete-hides-budget behavior).
- [ ] `AddTransactionPage.tsx`/`UpdateTransactionModal.tsx`/`PendingTransactionEditModal.tsx` are confirmed unchanged by this spec (diff review) — no budget-awareness leaked into the transaction forms.
