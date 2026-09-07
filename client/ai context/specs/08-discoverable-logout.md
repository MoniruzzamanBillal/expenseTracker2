# 08: Add discoverable logout functionality

## Goal

A logout mechanism technically exists today, but it's apparently not discoverable — flagged by the user as "there is no way to log out." This spec plans a clear, unambiguous way to log out, without touching the (already-correct) logout logic itself.

## Current state (as of spec 06's redesign)

- `context/user.context.tsx`'s `logoutFunction()` already does the right thing: clears `AsyncStorage`'s `"user"`/`"token"` keys **and** resets in-memory `user`/`token` state to `null`. No bug here, no `AUTH-2`-style staleness.
- The only place it's wired up is `components/main/Home/HomePage.tsx`: tapping the gradient avatar circle in Home's header (`handleAvatarPress`) shows a native `Alert.alert("Log out?", ...)` confirm; tapping "Log out" (destructive style) calls `logoutFunction`.
- Before spec 06's redesign, logout lived as an always-visible `MaterialCommunityIcons` `"logout"` icon in the tab bar's `headerRight` (`app/(tabs)/_layout.tsx`) — unambiguous, one tap, visible on Home at all times. Spec 06 removed that icon (`headerShown: false` across all tabs, per the new design's cleaner chrome) and moved the trigger onto the avatar tap instead, matching how `xpnsapp`'s reference design handles it.
- **The likely gap**: a plain circular avatar showing just the user's initial doesn't visually signal "tap here to log out" (or even "tap here for account actions") to someone who hasn't been told. The old header icon didn't have this problem — an icon universally recognized as "logout," sitting in a spot users expect account controls to be, in permanent view.

## Scope

**In**: making logout clearly reachable from the app.
**Out**: any server-side change (logout is 100% local — no API call involved); building an editable profile/settings system (unless the chosen option below naturally includes a bare-minimum version of one); any other Home-screen UX changes unrelated to logout.

## Options — pick one before implementation starts

### Option A — Restore a small, always-visible logout icon (lowest-risk)
Add a compact icon-only button (`MaterialCommunityIcons` `"logout"`, themed) in Home's header, next to or near the avatar — always visible, one tap, same confirm dialog as today. Closest to how the original (pre-redesign) app worked, so it directly restores the discoverability that was lost. Smallest change: one new icon + `onPress`, in the same file.
**Trade-off**: a second interactive element in the header row (currently just greeting + avatar), marginally busier than the new design's minimal header.

### Option B — Make the avatar's affordance explicit
Keep logout on the avatar, but add a visual cue that it's tappable for account actions — e.g. a small chevron/dots badge overlaid on the avatar corner, or a short first-run tooltip. Avoids adding a second element to the header.
**Trade-off**: doesn't fully solve "how would a user know" without *some* added visual cue, and a one-time tooltip is easy to miss/dismiss and forget.

### Option C — Dedicated Account screen
Tapping the avatar navigates (instead of immediately confirming) to a small Account screen — name/email display, a clearly-labeled "Log Out" button. Most standard/extensible pattern (room for a future theme toggle, etc.), but the largest change: a new route (reachable via `href: null` in the tab group, same technique as Smart Add — see spec 06), a new screen component, and navigation wiring.
**Trade-off**: more work than the other two; may be more than this minimal, two-entity personal-finance app needs (per the original design brief's "keep it minimal" instruction).

## Recommendation

Option A — it directly and unambiguously fixes the reported problem with the smallest change, and doesn't require a user to first notice or correctly interpret a visual cue. The avatar can keep its current tap-to-logout behavior alongside the new icon (redundant but harmless), or the avatar's `onPress` can be dropped in favor of the single icon — a call to make during implementation, not a blocker for this plan.

## Decision

Option A, chosen 2026-09-07 — with the added instruction to drop the avatar entirely rather than keep it as a redundant secondary path (user: "currently i dont need the avatar").

## Implementation notes

- `components/main/Home/HomePage.tsx`: removed the `LinearGradient` avatar circle (and its `initial`-from-`user.name` computation) entirely; replaced it with a themed icon-only button (`MaterialCommunityIcons` `"logout"`, in a bordered square matching the app's other icon-button styling) in the same header slot. `onPress` keeps the exact same `Alert.alert("Log out?", ...)` confirm → `logoutFunction()` flow as before — only the trigger element changed, not the logout behavior itself.
- `expo-linear-gradient` had no other call site in the app once the avatar was removed — dropped from `package.json`'s dependencies and `yarn.lock` regenerated, rather than leaving an orphaned unused dependency.
- No change to `context/user.context.tsx` — `logoutFunction()` untouched.
- Re-verified with the same headless-browser harness used for spec 06: logged in (mocked), confirmed the new logout icon renders clearly in Home's header (screenshot), `npx tsc --noEmit` and `yarn lint` both clean.

## Verify when done

- [x] Logout is reachable from Home without prior knowledge that the avatar is tappable — it's now a standalone, clearly-iconed button, not the avatar
- [x] A confirm step still appears before actually logging out (`Alert.alert`, unchanged)
- [x] After confirming, `AsyncStorage` is cleared, in-memory session state resets, and `AuthGuard` redirects to `/auth` — `logoutFunction`'s existing behavior, unchanged, just called from the new button
- [x] `yarn lint` and `npx tsc --noEmit` pass
