# 26: Android home-screen widget for quick-adding a transaction

## Goal

Let the user add a transaction from the Android home screen without opening the full app — a widget with two tap targets ("+ Expense" / "+ Income") that launches a fast, pre-filled Add Transaction screen. Explicitly **not** a widget for the AI "Smart Add" flow, and Android-only (iOS WidgetKit would require a separately-maintained native SwiftUI extension — decided out of scope for now).

## Scope

**In:**
- One Android App Widget with two buttons: "+ Expense", "+ Income".
- Tapping a button opens the app to a new `quick-add` route, pre-filled with that transaction `type`.
- The `quick-add` screen reuses the existing Add Transaction submit path (same API call, same offline-queue fallback) rather than reimplementing it.
- Moving the client's dev workflow from Expo Go to a custom EAS dev client, since a widget requires native code.

**Out:**
- iOS widget (WidgetKit needs native SwiftUI + App Intents for interactivity; not buildable via the JS-rendered widget library used here).
- Any "silent" widget interaction that adds a transaction with no screen shown — Android widgets can't reliably capture keyboard text input for amount/title, so a real form screen is the only safe way to collect that data.
- Fixing `FETCH-1` (axios interceptor never rejects on HTTP errors) or the offline queue's missing `categoryId` field (`client/utils/transactionQueue.ts`) — both already affect the existing Add Transaction screen today and are unrelated pre-existing issues; the new `quick-add` screen inherits the same behavior, not a regression.

## Design

**Why this shape:** the app is fully-managed Expo SDK 54 with no native `android`/`ios` folders committed (`.gitignore`'d as "generated" — confirmed via `expo prebuild` convention, not bare/prebuilt). EAS is already linked (`eas.json` has `development`/`preview`/`production` profiles; `app.json`'s `extra.eas.projectId` is set) but `expo-dev-client` isn't installed yet — adding any native module means Expo Go can no longer be used for local iteration; a custom dev client becomes required going forward for this app.

The existing Add Transaction flow (`client/components/main/AddTransaction/AddTransactionPage.tsx`) already does everything a quick-add screen needs: it POSTs to `/transactions/new-transaction` via `usePost` (`client/hooks/useApi.ts`), the shared axios instance reads the auth token from `AsyncStorage["token"]`, and on failure it falls back to `enqueuePendingTransactions` (`client/utils/transactionQueue.ts`, AsyncStorage key `pendingTransactions`). Categories are fetched live via TanStack Query inside `CategorySelectField.tsx` (no persistent cache exists client-side).

Because this spec's `quick-add` screen is opened via a deep link into the normal app/React tree — not a headless background task — it runs inside the existing provider stack (`QueryClientProvider`, `UserProvider`, etc.) and can reuse `usePost`, `CategorySelectField`, and the offline queue exactly as-is. This is the reason "open a screen" was chosen over "silent background add": a silent add would run outside the React tree (a widget headless JS task) and would have to hand-roll auth, category fetching, and the offline queue from scratch, with no visible feedback to the user if it silently failed (compounded by `FETCH-1`).

**Pieces:**

1. **Dependencies** (`client/package.json`): `expo-dev-client`, `react-native-android-widget` (renders widget UI from a JSX-like component tree — no hand-written Kotlin).
2. **Config plugin** (`app.json`): add `react-native-android-widget`'s config plugin to the `plugins` array (widget name, min/max size, update strategy). Confirm `app.json` has a `scheme` set for deep linking; add one if missing.
3. **Widget UI** — new `client/widgets/QuickAddWidget.tsx`: two `FlexWidget`/`TextWidget` tap targets ("+ Expense", "+ Income"), each with a `clickAction` carrying the transaction type.
4. **Widget task handler** — new `client/widget-task-handler.ts`: registered via `registerWidgetTaskHandler` in the app's entry point (`index.js`, alongside `registerRootComponent`). Handles `WIDGET_ADDED`/`WIDGET_UPDATE`/`WIDGET_CLICK`; on click, opens the app via deep link `exp+expensetracker://quick-add?type=expense` (or `income`).
5. **Quick-Add screen** — new route `client/app/quick-add.tsx`: a pared-down `AddTransactionPage`, pre-filled with `type` from the deep-link query param. Reuses the same title/amount/`CategorySelectField`/description fields and the same `usePost("/transactions/new-transaction")` + `enqueuePendingTransactions` submit logic already in `AddTransactionPage.tsx` — not a parallel implementation.
6. **Dev workflow**: `eas build --profile development --platform android` (existing profile in `eas.json`), or `npx expo prebuild` + `npx expo run:android` if a local Android SDK/emulator is available.

## Implementation notes

- Files touched: `client/package.json`, `client/app.json`, `client/index.js`, new `client/widgets/QuickAddWidget.tsx`, new `client/widget-task-handler.ts`, new `client/app/quick-add.tsx`.
- No server-side changes — `quick-add` uses the same `/transactions/new-transaction` endpoint the app already calls.
- No new AsyncStorage keys or offline-queue schema changes — reuses `pendingTransactions` as-is, including its existing lack of a `categoryId` field.
- Watch for: `react-native-android-widget`'s click-to-launch-app mechanism needs the widget's `clickAction` to resolve to an actual Android `Intent`/deep link the app's linking config (via `expo-router`) will match to the `quick-add` route with its `type` query param.

**Deviations found during implementation (all small, none changed the design above):**
- `app.json` already had `"scheme": "client"` set — no change needed there; the widget's buttons deep-link via `client://quick-add?type=expense|income`.
- The library has a built-in `clickAction="OPEN_URI"` (with `clickActionData={{ uri }}`) that opens a deep link natively, with no JS execution needed on tap. This is simpler than the original plan's "task handler opens the app on `WIDGET_CLICK` via `Linking.openURL`" — the task handler (`widget-task-handler.tsx`) now only needs to render the widget's static UI on `WIDGET_ADDED`/`WIDGET_UPDATE`/`WIDGET_RESIZED`; it has no `WIDGET_CLICK` branch at all.
- `widget-task-handler.tsx` (not `.ts`) — it returns JSX (`<Widget .../>`), which TypeScript requires a `.tsx` extension for.
- `npx expo prebuild` (run once to validate the config plugin, see below) rewrote `package.json`'s `android`/`ios` scripts from `expo start --android`/`--ios` to `expo run:android`/`expo run:ios`. Kept intentionally, not reverted — `expo start --android` opens Expo Go, which can no longer run this app now that it has native code (the widget module); `expo run:android` (build + install a dev client) is the correct replacement, consistent with this spec's "dev workflow shift" in Design.
- Widget colors are a small hardcoded palette in `widgets/QuickAddWidget.tsx`, not imported from `theme/colors.ts` — the widget renders via a headless task outside the app's React tree/`ThemeProvider`, so `useTheme()` isn't reachable there; the hardcoded hex values mirror `theme/colors.ts`'s light/dark `income`/`expense`/`surface`/`text` tokens by hand instead.

## Verify when done

- [x] Dependencies installed (`expo-dev-client@~6.0.21`, `react-native-android-widget@^0.22.1`), config plugin added, `app.json` scheme confirmed (already `"client"`, no change needed).
- [x] `yarn lint` / `npx tsc --noEmit` clean across the whole project (including the new `widgets/`, `widget-task-handler.tsx`, `app/quick-add.tsx`).
- [x] Config plugin validated via `npx expo prebuild --platform android` (run once, output inspected, then the generated `android/`/`ios/` folders were deleted — they're `.gitignore`'d, not meant to be committed): confirmed the generated `AndroidManifest.xml` registers a `.widget.QuickAdd` receiver labeled "Quick Add Transaction" with `android.appwidget.action.APPWIDGET_UPDATE`, plus `res/xml/widgetprovider_quickadd.xml` — the plugin wiring is correct.
- [ ] Dev client built (`eas build --profile development --platform android`) and installed on a device/emulator — **not run this session**, no EAS credentials/device/emulator available in this environment.
- [ ] Widget added to home screen; renders both buttons — pending the above.
- [ ] Tap "+ Expense" → app opens to `quick-add` pre-set to expense → fill amount/title/category → submit → transaction appears on Home/History — pending a real device.
- [ ] Repeat for "+ Income" — pending a real device.
- [ ] Airplane mode + tap "+ Expense" → submit falls into the same pending-transaction queue/banner behavior as a normal offline manual add today — pending a real device.
- [ ] Kill and relaunch the app → widget still works without needing to be re-added (Android `WIDGET_UPDATE` lifecycle survives app restarts) — pending a real device.

**Human verification still required** (same standing caveat as specs 10/17/18/etc.): everything above the line was checked by static analysis and a one-off prebuild inspection; the actual on-device widget behavior (rendering, tap-to-open, offline fallback, survival across app restarts) needs a real Android device or emulator, which this session didn't have access to.
