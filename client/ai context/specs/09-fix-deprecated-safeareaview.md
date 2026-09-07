# 09: Replace deprecated `SafeAreaView` (from `react-native`) with `react-native-safe-area-context`'s

## Goal

`react-native`'s built-in `SafeAreaView` is deprecated (TypeScript flags it: "Use react-native-safe-area-context instead. This component is deprecated and will be removed in a future release."). Swap every usage over to the maintained replacement before it's removed from a future RN version.

## Scope

**In**: swapping the import source for `SafeAreaView` in every screen that uses it — no other change.
**Out**: any other layout/style change, any change to `SafeAreaProvider`'s placement in `app/_layout.tsx` (already correct — see Design), touching `app/modal.tsx` (unmodified Expo template scaffolding, out of scope per `ai-workflow-rules.md`).

## Current state

`react-native-safe-area-context` (`^5.6.2`) is already a project dependency and already used correctly — `app/_layout.tsx` mounts `SafeAreaProvider` at the root of the provider stack. Nothing needs to be added; only the 7 screens below need their `SafeAreaView` import source changed. All 7 were written/rewritten during the spec 06 visual redesign, which is presumably why they picked up the deprecated core import instead of the context-package one — it wasn't a deliberate choice, just an oversight in that rewrite. Grepped repo-wide; these are the only 7 files, and each has exactly one import and one JSX usage:

- `app/auth.tsx`
- `app/register.tsx`
- `components/main/Home/HomePage.tsx`
- `components/main/AddTransaction/AddTransactionPage.tsx`
- `components/main/smartAdd/SmartAdd.tsx`
- `components/main/HistoryPage/HistoryPage.tsx`
- `components/main/MonthlyTransaction/MonthlyTransaction.tsx`

## Design

Change, in each file:

```diff
-import { ..., SafeAreaView, ... } from "react-native";
+import { ... } from "react-native"; // SafeAreaView removed from this list
+import { SafeAreaView } from "react-native-safe-area-context";
```

No JSX changes needed — every usage is the plain `<SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>...</SafeAreaView>` pattern, and `react-native-safe-area-context`'s `SafeAreaView` accepts the same `style` prop. Its default `edges` prop is all four edges (`top`/`right`/`bottom`/`left`), matching what every one of these screens wants (a full-screen container that avoids the status bar/notch/home-indicator).

**Real behavior change worth flagging, not just a lint fix**: the deprecated core `SafeAreaView` only ever applied insets on iOS — it's a documented no-op on Android. `react-native-safe-area-context`'s version applies real insets on both platforms (reading from `SafeAreaProvider`'s measured frame). So this change isn't purely cosmetic-suppression of a deprecation warning: Android users of these 7 screens will start getting correct top/bottom safe-area padding they weren't getting before. This is a correctness improvement, not a regression, but since it's a real behavior change it's worth a manual check on an Android device/emulator after this lands (can't be verified headlessly — the web target doesn't model device safe-area insets either way).

## Implementation notes

- 7 files touched, one import swap each — no logic/JSX changes.
- No new dependency (`react-native-safe-area-context` already installed and already used for `SafeAreaProvider`).
- `app/_layout.tsx`'s `SafeAreaProvider` wraps everything, so `SafeAreaView` from the context package works correctly regardless of which screen it's used in.

## Verify when done

- [x] `npx tsc --noEmit` no longer reports the `SafeAreaView` deprecation warning on any of the 7 files
- [x] `yarn lint` clean
- [x] All 7 screens still render correctly (headless-browser smoke test) — content isn't clipped or repositioned; clicked through Auth → Home → Add Transaction → Smart Add → Monthly/Weekly (both segments) → History
- [ ] Flagged for a human follow-up: verify on a real Android device/emulator that the (now-correct) safe-area insets don't introduce unwanted extra padding where the old (broken-on-Android) version had none — can't be checked headlessly, the web target doesn't model device safe-area insets either way
