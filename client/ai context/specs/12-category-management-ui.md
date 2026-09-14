# 12: Category management UI (create / edit / delete)

Status: 📝 Drafted — awaiting review before implementation starts. **Depends on `server/ai context/specs/08-category-management.md` being implemented first.**

## Cross-repo context

First of three client specs implementing categories + a settings page:
1. **This doc** — the category list + create/edit/delete UI, consuming server spec `08`.
2. `13-wire-category-to-transaction-ui.md` — picker/badge/breakdown UI on the transaction screens, sourced from the categories this doc manages. **Depends on this doc** (there's nothing to pick from otherwise) **and on server spec `09`.**
3. `14-settings-profile-page.md` — the new Settings screen that hosts this doc's UI as a section, plus profile editing. **This doc's component is designed to be embedded there, not to be its own top-level tab.**

Supersedes `15-transaction-categories-superseded.md`'s client-side design — see that file's superseded banner.

Source: user's follow-up on `feature-plan-proposals.md` §1 — "at first I want to create category then I will wire the category to the transaction... from there user can create - update category."

## Goal

Let the user see their own categories, create new ones (name + icon), rename/re-icon existing ones, and delete ones they no longer want — before any transaction ever references one.

## Scope

**In scope:**
- `client/constants/CategoryIcon.constant.ts` — a small curated list of `MaterialCommunityIcons` names the user can pick from when creating/editing a category (e.g. `food`, `receipt`, `bus`, `cart`, `heart-pulse`, `movie-open`, `home`, `school`, `briefcase`, `gift`, `shape` as a generic fallback). This is a client-only decorative list, not shared with the server (per server spec `08`'s design note: the server just stores whatever string is sent).
- New hook `client/hooks/useCategories.ts` wrapping `useFetchData`/`usePost`/`usePatch` against `/categories`, mirroring `useTransactionRequests.ts`'s pattern from spec 11 (the bikelog one).
- New component `client/components/main/Settings/CategoryManager.tsx` — list of the user's categories + inline create/edit modal, designed to be embedded inside the new Settings page (`14`), not a standalone route.
- Empty state when the user has zero categories yet ("No categories yet — add one to start tagging transactions").

**Out of scope:**
- Where this component is mounted/navigated to — that's `14-settings-profile-page.md`'s job. This spec builds `CategoryManager` as a self-contained component that spec 14 drops into a screen.
- The transaction-side picker/badge/breakdown — `13-wire-category-to-transaction-ui.md`.
- Reordering categories, colors, or any field beyond name/icon — matches server spec 08's scope.

## Design

### 1. Icon list — `client/constants/CategoryIcon.constant.ts` (new)

```ts
export const CATEGORY_ICON_OPTIONS: React.ComponentProps<typeof MaterialCommunityIcons>["name"][] = [
  "food", "receipt", "bus", "cart", "heart-pulse", "movie-open",
  "home", "school", "briefcase", "gift", "paw", "airplane", "shape",
];
```

A plain array, not an enum with labels — icons are self-explanatory in a visual grid, no text label needed per option.

### 2. Types — `client/types/Category.types.ts` (new)

```ts
export type TCategory = {
  _id: string;
  name: string;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
};
```

Deliberately a **new, separate file** from `Transaction.tyes.ts` — `Category` isn't a variant of `Transaction`, and per `known-issues.md#TYPE-3`'s lesson (a typo'd filename that's now load-bearing), this new file gets its name spelled correctly from the start.

### 3. Hook — `client/hooks/useCategories.ts` (new)

```ts
export const useCategories = () =>
  useFetchData<TCategory[]>(["categories"], "/categories");

export const useCreateCategory = () => usePost([["categories"]]);
export const useUpdateCategory = () => usePatch([["categories"]]);
export const useDeleteCategory = () => usePatch([["categories"]]);
```

`useDeleteCategory` reuses `usePatch` (not a real hook of its own) because the server endpoint is `PATCH /categories/:id/delete` (soft delete), same convention `TransactionCard.tsx`'s delete flow already follows against `/transactions/delete-transaction/:id`.

### 4. `CategoryManager.tsx` — `client/components/main/Settings/CategoryManager.tsx` (new)

- `useCategories()` for the list; render each as a row (icon + name + a pencil/trash icon pair on the right — same visual language as `TransactionRequests`' row actions from client spec 11, not `TransactionCard`'s swipe gesture, since this is a short settings list, not a scrollable ledger).
- Delete: `Alert.alert("Delete category?", ...)` confirm (same pattern used throughout the app), then `PATCH /categories/:id/delete`. **Note the pre-existing `UX-3` known issue** (`Alert.alert` no-ops on web) applies here too, same as it already does elsewhere — not fixed as part of this spec, flagged in progress-tracker like spec 11's client counterpart did.
- "+ Add Category" button opens `CategoryFormModal` (below) with no `initialValue` (create mode).
- Tapping a row's pencil opens the same modal with `initialValue` set (edit mode).
- Empty state via the existing `EmptyState` component: `<EmptyState title="No categories yet" subtitle="Add one to start tagging your transactions" />`.

### 5. `CategoryFormModal.tsx` — `client/components/main/Settings/CategoryFormModal.tsx` (new)

Structurally the same `Portal`/`Modal`/`FormField` shape as `UpdateTransactionModal.tsx`, but simpler (two fields, no amount/type):

```tsx
type TProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  initialValue?: TCategory; // present = edit mode, absent = create mode
};
```

- `FormField label="Name" value={name} onChangeText={setName} placeholder="e.g. Food" />`.
- An icon grid below it (same chip-grid visual pattern that `13`'s `CategoryPicker` will use for *selecting* a category on a transaction — but here it's for *choosing* an icon while defining one): map `CATEGORY_ICON_OPTIONS`, each a bordered square, active one highlighted with `C.accent`.
- Submit: create mode → `POST /categories` with `{ name, icon }`; edit mode → `PATCH /categories/:id` with the changed fields. On the server's `409` (duplicate name, from spec 08's unique constraint), show a `Toast` with the server's message rather than a generic "something went wrong" — this is a real, expected user-facing case (typo'd a duplicate name), not an unexpected failure.
- `PrimaryButton` label: `"Add Category"` / `"Save Changes"` depending on mode.

### 6. Reused chip styling

`CategoryFormModal`'s icon-picker grid and `13`'s transaction-side `CategoryPicker` both render a horizontal wrapping grid of bordered, icon-bearing chips — factor the shared visual bit (the individual chip's style object, not a whole component, since one picks an *icon* and the other picks a *category*) into `client/components/main/shared/iconChipStyles.ts` if the two end up byte-for-byte identical during implementation; otherwise duplicate the ~10-line style object rather than forcing a shared component onto two conceptually different pickers. Call this during implementation, not a hard requirement here.

## Implementation notes

Files touched/added:
- `client/constants/CategoryIcon.constant.ts` (new)
- `client/types/Category.types.ts` (new)
- `client/hooks/useCategories.ts` (new)
- `client/components/main/Settings/CategoryManager.tsx` (new)
- `client/components/main/Settings/CategoryFormModal.tsx` (new)

## Verify when done

- [ ] `yarn lint` / `npx tsc --noEmit` pass clean.
- [ ] With zero categories, `CategoryManager` shows the empty state, not a blank list.
- [ ] Creating a category with a name + icon shows it in the list immediately (query invalidation working).
- [ ] Creating a category with a name that already exists shows the server's `409` message via Toast, not a generic error.
- [ ] Editing a category's name and/or icon persists and reflects immediately in the list.
- [ ] Deleting a category (confirm dialog accepted) removes it from the list; a re-`GET /categories` confirms it's gone from the active list (soft-deleted server-side, per spec 08).
- [ ] Verified via headless-browser click-through against a local server running spec 08's endpoints (same harness used for client spec 11), since this doc has no native-only interactions.
