# 10: Pre-production manual verification checklist

## Goal

Everything in specs 06–09 (the visual redesign, the accordion crash fix, the discoverable-logout fix, the `SafeAreaView` fix) was verified via `tsc`/`lint` and a headless-browser click-through against `expo start --web`. That's real signal, but it's not the same environment the app actually ships in — a headless browser can't exercise touch gestures, real network loss, or a real login. This is the checklist to run on a real device before deploying v2 to production.

## Scope

This is a manual, human-run checklist — not something to automate or implement. Nothing in this file gets "completed" by writing code; it gets completed by someone tapping through the app on a phone (or simulator/emulator) and checking each box.

## Why each item is here (not just "test the app")

- **Swipe-to-edit/delete**: `react-native-gesture-handler`'s `Swipeable` requires an actual touch drag — headless Chromium can't produce this, so `TransactionCard`'s swipe actions have zero real-interaction coverage since the redesign touched every card that uses them.
- **Offline queue**: the app's offline-transaction-queue is existing, important functionality (`utils/transactionQueue.ts`, `hooks/usePendingTransactions.ts`) that spec 06 was required to preserve untouched. The code was carefully ported, not stress-tested against an actual network drop.
- **Real login**: every screenshot/click-through this session used a *mocked* login response (`page.route` intercepting `/api/auth/login`) — deliberately, to avoid touching production auth/data from an automated test. The real request/response round-trip has not been exercised since the rewrite.
- **Production build**: dev-server bundling (Metro, unminified, React DevTools attached) can behave differently from a release build (`eas build`, minified, no dev tools). Font loading (`@expo-google-fonts/inter`) and icon fonts (`@expo/vector-icons`) in particular are worth a real-build check.
- **Both platforms**: the redesign's `theme/` system, tab bar, and `SafeAreaView` swap (spec 09) all have platform-conditional behavior (Android historically got no safe-area insets at all from the old component — spec 09 changes that) — Android and iOS should each get at least one pass.

## Checklist

### Setup
- [ ] Install on a real Android device/emulator (not just headless web)
- [ ] Install on a real iOS device/simulator, if iOS is a target
- [ ] Confirm the app points at the real production API (`utils/envConfig.ts`'s `baseURL`)

### Auth
- [ ] Register a new real account — confirm success, redirect to `/auth` (not auto-login — this was deliberately preserved as pre-redesign behavior, see spec 06 §"non-negotiable preservations")
- [ ] Log in with a real account — confirm success, lands on Home
- [ ] Log out via the new logout icon on Home (top-right) — confirm the confirm dialog appears, confirms, and returns to `/auth`
- [ ] Confirm dark mode and light mode both render correctly on Auth/Register (toggle OS theme)

### Home
- [ ] Today's balance/income/expense figures match what's actually in the account
- [ ] Pull-to-refresh actually refreshes (watch for new data, not just the spinner)
- [ ] **Swipe left** on a transaction card → delete action appears → confirm → transaction is deleted
- [ ] **Swipe right** on a transaction card → edit action appears → opens `UpdateTransactionModal` → edit and save → change reflected
- [ ] Swiping a second card while the first is still open closes the first ("only one open at a time")

### Add Transaction
- [ ] Manually add an income transaction and an expense transaction — both save and appear on Home
- [ ] Tap the "Smart Add" button in the nav row → navigates to `/smart-add` → confirm you can navigate back (tab bar or system back)

### Smart Add
- [ ] Enter a natural-language prompt (e.g. "bought groceries for 500 taka") → "Parse with AI" → parsed draft(s) appear
- [ ] Edit a parsed draft's title/amount/description inline, toggle its type — edits stick
- [ ] Remove a parsed draft — it disappears from the list
- [ ] Save the batch — transactions appear on Home

### Offline queue (the part headless testing genuinely could not cover)
- [ ] Turn on airplane mode, add a transaction manually — confirm it's queued locally with a "Saved locally" message, not lost
- [ ] While still offline, confirm the pending item appears in Home's "PENDING SYNC" section with the dashed/dimmed card style
- [ ] Edit the pending item (pencil icon) — change sticks locally
- [ ] Turn airplane mode back off, tap "Sync now" on the pending-sync banner — confirm it syncs and disappears from pending
- [ ] Repeat with Smart Add's batch-save path while offline (its own queue path, `origin: "smart-add"`)

### Monthly / Weekly (merged tab, spec 06 Decision 8)
- [ ] Monthly tab opens defaulting to the "Monthly" segment
- [ ] Prev/next chevrons and "Current Month" button work correctly
- [ ] Tap the "Weekly" segment — view switches, shows the current Fri–Thu week
- [ ] Expand/collapse a day's accordion row in both Monthly and Weekly — transaction list shows/hides correctly
- [ ] Weekly's per-day bar visual renders (a colored bar under each day's header row)
- [ ] Swipe-to-edit/delete still works on a transaction nested inside the accordion

### History
- [ ] Year chevrons navigate correctly, respect the 2025 lower bound
- [ ] Current month's row shows the expanded bar-card style; other months show the compact row style
- [ ] Confirm month rows are **not** tappable (Decision #5 — read-only, no drill-in navigation)

### Cross-cutting
- [ ] Force an API error (e.g. toggle airplane mode mid-request on a screen other than Add Transaction) — confirm the interceptor's Toast still appears (known limitation: it may show without a specific message on some failures — `known-issues.md#FETCH-7`, already fixed — and most `try/catch`es around mutations are known-dead code per `known-issues.md#FETCH-1`, not something this checklist is meant to catch)
- [ ] All icons (`MaterialCommunityIcons`) render as real icons, not missing-glyph boxes, on both platforms
- [ ] Inter font loads and applies everywhere (compare to a screenshot from this session's web testing — text should look the same, not fall back to a system font)

## Verify when done

- [ ] Every box above checked on at least one Android device/emulator
- [ ] Every box above checked on at least one iOS device/simulator (if iOS ships)
- [ ] Any failure found gets its own numbered spec (see `specs/07-fix-accordion-crash-on-empty-day-bucket.md` for the pattern) before being fixed
