# 06: Visual redesign — port the xpnsapp design system onto this app

## Goal

Apply the new visual design (from the Claude Design handoff bundle at `../designbundle/`, implemented as a visual reference at `../../xpnsapp/`) onto this shipping app, screen by screen, without losing any existing feature — the offline transaction queue, pending-sync banner, swipe-to-edit/delete, and both accordions all keep working, just restyled.

## Scope

**In**: porting `xpnsapp/theme/` (colors/typography/spacing/radius/shadow tokens + `ThemeContext`) into `client/theme/`; adding the Inter font family; rebuilding shared components (`TransactionCard` incl. its `pending`/`Swipeable` variants, `TotalBalanceCard`, skeletons, `EmptyState`, `FormField`, `PrimaryButton`, `TypeToggle`, `SummaryPills`, `DaySection`, `WeekDayRow`) on the new tokens; redesigning all 8 screens (Auth, Register, Home, Add Transaction, Smart Add, History, Monthly, Weekly) and the tab bar; restyling the two edit modals; moving Smart Add off the tab bar onto a button on Add Transaction (Decision 7); merging Monthly and Weekly into one page/tab with an in-page segmented control (Decision 8).

**Out**: any change to API endpoints/payloads, TanStack Query keys/invalidation, `transactionQueue.ts`/`usePendingTransactions.ts` logic, `AuthGuard`/`UserProvider` logic, and fixing anything in `known-issues.md` as a side effect (flag, don't fix, per `ai-workflow-rules.md`). **Two explicit, approved navigation changes**: Smart Add moves off the tab bar onto a button on Add Transaction (Decision 7); Monthly and Weekly merge into one page/tab (Decision 8). Everything else about the IA stays frozen — History stays read-only/non-interactive, no other tab is added, removed, or reordered.

## Design

### 1. Theme system

Port `xpnsapp/theme/{colors,typography,spacing,ThemeContext,index}.ts` into `client/theme/`, near-verbatim (they're generic — no xpnsapp-specific data). Add `@expo-google-fonts/inter` (client already has `expo-font`). Load fonts + gate on `SplashScreen` in `client/app/_layout.tsx`, mirroring xpnsapp's `_layout.tsx` pattern. Add `ThemeProvider` to the provider stack — proposed order: `SafeAreaProvider` → `KeyboardProvider` → `QueryClientProvider` → `ThemeProvider` → `GestureHandlerRootView` → `PaperProvider` → `UserProvider` → `<Slot/>` + `<Toast/>` (keeps every existing provider, just inserts `ThemeProvider` before the ones that render UI).

Replace `utils/colors.ts`'s `COLORS` with `useTheme()` per screen as each one is redesigned (not a single mechanical pass — the token names don't map 1:1, e.g. `COLORS.textLight` becomes `C.textSecondary` in some spots and `C.textMuted` in others depending on context). Leave `constants/theme.ts` (unrelated, zero-call-site Expo scaffolding per `code-standards.md`) untouched. Pending-transaction cards get their dashed/dimmed look from `opacity` + `borderStyle: "dashed"` over regular theme tokens, same idea as today — no new token needed.

### 2. Shared components — build first

Port from `xpnsapp/components/main/shared/`, adjusting imports to this app's paths (`@/types/Transaction.tyes` — keep the typo, it's load-bearing per `TYPE-3`; `@/constants/TransactionType.constant`'s `TransactionTypeConst`, the canonical enum per `code-standards.md`):

- `EmptyState`, `FormField`, `PrimaryButton`, `TypeToggle`, `SummaryPills`, `DaySection`, `WeekDayRow` — near-verbatim ports, generic.
- `TotalBalanceCard` — full replace with xpnsapp's version (it already takes a `label` prop for reuse across screens).
- `TransactionCardSkeleton` — replace with xpnsapp's shimmer-row version.
- `TransactionCard` — visually rebuilt on xpnsapp's layout (icon chip + title/description/time + amount), but keeps both of this app's variants that xpnsapp has no equivalent for: the `pending` prop's dashed/opacity card with inline edit/delete icon buttons, and the normal card's `Swipeable` wrapper with left(delete)/right(edit) actions + `onSwipeOpen` callback (the "only one card open at a time" behavior driven by `HomePage`/`TransactionAccordion`). Swipe-action panel fills move from hardcoded `red`/`green` to `C.expense`/`C.income`; keep `MaterialCommunityIcons` for the swipe glyphs (no xpnsapp reference exists for this interaction — see Open Question 1).
- `PendingSyncBanner` — restyle only, same hooks/logic (xpnsapp has no equivalent — `SCOPE-1`).
- `UpdateTransactionModal` / `PendingTransactionEditModal` — keep react-native-paper's `Portal`/`Modal` as the overlay mechanism (lowest-risk way to keep "modal over the current screen" working — see Open Question 2); rebuild the _inside_ with the new `TypeToggle`/`FormField`/`PrimaryButton` + theme tokens instead of raw `TextInput`s. Both currently import `transactionConstants`/`TTransactionType` from `AddTransactionPage.tsx` — once that page is rewritten to stop locally exporting them, repoint both modals at `TransactionTypeConst` from the canonical constants file (an incidental fix forced by the rewrite, not a deliberate `TYPE-1` cleanup — call it out in the commit message).

### 3. Per-screen mapping

1. **Auth** (`app/auth.tsx`) → xpnsapp's `app/auth.tsx`: wordmark, "Welcome back" heading, two `FormField`s (password with toggle), static "Forgot password?" text (no handler either side), `PrimaryButton`, footer link to Register. Same `usePost`/`handleSetUser`/`handleSetToken`/`router.replace` logic.
2. **Register** (`app/register.tsx`) → xpnsapp's `app/register.tsx`: back button, heading, three `FormField`s with per-field `error` text instead of Toast-only validation, `PrimaryButton`.
3. **Home** (`components/main/Home/HomePage.tsx`) → xpnsapp's header (date/greeting/avatar-initial-with-logout) + `TotalBalanceCard` + `PendingSyncBanner` (restyled) + transaction list. xpnsapp's `DaySection` only takes a flat, swipe-less `transactions` array, so Home renders its own section header (borrowing `DaySection`'s label markup) around the pending cards and the swipe-enabled synced cards, wiring `onSwipeOpen` through directly rather than forcing everything through `DaySection`.
4. **Add Transaction** (`components/main/AddTransaction/AddTransactionPage.tsx`) → xpnsapp's layout: nav+close, `TypeToggle`, big centered accent-underlined amount input, title/description `FormField`s, `PrimaryButton`. Keep the existing offline-queue fallback (`enqueuePendingTransactions` on a non-success response) — no xpnsapp equivalent, preserve as-is. Move off the page-local `transactionConstants` export onto `TransactionTypeConst` (grep `UpdateTransactionModal.tsx` for that import before deleting it — see §2). Nav row gains a small "Smart Add" entry point (button/pill, echoing the ✦ AI badge style) that does `router.push('/smart-add')` (Decision 7) — Add Transaction stays the default/prominent manual-entry path.
5. **Smart Add** (`components/main/smartAdd/SmartAdd.tsx`) → xpnsapp's `SmartAddPage.tsx`: AI badge, textarea, "Parse with AI", editable draft cards (tap-to-toggle type, inline title/amount/description edit, remove), "Save N Transactions". Keep the existing offline-queue fallback on the batch-save path (`enqueuePendingTransactions` + `createBatchId`) — no xpnsapp equivalent, preserve. Leave the `usePost([[""]])` no-op key (`FETCH-3`) alone unless the rewrite forces touching that exact line. No longer its own tab (Decision 7) — the route (`app/(tabs)/smart-add.tsx`) and screen component are unchanged, just reached via the button on Add Transaction instead of the tab bar.
6. **History** (`components/main/HistoryPage/*`) → xpnsapp's `HistoryPage.tsx`: year nav chevrons, `SummaryPills` (income/expense/net) replacing `SummaryGrid`+`MonthlyBreakdownHeader`, month rows (current-month bar-card vs. compact row for others) replacing `HistoryCard`. Keep the existing `startYear = 2025` lower bound (xpnsapp has none). Skeleton: keep a dedicated restyled month-row skeleton rather than swapping in the generic transaction skeleton, since the row shapes differ.
7. **Monthly + Weekly, combined** (`components/main/MonthlyTransaction/*`) → merged into one page/tab per Decision 8. `MonthlyTransaction.tsx` becomes the combined component: an in-page segmented control ("Monthly" | "Weekly", default "Monthly") at the top, then a conditional sub-view. **Monthly sub-view**: xpnsapp's nav-row look + client's own prev/next-chevron + "Current Month" button month selector (xpnsapp has no month nav at all) + 4-pill `SummaryPills` (IN/EXP/BAL/AVG, folding in `MonthlyAverageCard`) + `TransactionAccordion` (no `showBar`). **Weekly sub-view**: xpnsapp's header (date range, "Fri–Thu") + 3-pill `SummaryPills` (WEEK EXP/DAILY AVG/WEEK IN, folding in `WeeklyAverageCard`, using client's `daysWithExpense`-aware average — not xpnsapp's `/7`) + `TransactionAccordion` with `showBar`/`maxAbs` (bar math ported inline from `WeekDayRow` — see Implementation notes). Both sub-views share the same `TransactionAccordion` (collapse/expand per day, swipe-to-edit/delete) instead of xpnsapp's always-expanded `DaySection` — collapsing is today's real behavior in both and nothing about the redesign requires dropping it. `components/main/weeklyTransactionsPage/WeeklyTransactionsPage.tsx` and `app/(tabs)/weeklyTransactions.tsx` are deleted; their logic folds into `MonthlyTransaction.tsx`'s Weekly sub-view.
8. _(retired — Weekly is now the second sub-view of item 7, not a separate screen.)_
9. **Tab bar** (`app/(tabs)/_layout.tsx`) → adopt xpnsapp's look (accent-tinted active icon, raised FAB-style Add button) applied to **4 visible tabs**: Home, Add Transaction (FAB-styled), Monthly (combined Monthly/Weekly, per Decision 8), History. `smart-add`'s `Tabs.Screen` stays registered with `options={{ href: null }}` (Decision 7) — route keeps working, just not shown as a tab. `weeklyTransactions`'s `Tabs.Screen` is removed entirely (Decision 8) — that route no longer exists, nothing pushes to it. No other tab is added, removed, or reordered.

## Decisions

1. **Icon system** — keep `MaterialCommunityIcons` everywhere (no swap to xpnsapp's plain-text glyphs). Restyle colors/sizes to theme tokens, but the icon set itself doesn't change.
2. **react-native-paper** — keep `PaperProvider` mounted; keep only `Portal`/`Modal` from Paper for the two edit modals; stop using Paper's `Text`/`Button`/`TextInput`/`IconButton` everywhere else.
3. **Monthly's "Avg Daily Expense" card** — fold into `SummaryPills` as a 4th pill alongside IN/EXP/BAL.
4. **Weekly's per-day transaction list** — keep `TransactionAccordion` (shared with Monthly) as the real expand/list/swipe mechanism; render `WeekDayRow`'s bar as a read-only visual inside/above each accordion row.
5. **History → Monthly drill-in** — not added; History stays read-only, visual-only change. Monthly keeps its own tab, reached the same way as today.
6. **Number formatting** — adopt xpnsapp's `Math.abs(n).toLocaleString('en-IN')` + explicit `+`/`−` sign everywhere an amount is shown.
7. **Smart Add leaves the tab bar** — dropped from 6 tabs to 5 (Home, Add Transaction, Monthly, Weekly, History). Smart Add is reached via a button on Add Transaction's nav row (`router.push('/smart-add')`), not its own tab. The route stays inside the `(tabs)` group, hidden from the bar via `href: null` (mirrors xpnsapp's existing technique for hiding `monthlyTransactions`). Rationale: 6 tabs was crowded for a bottom bar; grouping manual entry and AI entry as two paths to "add a transaction" (one default/prominent, one a tap deeper) is a cleaner IA than two peer-level tabs, and matches the new design's less-crowded tab-bar language. No change to `SmartAdd.tsx`'s screen logic, data flow, or offline-queue behavior — entry point only.
8. **Monthly and Weekly merge into one page/tab** — a single combined screen (`components/main/MonthlyTransaction/MonthlyTransaction.tsx`, tab labeled "Monthly") with an in-page segmented control ("Monthly" | "Weekly", default "Monthly"). Tab count drops from 5 to 4: Home, Add Transaction, Monthly, History. `components/main/weeklyTransactionsPage/WeeklyTransactionsPage.tsx` and `app/(tabs)/weeklyTransactions.tsx` are deleted — their data-fetching, summary pills, and the `showBar`/`maxAbs` accordion hookup (Decision 4) move into `MonthlyTransaction.tsx`'s Weekly sub-view. Rationale: Monthly and Weekly are the same kind of view (a day-by-day breakdown via `TransactionAccordion`) at different granularity, already sharing that component — a segmented control is a more natural pairing than two peer-level tabs, and further reduces tab-bar crowding beyond Decision 7. Tab label defaults to "Monthly" (the default sub-view); easy to rename later (e.g. to a neutral "Reports") if preferred.

## Implementation notes

### Non-negotiable behavior preservations (xpnsapp's reference code differs here — do NOT adopt xpnsapp's version)

- **`useFetchData` signature differs.** `client/hooks/useApi.ts`'s `useFetchData(key, endpoint, options?)` has no params-object forwarding; when porting a screen that in xpnsapp calls `useFetchData(key, url, { targetMonth: month })`, rewrite it back to client's pattern: ``useFetchData(key, `${url}?targetMonth=${month}`)``. Do not touch `hooks/useApi.ts`.
- **`description` payload fallback stays `" "`, not `undefined`.** Server requires `description` (`TYPE-2`). Every payload-building spot (Add Transaction, Smart Add's direct-save and offline-queue paths) keeps `description: description.trim() || " "`.
- **Register does not switch to auto-login.** Keep `client/app/register.tsx`'s current handler: success Toast + `router.replace("/auth")` — not xpnsapp's auto-login-and-redirect-home.
- **Auth's user-payload rebuild stays as-is.** Keep the manual `{ _id, name, email }` rebuild before `handleSetUser` (this is known-issue `AUTH-5`, dropping `profilePicture` — don't silently fix it by adopting xpnsapp's `handleSetUser(result.data)`).
- **History stays non-interactive.** Month rows are plain `View`s — no `TouchableOpacity`/`router.push` to Monthly (Decision #5). Monthly keeps its own local `selectedMonth` state + prev/next chevrons; it does not read route params.
- **Add Transaction's numeric validator stays client's stricter regex** (rejects malformed input with a Toast), not xpnsapp's looser `.replace(/[^0-9.]/g, '')`.
- **Weekly's average-expense math stays `expense / daysWithExpense`** (client's existing, more accurate calc), not xpnsapp's `expense / 7`.
- **Pull-to-refresh**: rewritten screens naturally adopt `useFetchData`'s `isRefetching` passed straight to `RefreshControl` (xpnsapp's pattern) rather than client's current `setRefreshing(true); refetch(); setRefreshing(false)` dance — this incidentally fixes `FETCH-6`. Acceptable (it's the natural shape of freshly-rewritten code), but call it out explicitly in the commit message as an incidental fix, not a silent one.

### Build order

1. **Theme** — port `xpnsapp/theme/{colors,typography,spacing,ThemeContext,index}.ts` → `client/theme/`, near-verbatim.
2. **`constants/TransactionType.constant.ts`** — additive only: add `export type TTransactionType = keyof typeof TransactionTypeConst;`.
3. **Standalone shared components** (any order): `EmptyState`, `FormField`, `PrimaryButton`, `TypeToggle`, `SummaryPills`, `TotalBalanceCard` — port from `xpnsapp/components/main/shared/`, fixing import paths to `@/types/Transaction.tyes` and `@/constants/TransactionType.constant`.
4. **`TransactionCard`** rebuild (see below) — blocks `DaySection`, `TransactionAccordion`, `HomePage`, `TransactionCardSkeleton`.
5. **`TransactionCardSkeleton`** — replace with xpnsapp's shimmer-row version.
6. **`DaySection`** (used by Monthly only — Home and Weekly build their own list markup).
7. **`PendingSyncBanner`** — restyle only, same hooks/logic.
8. **`UpdateTransactionModal` / `PendingTransactionEditModal`** — depend on step 3's `TypeToggle`/`FormField`/`PrimaryButton` and step 2's `TTransactionType` export.
9. **`TransactionAccordion`** (restyled, keeps `Collapsible` from `react-native-collapsible`) — depends on `TransactionCard`; gains the Weekly bar hybrid (see below).
10. **Screens**: Auth, Register, Home, Add Transaction, Smart Add, History, Monthly/Weekly combined (any order among themselves).
11. **`client/app/_layout.tsx`** (provider stack + font/splash gating) then **`client/app/(tabs)/_layout.tsx`** (tab bar restyle, including hiding `smart-add` via `href: null` per Decision 7 and removing `weeklyTransactions`'s `Tabs.Screen` entirely per Decision 8) — last, since nothing in steps 3–10 depends on them.

**Delete once superseded** (not partial-restyle): `MonthlyAverageCard.tsx`, `WeeklyAverageCard.tsx` (folded into `SummaryPills`), `HistoryCard.tsx`, `MonthlyBreakdownHeader.tsx`, `SummaryGrid.tsx` (superseded by the rebuilt `HistoryPage.tsx`), `components/main/weeklyTransactionsPage/WeeklyTransactionsPage.tsx` and `app/(tabs)/weeklyTransactions.tsx` (folded into `MonthlyTransaction.tsx`'s Weekly sub-view per Decision 8). Grep for other importers immediately before deleting each.

### `client/app/_layout.tsx` — provider stack

Keep every existing provider; insert `ThemeProvider` and font/splash gating:

```
SafeAreaProvider
  KeyboardProvider
    QueryClientProvider
      ThemeProvider                    ← new
        GestureHandlerRootView
          PaperProvider
            UserProvider
              <Slot /> + <Toast />
```

```tsx
const [fontsLoaded] = useFonts({
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
});
if (!fontsLoaded) return <SplashScreen />;
```

- Add `@expo-google-fonts/inter` to `client/package.json` dependencies (`npx expo install @expo-google-fonts/inter`, matching xpnsapp's pinned version). `expo-font`/`expo-splash-screen` already present.
- Do **not** add `AuthGuard` here — it stays mounted only inside `(tabs)/_layout.tsx` as today (that's known-issue `AUTH-1`; not this task's job to fix).
- Restyle `client/utils/SplashScreen.tsx` to use `useTheme()`/`C.background`/`C.accent`, mirroring xpnsapp's version. (Inherited quirk: `useTheme()` there resolves before `ThemeProvider` mounts, so it always shows the context's dark-mode default for the brief pre-fonts-loaded splash — harmless, not worth fixing, just worth a one-line commit note.)

### `TransactionCard` rebuild (hardest piece)

File: `client/components/main/shared/TransactionCard.tsx`. Keep the prop name `transactionData` (all current call sites use it) and both existing render branches — gated by `pending`, same as today, with all hooks (`usePatch`, `useRemovePendingTransaction`) called unconditionally above the branch (rules-of-hooks, matches today's comment).

**New/kept prop shape**:

```ts
type TProps = {
  transactionData: TTransaction;
  onSwipeOpen?: (ref: Swipeable) => void; // "only one swipeable open at a time"
  pending?: boolean; // dashed/dimmed card, icon buttons, no swipe
  compact?: boolean; // denser row for Monthly/Weekly's nested accordion rows
  isLast?: boolean; // omit bottom divider
};
```

- **Pending branch**: dashed/dimmed `View` (theme tokens instead of hardcoded opacity/dashed styling), icon chip with `clock-outline`, inline `pencil-outline`/`delete-outline` icon buttons → `PendingTransactionEditModal` / `useRemovePendingTransaction`. Amount uses `Math.abs(n).toLocaleString('en-IN')` + sign.
- **Normal branch**: `Swipeable` wrapper, `renderLeftActions`(delete, `C.expense` fill)/`renderRightActions`(edit, `C.income` fill) — same `MaterialCommunityIcons` glyphs (`delete`, `book-edit-outline`) as today, only color sourcing changes from hardcoded `"red"`/`"green"` to theme tokens. `onSwipeableOpen` still calls `onSwipeOpen?.(swipeableRef.current)`.
- **Visual layout for both branches**: icon chip (rounded square, `C.incomeBg`/`C.expenseBg` tint) + title/description/time stack + right-aligned amount — matching xpnsapp's `TransactionCard` row look.
- Delete `TransactionCard.tsx`'s current untyped inline `typeOptions` copy of the enum (part of `TYPE-1`) in favor of `TransactionTypeConst` — incidental, not a deliberate `TYPE-1` pass; call it out.

### `HomePage` composition (no `DaySection` for the transaction list)

xpnsapp's `DaySection` only accepts a flat, swipe-less array — no `onSwipeOpen`/`pending` passthrough. So `HomePage` (`client/components/main/Home/HomePage.tsx`) renders its own section-header markup (borrowing `DaySection`'s `labelRow`/label `StyleSheet` shapes, not importing the component) around two blocks:

1. Pending items (`usePendingTransactions()`, mapped to `TTransaction`-shape as today) → `TransactionCard pending`.
2. Synced items (`useFetchData(["daily-transaction"], "/transactions/daily-transaction")`) → `TransactionCard` with `onSwipeOpen` wired to a local `openSwipeableRef` (same "close the other open swipeable" logic as today).

Header: xpnsapp's date/greeting/avatar-initial pattern, with logout moved onto the avatar tap (`Alert.alert` confirm → `logoutFunction()`) — see tab-bar note below for why `headerRight`'s logout icon is removed from the tab layout.

### Weekly's accordion + bar hybrid

`client/components/main/MonthlyTransaction/TransactionAccordion.tsx`'s real structure: one `View` per day with a `TouchableOpacity` header (date, income/expense/balance, chevron) + `Collapsible` body of `TransactionCard`s.

Don't render `WeekDayRow` as a separate sibling above each accordion item (it would duplicate the date/amount header). Instead, extend `TransactionAccordion` with optional props:

```ts
type TProps = {
  dailyData: TDailyData[];
  showBar?: boolean; // Weekly-only: render a read-only bar under the header row
  maxAbs?: number; // scale for the bar width
};
```

Port `WeekDayRow`'s bar math (`barWidth = Math.max((Math.abs(net)/maxAbs)*100, 6)`, `barColor = net >= 0 ? C.income : C.expense`) **inline** into `TransactionAccordion`'s per-day header block, rendered when `showBar` is true. `MonthlyTransaction.tsx`'s Weekly sub-view calls `<TransactionAccordion dailyData={buckets} showBar maxAbs={maxAbs} />` after its `SummaryPills` row (Decision 8 folds the old standalone `WeeklyTransactionsPage.tsx` into this same file). Skip porting `WeekDayRow.tsx` as a standalone file if it would end up unused/orphaned — inline its math directly instead (avoids a `DEAD-`-style orphan).

### Monthly's 4th `SummaryPills` pill

`SummaryPills`/`TSummaryPill` (`{ label, value, color, bg }`) has no hardcoded pill count — `flex: 1` per pill in a row. Adding a 4th `{ label: 'AVG', ... }` entry is a pure call-site change in `MonthlyTransaction.tsx`, no component change needed. Keep the existing `averageExpense` calc (elapsed-days-aware). Delete `MonthlyAverageCard.tsx` once folded in.

### `transactionConstants` → canonical enum

`client/components/main/AddTransaction/AddTransactionPage.tsx` currently defines and exports `transactionConstants`/`TTransactionType` locally. Only one external importer at time of writing: `client/components/main/shared/UpdateTransactionModal.tsx` (`import { transactionConstants, TTransactionType } from "../AddTransaction/AddTransactionPage"`) — re-grep before deleting. Replace with:

```ts
import {
  TransactionTypeConst,
  TTransactionType,
} from "@/constants/TransactionType.constant";
```

in both files (dropping `AddTransactionPage.tsx`'s local export; swapping `transactionConstants.income/expense` → `TransactionTypeConst.income/expense` in the modal). `PendingTransactionEditModal.tsx` already imports from the canonical file. Flag this in the commit message as an incidental `TYPE-1`-adjacent cleanup forced by the rewrite, alongside `TransactionCard.tsx`'s `typeOptions` removal — not a deliberate full `TYPE-1` fix pass.

### Modal restyle (`UpdateTransactionModal.tsx`, `PendingTransactionEditModal.tsx`)

Keep `Portal`/`Modal` from `react-native-paper` as the shell (add a themed `contentContainerStyle` — background `C.surface`, radius, padding — since Paper's bare `Modal` has no card chrome). Rebuild the inside with `TypeToggle` + `FormField`(amount/title/description) + `PrimaryButton`, colored by `type === 'income' ? C.income : C.expense`. Keep all existing hook/logic/Toast-copy unchanged — only JSX/styling changes.

### Per-screen notes (beyond the shared preservations above)

- **Auth** (`app/auth.tsx`): xpnsapp's layout, client's existing `handleLogin` logic verbatim.
- **Register** (`app/register.tsx`): xpnsapp's layout + per-field `error` state, client's existing `handleRegistration`/redirect-to-`/auth` verbatim.
- **Add Transaction**: xpnsapp's layout, client's existing validator/offline-queue-fallback/`description ?? " "`/`router.push("/")`-after-save logic verbatim, plus the `transactionConstants` fix above, plus a new "Smart Add" entry button in the nav row that does `router.push('/smart-add')` (Decision 7).
- **Smart Add**: xpnsapp's editable-draft-card UI, client's existing two-mutation structure (leave `usePost([[""]])`'s no-op key alone), offline-queue fallback + `createBatchId()`, `description ?? " "` in both save paths. No longer a tab — same screen/route, just removed from the tab bar (Decision 7).
- **History**: xpnsapp's layout (year chevrons via `MaterialCommunityIcons`, not text glyphs; `SummaryPills` INCOME/EXPENSE/NET; current-month bar-card vs. compact rows), keep `startYear = 2025` floor, rows stay non-interactive `View`s. Delete `HistoryCard.tsx`/`MonthlyBreakdownHeader.tsx`/`SummaryGrid.tsx`; rebuild `HistoryCardSkeleton.tsx` to match the new row shapes.
- **Monthly + Weekly, combined** (Decision 8): `MonthlyTransaction.tsx` gains a segmented control ("Monthly" | "Weekly", default "Monthly") above everything else. Monthly sub-view: xpnsapp's nav row, but **keep client's own prev/next-chevron + "Current Month" button month selector** underneath it (xpnsapp has none — it expects route params, which Decision #5 rules out), 4-pill `SummaryPills`, accordion restyled with no `showBar`. Weekly sub-view: xpnsapp's header + `SummaryPills` (WEEK EXP/DAILY AVG/WEEK IN, using client's `daysWithExpense`-aware average) + `TransactionAccordion` with `showBar maxAbs={...}` instead of `WeekDayRow`. `weeklyTransactionsPage/WeeklyTransactionsPage.tsx` and `app/(tabs)/weeklyTransactions.tsx` are deleted; their logic moves into this file's Weekly sub-view.
- **Tab bar** (`app/(tabs)/_layout.tsx`): 4 visible tabs after this change — Home, Add Transaction (FAB-styled), Monthly (combined, tab label "Monthly"), History — restyled with the new colors/FAB treatment. `smart-add`'s `Tabs.Screen` stays registered (route + shared tab-group chrome/back stack keep working) but gets `options={{ href: null }}` (Decision 7) — reachable only via the button on Add Transaction, not the tab bar. `weeklyTransactions`'s `Tabs.Screen` entry is removed entirely (Decision 8) — the route no longer exists. Since logout moves onto Home's avatar, set `headerShown: false` and remove the `headerRight` logout icon from `index`'s tab options.

### Known-issues / protected-files cross-check

No step above touches `utils/axiosInstance.ts`, `context/user.context.tsx`, `utils/AuthGuard.tsx`, `utils/transactionQueue.ts`, `hooks/usePendingTransactions.ts`, `hooks/useApi.ts`, or `types/Transaction.tyes.ts`. `constants/TransactionType.constant.ts` gets one additive export only (no value change) — call this out per `ai-workflow-rules.md`'s "flag, don't silently fix" even though it nets an improvement (fewer enum copies, not more).

## Verify when done

- [ ] Light and dark mode both render correctly on all 8 screens
- [ ] Offline queue still enqueues on a failed save (Add Transaction and Smart Add); `PendingSyncBanner` and the pending `TransactionCard` variant still render/sync correctly
- [ ] Swipe-to-edit/delete still works on Home and inside Monthly/Weekly's accordion, including "only one swipeable open at a time"
- [ ] `UpdateTransactionModal`/`PendingTransactionEditModal` still open, prefill, validate, and save/update correctly
- [ ] All 4 visible tabs route correctly, in their existing order; `smart-add` is no longer a tab but is still reachable via the button on Add Transaction, and back navigation from it returns to Add Transaction correctly
- [ ] The combined Monthly/Weekly tab defaults to the Monthly sub-view, and the segmented control correctly switches both the data shown (monthly vs. weekly fetch) and the accordion's `showBar` behavior
- [ ] Monthly still receives `year`/`month` params from History (if applicable — see Decision #5, History stays non-interactive so this may be a no-op)
- [ ] No change to any API call URL, payload shape, or query-invalidation key
- [ ] `yarn lint` passes in `client/`
- [ ] App run manually (`yarn start`) and clicked through all 8 screens
