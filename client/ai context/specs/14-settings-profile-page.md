# 14: Settings / profile page

Status: 📝 Drafted — awaiting review before implementation starts. **Depends on `12-category-management-ui.md` (embeds `CategoryManager`) and `server/ai context/specs/10-user-profile-endpoints.md`.**

## Cross-repo context

Third of three client specs implementing categories + a settings page:
1. `12-category-management-ui.md` — the `CategoryManager`/`CategoryFormModal` components this doc mounts as a section.
2. `13-wire-category-to-transaction-ui.md` — unrelated to this doc's own changes, same overall ask.
3. **This doc** — the new Settings screen: a permanent, discoverable place to view/edit profile info and manage categories.

Server companion: `server/ai context/specs/10-user-profile-endpoints.md` (`GET /auth/me`, `PATCH /auth/update-profile`).

Source: user's explicit new ask (not in the original `feature-plan-proposals.md`) — "I want a setting page or a page from where user could able to see their information as well as from there user can create - update category and also user can update their information."

## Prior art in this repo

`client/ai context/specs/08-discoverable-logout.md` considered and explicitly **declined** a "Dedicated Account screen" (its Option C) as more than a minimal, already-shipped-and-working app needed at the time, choosing a simple header icon instead. That decision is superseded by this spec — the user is now explicitly asking for exactly that dedicated screen, expanded to also host category management. Home's existing logout icon (spec 08) is **not removed** by this spec (see Scope/Design below) — it stays as a quick one-tap path; Settings gains its own Logout entry too, which spec 08's own text already anticipated as "redundant but harmless."

## Goal

One permanent, always-reachable screen where the user can see their name/email, edit their name, and manage their categories — replacing "categories only exist inside the Add Transaction flow" with a proper home for account-level actions.

## Scope

**In scope:**
- A new 5th tab, **Settings**, added to the tab bar (`app/(tabs)/_layout.tsx`) — a permanent entry point, not a hidden route reached via a button on another screen (unlike Smart Add/Requests) — because unlike those two, this is account-level and should be discoverable the same way Home/Monthly/History already are.
- `SettingsPage.tsx`: a **Profile section** (name, email — read-only, avatar-less per spec 08's "currently i dont need the avatar" decision — an edit affordance for `name` only, per server spec `10`'s scope) and a **Categories section** embedding `CategoryManager` (spec 12) directly on the page (not a further sub-navigation — the category list is short enough not to need its own screen).
- A **Logout** entry at the bottom of Settings, calling the existing `logoutFunction` from `context/user.context.tsx` — same confirm-dialog pattern as Home's existing icon (including the same `Platform.OS === "web"` → `window.confirm` branch spec 08 already added, since `Alert.alert` no-ops on web).
- On successful profile update, call `handleSetUser` (not just `setUser`) so the new name is also persisted to `AsyncStorage` — otherwise a killed-and-reopened app would show the stale cached name again (`context/user.context.tsx`'s existing `handleSetUser` already does exactly this).

**Out of scope:**
- Removing Home's existing logout icon (spec 08) — left as-is, per the "prior art" note above; not touched as a side effect of this unrelated screen.
- Email/password editing, profile picture upload — same reasons as `server/ai context/specs/10-user-profile-endpoints.md`'s scope section (identity/sync risk, security-sensitivity, no upload infra decided yet, respectively).
- Any app-level settings (theme toggle, notification prefs, etc.) — nothing like that exists yet in this app; inventing settings nobody asked for is exactly the kind of scope creep this project's own conventions warn against. This page is named "Settings" but its actual content, per the user's ask, is profile + categories only.

## Design

### 1. New tab — `app/(tabs)/settings.tsx` (new)

```tsx
import SettingsPage from "@/components/main/Settings/SettingsPage";

export default function SettingsScreen() {
  return <SettingsPage />;
}
```

`app/(tabs)/_layout.tsx` — add a 5th `Tabs.Screen`, visible (not `href: null`, unlike Smart Add/Requests):

```tsx
<Tabs.Screen
  name="settings"
  options={{
    title: "Settings",
    tabBarIcon: ({ color }) => <TabIcon name="cog-outline" color={color} />,
  }}
/>
```

Placement in the tab order: after History (rightmost), matching the left-to-right "frequency of use" ordering the existing 4 tabs already follow (Home, Add, Monthly, History → account-level Settings last).

### 2. Types — `client/types/global.types.ts`

`IUser` already has `name`/`email`/`profilePicture`/`createdAt`/`updatedAt` — no change needed; the new `GET /auth/me` response fits the existing shape.

### 3. Hook — reuse `useFetchData`/`usePatch` directly (no new dedicated hook file needed, this is a single screen with two simple calls)

```ts
const { data: profile } = useFetchData<IUser>(["profile"], "/auth/me");
const updateProfileMutation = usePatch([["profile"]]);
```

### 4. `SettingsPage.tsx` — `client/components/main/Settings/SettingsPage.tsx` (new)

- **Profile card**: display `profile?.data?.name` and `.email` (email shown but not editable — no `TextInput`, just text, to make the read-only-ness visually obvious rather than a disabled-looking input). A pencil icon next to the name opens an inline edit (a single `FormField` + save/cancel, matching the compactness of e.g. `TransactionRequestEditModal`'s inline-edit-then-confirm pattern from client spec 11, not a separate full modal for a one-field edit).
- On save: `updateProfileMutation.mutateAsync({ url: "/auth/update-profile", payload: { name } })`, then on success call `handleSetUser({ ...user, name })` from `useUserContext()` so the header/cached copy stays in sync immediately, plus invalidate `["profile"]`.
- **Categories section**: a section header ("Categories") followed directly by `<CategoryManager />` (spec 12) — no extra wrapping/navigation.
- **Logout section**: a bordered row with a "logout" icon + "Log Out" label, `onPress` → same confirm-then-`logoutFunction()` flow as `HomePage.tsx`'s existing button (`Platform.OS === "web"` branch included, per spec 08's follow-up fix).

### 5. Layout

Single `ScrollView` (like `MonthlyTransactionPage.tsx`/`HistoryPage.tsx`), sections separated by the existing `spacing`/`radius` tokens and `C.surface`/`C.border` card styling already used throughout (`SummaryPills`, `TotalBalanceCard`) — no new visual language invented for this page.

## Implementation notes

Files touched/added:
- `client/app/(tabs)/settings.tsx` (new)
- `client/app/(tabs)/_layout.tsx` (edit — register visible 5th tab)
- `client/components/main/Settings/SettingsPage.tsx` (new)
- (from spec 12, embedded here) `client/components/main/Settings/CategoryManager.tsx`, `CategoryFormModal.tsx`

## Verify when done

- [ ] `yarn lint` / `npx tsc --noEmit` pass clean (new route requires regenerating Expo Router's typed routes, same one-time step noted in client spec 11's verify notes).
- [ ] Settings tab is visible and reachable in the tab bar without any prior instruction (the actual point of this spec, per the user's ask and spec 08's "Option C" precedent).
- [ ] Profile section shows the real logged-in user's name and email.
- [ ] Editing name, saving, then killing and reopening the app (or hard-refreshing on web) shows the new name — confirms `handleSetUser`'s `AsyncStorage` persistence is actually wired, not just in-memory state.
- [ ] Categories section shows/creates/edits/deletes categories correctly (re-verifies spec 12's component works correctly once actually mounted on a real screen, not just in isolation).
- [ ] Logout from Settings clears session and redirects to `/auth`, same as Home's existing icon.
- [ ] Home's existing logout icon (spec 08) still works, unchanged — confirms it wasn't touched as a side effect.
