# 44 — Category select field (searchable sheet) on Add Transaction + edit modal

**Status**: ✅ Completed 2026-10-14 — all 5 steps implemented and driven in a headless browser against a
throwaway probe route. Device-only items (keyboard, sheet-in-sheet, a real save) remain open.
**Scope**: `client/components/main/shared/CategorySelectField.tsx` (rewritten in place),
`client/components/main/AddTransaction/AddTransactionPage.tsx`,
`client/components/main/shared/UpdateTransactionModal.tsx`. No server change, no data-layer change,
**no new dependency**.

## Request

> in add transaction page, for selecting the category i have to scroll the category .. now if instead of
> scrolling horizontally, if i add select input field will it be convenient to the user ?? i want
> category select with modern design.

Answered: **yes** — a horizontal chip row hides most options off-screen, costs a swipe each, and can't be
searched. The cost is one extra tap to open, which is why the shape below matters.

Two decisions were taken by the user up front and are **not open**:

1. **Control shape** — a field showing the current pick which, on tap, opens a **bottom sheet** with a
   **search box** and a vertical list; tapping a row selects and closes.
2. **Scope** — Add Transaction **and** the edit-transaction modal only. Smart Add draft cards, the
   bikelog request modal and the Budgets create form keep their current chip UI.

---

## Goal

Replace the horizontally-scrolling category chip row on Add Transaction and in the edit-transaction
modal with a select field that opens a searchable bottom sheet, so every category is reachable without
swiping and a long list stays usable.

---

## Diagnosis — most of this already exists

`components/main/shared/CategoryPicker.tsx` (55 lines) is the live control: a `ScrollView horizontal` of
34pt pills whose own docblock says it "bleeds off the right edge", props `{ value, onChange }`,
self-fetching `useFetchData<TCategory[]>(["categories"], "/categories")`, a leading "None" chip. Four
call sites: `AddTransactionPage.tsx:356`, `SmartAdd.tsx:309`, `UpdateTransactionModal.tsx:189`,
`TransactionRequestEditModal.tsx:156`.

`components/main/shared/CategorySelectField.tsx` (106 lines) **already implements roughly 70% of what
was asked for, and has zero call sites.** It renders a 48pt field (`spacing.field`, `radius.card`,
`C.inputBg`, `C.border`) with a 28×28 `accentDim` icon tile, the category name or a `"Select category"`
placeholder in `C.placeholder`, a trailing `Ionicons chevron-down`, and a paper `Portal`+`Modal`
containing a `FlatList` whose `ListHeaderComponent` is the "None" row. Its props are a **superset** of
`CategoryPicker`'s, so it is drop-in at every existing call site.

Git history explains the orphan: `753334a` ("select-style category field on Add Transaction") added it
and wired it in; `630363c` (Nocturne redesign phase 4a) rewrote Add Transaction back to `CategoryPicker`
and left it dead. `specs/27`'s phase-2 list names "CategoryPicker/CategorySelectField" together — this
reads as incidental to a screen rewrite, not a considered rejection of the pattern.

What it lacks: a **search box**, a close affordance, **bottom-sheet** anchoring (it is a _centered_ modal,
`marginHorizontal: spacing.xl`, `maxHeight: "70%"`), any **loading/error** state, and `inSheet` support.
It is also written in very long unwrapped lines, unlike the rest of the codebase.

Three further facts that shape the design:

- **Categories carry no `type`.** `TCategory` is `{ _id, name, icon?, createdAt?, updatedAt? }` and the
  Prisma model matches, so the list must **not** be filtered by the Income/Expense toggle.
- **Order is creation order** (`orderBy: { createdAt: "asc" }` server-side), and there is **no seeding** —
  a new user has zero categories until they add them in Settings.
- **`CategoryPicker` conflates loading with empty**: its `categories.length === 0` early return shows
  "No categories yet — add one from Settings." _while the first fetch is still in flight_.

---

## Scope

**In:** the rewrite of `CategorySelectField`, and the two call-site swaps.

**Out:**

- `CategoryPicker.tsx` itself — still used by `SmartAdd.tsx:309` and
  `TransactionRequestEditModal.tsx:156`. Its loading/empty conflation is **flagged, not fixed**, per
  `ai-workflow-rules.md`'s rule against fixing adjacent issues as a side effect.
- `BudgetFormModal`'s hand-rolled wrapping chip grid, and `CategoryBreakdown` (a read _filter_, not a
  picker).
- Any new dependency. No `@gorhom/bottom-sheet`, no picker library.
- Category on the offline-queued path — still deliberately never sent (spec 13's scope).

**Known consequence, accepted:** until a follow-up spec, two category-picking idioms coexist — a select
field on Add/Edit, chips on Smart Add and the request modal. That was the user's scope choice.

---

## Design

Visual rules from `theme/` only: `useTheme()` for every colour, `text.*`, `spacing.*`, `radius.*`. No hex
literals, no new tokens.

### Approach: rewrite `CategorySelectField.tsx` in place

Not a new component. It is dead code, so there is no call-site risk; its trigger field and row treatment
are already correct; and adding a third category control would leave two orphans instead of one.

### API

```ts
type TProps = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  label?: string; // default "Category"
  inSheet?: boolean; // trigger field uses inputBgSheet
};
```

`inSheet` mirrors `FormField`'s prop of the same name and meaning (`FormField.tsx:13,27`): inside a
`Sheet` — whose background is `C.surface` — a field on `C.inputBg` is invisible, because in both schemes
`inputBg === surface`. The edit modal passes it; Add Transaction does not.

### Trigger field

Keep as-is: `height: spacing.field` (48), `radius.card`, `borderColor: C.border`, the 28×28 `accentDim`
icon tile holding the category's `MaterialCommunityIcons` glyph (`?? "shape"` fallback, as
`CategoryManager.tsx:51` and `BudgetFormModal` do), the name in `text.body`, `"Select category"` in
`C.placeholder` when unset, trailing `Ionicons chevron-down` (16, `C.textMuted`). Label above in
`text.captionMd` / `C.textSecondary`, `marginBottom: spacing.xs + 1` — the established field-label idiom.

**Remove `wrap`'s `marginBottom: spacing.lg`.** Add Transaction's content container applies a uniform
`gap: spacing.md` and the edit modal already wraps the call site in `marginTop: spacing.lg`; the
component's own margin would double-space both.

### The sheet

`<Sheet visible={open} onDismiss={() => setOpen(false)} maxHeightPct={80}>` — the shared primitive
(`components/main/shared/Sheet.tsx`) supplies bottom anchoring, `radius.sheet` top corners, the 36×4
grabber and `paddingBottom: spacing.lg + insets.bottom`. `80` rather than the default `88` leaves room
for the keyboard; it is the first caller to override that prop.

Contents, in order:

1. **Header row** — `text.h3` "Select category" (h3 is the sheet-title token) plus a close button:
   `Ionicons close` size 20, `C.textMuted`, `hitSlop={8}`, matching `ReceiptViewerModal`'s header button.
2. **Search row** — rendered only when `categories.length >= SEARCH_MIN` (**8**). A search box over three
   items is noise; the threshold is one constant if it should move.

   Hand-rolled — **not** Paper's `Searchbar` (`code-standards.md:19` forbids Paper beyond
   `Portal`/`Modal`) and **not** `FormField` (no leading-icon slot, and per the load-bearing comment at
   `AddTransactionPage.tsx:331-334` its root has no `flex`, so it collapses inside a row). Copy that same
   title-row pattern: a bordered row on `C.inputBgSheet` with a leading `Ionicons search-outline`
   (17, `C.textMuted`) and a bare `TextInput` carrying `outlineWidth: 0` (kills react-native-web's focus
   ring), `underlineColorAndroid="transparent"`, `placeholderTextColor={C.placeholder}`,
   `autoCapitalize="none"`, `autoCorrect={false}`, `returnKeyType="search"`, placeholder
   "Search categories". **This is the app's first search input** — there is no existing one to copy.

   Filter in a `useMemo`: case-insensitive `name.toLowerCase().includes(q.trim().toLowerCase())`.

3. **List** — `FlatList`, `keyExtractor={(c) => c._id}`,
   **`keyboardShouldPersistTaps="handled"`** (without it the first tap only dismisses the keyboard),
   `ItemSeparatorComponent` a 1px `C.divider`.

   Row: `minHeight: spacing.field`, the 28×28 `accentDim` icon tile, name in `text.body`, and when
   selected the row fills `accentDim`, its label goes `C.accentText`, and an `Ionicons checkmark`
   (18, `C.accentText`) sits at the right. This drops the old per-row _border_ — a list row is not a
   chip — while keeping the app's accent/accentDim/accentText active language.

4. **"No category" footer** — `ListFooterComponent`, preceded by a divider: MCI `shape-outline`, label
   "No category", sends `null`. Pinned at the bottom (not a `ListHeaderComponent` as today) and **never
   filtered by the search**, because it is an action rather than a list entry. This matches the layout
   the user picked.

Every glyph was verified present in the installed glyphmaps: Ionicons `search-outline`, `close`,
`chevron-down`, `checkmark`; MCI `shape`, `shape-outline`. (Spec 31's precedent: confirm before using.)

Icon split honoured — Ionicons for all chrome, MCI only for a category's own stored `icon`.

### Four states, not two

Destructure `isPending` / `isError` / `error` / `refetch` from the existing
`useFetchData<TCategory[]>(["categories"], "/categories")` call — same query key, so the list stays
shared and cached with every other consumer.

| State                  | Inside the sheet                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| loading                | a centred `ActivityIndicator`, `color={C.accent}`                                                                                                             |
| error                  | `ErrorState` with `title="Couldn't load categories"`, `message={(error as Error)?.message}` (it requires a `message`, shown verbatim) and `onRetry={refetch}` |
| no categories at all   | `EmptyState title="No categories yet"`, `icon="pricetags-outline"`, subtitle pointing at Settings — the same usage as `CategoryManager.tsx:40`                |
| search matches nothing | one `text.caption` / `C.textMuted` line, "No category matches …"                                                                                              |

The trigger field shows its plain placeholder in all four cases, so the screen stops claiming
"No categories yet" during an ordinary load — the one `CategoryPicker` bug this change closes by
replacement rather than by editing that file.

### Keyboard

The genuinely risky part: paper's `Modal` does no keyboard avoidance, and the sheet is bottom-anchored,
so on iOS the keyboard would cover it. `react-native-keyboard-controller` — already a dependency
(1.18.5) and the library every screen here uses — **exports `KeyboardAvoidingView`**, confirmed in
`node_modules/react-native-keyboard-controller/lib/typescript/index.d.ts`. Wrap the sheet's content in it
with `behavior="padding"`.

A `FlatList` must not be nested inside a `KeyboardAwareScrollView` (VirtualizedList nesting), which is
why this is the right tool rather than the repo's usual `KeyboardAwareScrollView` pattern. Android should
additionally resize on its own (`newArchEnabled: true`, Expo's default soft-input resize).

### Nesting the sheet inside the edit modal's sheet

Proven pattern here: `ConfirmModal` is rendered **inside** a `Sheet` in three places
(`UpdateTransactionModal.tsx:235`, `CategoryFormModal.tsx:115`, `BudgetFormModal.tsx:157`), so
Portal-in-Portal stacking works. The two sheets hold independent `visible` state, so dismissing the
inner one cannot close the outer.

**Fallback if it misbehaves on device:** render the list as a second _step_ inside the existing sheet —
swap the sheet's content and add a back chevron — instead of nesting.

---

## Implementation

1. **`components/main/shared/CategorySelectField.tsx`** — the whole change: `Sheet` in place of its own
   centered `Modal`; header + close; conditional search row; `FlatList` with dividers, checkmarks and
   `keyboardShouldPersistTaps="handled"`; pinned "No category" footer; the four states; the new `inSheet`
   prop; `wrap`'s margin removed; wrapped to the file widths used elsewhere in the codebase.
2. **`components/main/AddTransaction/AddTransactionPage.tsx:356`** — replace
   `<CategoryPicker value={categoryId} onChange={setCategoryId} />` with
   `<CategorySelectField value={categoryId} onChange={setCategoryId} />`; drop the now-unused import
   (line 1). The parent `gap: spacing.md` handles spacing. Nothing about submit changes — `categoryId`
   is still spread in conditionally (`...(categoryId ? { categoryId } : {})`, lines 204-209) because the
   server's `createTransactionSchema` rejects an explicit `null`.
3. **`components/main/shared/UpdateTransactionModal.tsx:189`** — same swap plus `inSheet`, keeping the
   surrounding `<View style={{ marginTop: spacing.lg }}>`.
4. **Leave `CategoryPicker.tsx` untouched**, and note in `progress-tracker.md` that its loading/empty
   conflation is still open for its two remaining call sites.
5. Spec row in `progress-tracker.md`, marked in progress at the start and completed at the end.

---

## Dependencies

**None to install.** Everything is already present:

- `react-native-paper` 5.14.5 — only via the shared `Sheet` (`Portal` + `Modal`).
- `react-native-keyboard-controller` 1.18.5 — `KeyboardAvoidingView`.
- `@expo/vector-icons` 15.0.3 — Ionicons chrome + MCI category glyphs.
- `@tanstack/react-query` via `hooks/useApi.ts`'s `useFetchData`.
- Shared components `Sheet`, `EmptyState`, `ErrorState`; `theme/`'s tokens.

No native module is added, so **no new EAS build** — this reloads over Expo Go and over the existing
APK's JS bundle.

---

## Implementation notes

All five steps landed as specified; no deviation, nothing outside the three files.

- **Step 1** — `CategorySelectField.tsx` rewritten: shared `Sheet` (`maxHeightPct={80}`, the first caller
  to override that prop) in place of its own centered modal, header + close, conditional search row,
  `FlatList` with dividers and checkmarks, pinned "No category" footer, the four states, the new
  `inSheet` prop, `wrap`'s margin dropped, and the whole file rewrapped to the codebase's line width.
- **Step 2** — `AddTransactionPage.tsx` swapped and its `CategoryPicker` import dropped.
- **Step 3** — `UpdateTransactionModal.tsx` swapped with `inSheet`, surrounding `marginTop` kept.
- **Step 4** — `CategoryPicker.tsx` untouched; its loading/empty conflation is now a Known Gaps entry
  naming the two call sites where it is still live.
- **Step 5** — tracker row.

Two implementation details worth recording because they are not obvious from the spec text:

- **`LIST_MAX_H = 360`.** Capping only the sheet is not enough — a `FlatList` in an unbounded parent
  sizes to its content, so the rows would be clipped by the sheet rather than scrolling inside it. The
  list needs a bounded height of its own (~7 rows).
- **The icon tile steps to `C.surface` on a selected row.** The tile is `surface2` normally, but
  `surface2` on an `accentDim` row is nearly invisible in light mode (`#e4e7f5` on `#e7e5fe`).

### Verified

`npx tsc --noEmit` and `yarn lint` clean, before and after the probe was deleted. The web target bundles
and boots with no page errors.

Behaviour was driven with Playwright against a throwaway top-level route (`app/zz-cat-probe.tsx`, outside
`(tabs)` so `AuthGuard` does not apply) that seeded the `["categories"]` query cache — the same
isolated-probe technique spec 42 used. Deleted afterwards.

| Check | Result |
| --- | --- |
| Trigger field closed | shows the selected category's name + icon tile + chevron |
| Tap to open | sheet opens with header, search row, rows, pinned "No category" |
| Search `"tra"` | Transport + Travel shown, Food gone, "No category" still present |
| Search `"zzz"` | "No category matches …" line, "No category" still present |
| Search `"o"` (dark) | Food, Transport, Groceries, Books, Coffee |
| Pick a row | sheet closes, `value` → that id, field shows the name |
| Reopen | the query was reset — all rows back |
| "No category" | `value` → `null`, field back to its placeholder |
| Close ✕ | dismisses |
| Backdrop tap | dismisses |
| 10 categories | exactly one search input, `placeholder="Search categories"` |
| 3 categories | **zero** search inputs — `SEARCH_MIN` holds |
| Light + dark | both render correctly (screenshots taken in each) |
| Console / page errors | none throughout |

**Two false alarms, chased and dismissed** — recorded so nobody re-opens them:

1. An early assertion read "search row absent" with 10 categories. The assertion was wrong, not the code:
   `"Search categories"` is a `placeholder` **attribute**, not page text, so it never appears in
   `innerText`. Re-checked by counting `input` elements: 1 with ten categories, 0 with three.
2. The dark-mode screenshot looked like it had a focus ring on the search input. Computed styles say
   otherwise — `outline-width: 0px` both focused and unfocused, `box-shadow: none`. What reads as a ring
   is the intended inset field: in dark mode `inputBgSheet` (`#161826`) is *darker* than the sheet's
   `surface` (`#232532`), so its `C.border` edge stands out.

Also note Playwright cannot click the backdrop by its centre (the sheet covers it) and cannot reach the
screen behind an open sheet — both are the modal behaving correctly, not failures.

### What is still unverified

Everything that needs a real session or a device, unchanged from the spec's own list: the keyboard
behaviour on iOS/Android (the `KeyboardAvoidingView` is the one genuinely risky piece and web exercises
it barely), the picker sheet **nested inside** the edit modal's sheet, and an actual save round-trip.
The probe rendered the control standalone, not inside `UpdateTransactionModal`.

## Verify when done

Static, from `client/`:

- [x] `npx tsc --noEmit` clean.
- [x] `yarn lint` clean.
- [x] `grep -rn "CategoryPicker" components/` shows exactly two remaining call sites (`SmartAdd.tsx`,
      `TransactionRequestEditModal.tsx`) and no import left in `AddTransactionPage.tsx` or
      `UpdateTransactionModal.tsx`.
- [x] `yarn web` bundles and the app boots with no page errors.

Isolated behaviour — **the honest limit:** both screens are inside `(tabs)` behind `AuthGuard`, and this
environment has no test credentials, so the real screens cannot be driven headlessly (the same wall hit
in specs 41–43). Verify the control the way spec 42 verified its param handoff — a **throwaway
top-level route** (outside `(tabs)`, so `AuthGuard` does not apply) rendering the field against a mocked
list, driven with Playwright, then deleted with `tsc`/`lint` re-run on the clean tree:

- [x] Tapping the field opens the sheet; the close button and a backdrop tap both dismiss it.
- [x] Typing filters the list case-insensitively; a non-matching query shows the "no match" line while
      "No category" stays visible.
- [x] With fewer than 8 categories the search row is absent; with 8+ it is present — by input count, not page text.
- [x] Selecting a row closes the sheet and the field shows that category's name and icon.
- [x] "No category" sends `null` and the field returns to its placeholder.
- [x] The selected row shows a checkmark and the `accentDim` fill when the sheet is reopened.

On a device / with a login (needs the user):

- [ ] **Keyboard**: focus the search box on iOS _and_ Android — the sheet and the list stay visible above
      the keyboard, and the first tap on a row selects it rather than just dismissing the keyboard.
- [ ] The sheet opened from **inside** the edit modal stacks above it, and closing it leaves the edit
      sheet open with its other fields intact.
- [ ] Saving an entry persists the chosen `categoryId`; saving with "No category" omits the field
      entirely and does not 400.
- [~] Dark **and** Light: both schemes rendered and screenshotted on the probe; the field **inside the edit sheet** (`inSheet`) is still device-only — that
      is what `inSheet` is for — and the muted/accent rows read correctly in both.
- [x] Web target: no stray focus ring on the search box, and row taps work — confirmed by computed style.
- [ ] A user with zero categories sees the `EmptyState` inside the sheet, not a blank list, and the field
      reads "Select category" rather than "No categories yet" while loading.
