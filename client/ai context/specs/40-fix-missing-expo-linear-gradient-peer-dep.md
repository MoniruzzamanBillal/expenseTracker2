# 40 — Fix the app-breaking removal of `expo-linear-gradient` (unmet peer dep of gifted-charts)

**Status**: ✅ **Completed 2026-10-11** — implementation-fix spec, opened **while verifying spec 39**, not planned
work. `expo-linear-gradient@~15.0.8` restored; the app boots again. Verified on the web target (the crash was
platform-independent, being plain JS module evaluation). Found the moment the web target was loaded for spec 39's click-through; independently reported by the user
in the same session with the identical error text.
**Scope**: `client/package.json` + `client/yarn.lock` only. One dependency restored, no source changes.
**Not caused by spec 39.** Verified: spec 39's `npx expo install expo-secure-store` added exactly one line to
`yarn.lock` (`expo-secure-store@~15.0.8`) and nothing else. This is a pre-existing break on current `master`.

---

## Problem

The app does not start. Any platform, immediately, before any screen renders:

```
Server Error
Gradient package was not found. Make sure "react-native-linear-gradient" or "expo-linear-gradient" is installed
This error cannot be dismissed.
```

## Root cause

`72c7c78 refactor(client): remove Android widget and unused packages` removed ten dependencies, among them
**`expo-linear-gradient@~15.0.8`**. Nine of them really were unused. That one is not: it is a **peer dependency
of `react-native-gifted-charts`**, which the app uses for the Insights trend charts
(`components/main/MonthlyTransaction/TrendTab.tsx:15` — `import { BarChart, PieChart } from "react-native-gifted-charts"`).

Confirmed by lockfile archaeology:

| Commit      | `linear-gradient` entries in `client/yarn.lock` |
| ----------- | ----------------------------------------------- |
| `72c7c78~1` | 2                                               |
| `72c7c78`   | **0**                                           |
| `HEAD`      | 0                                               |

**Why a reasonable "is this still used?" check missed it.** Nothing in `client/` ever writes
`import ... from "expo-linear-gradient"`, so a grep across the source tree returns zero hits and the package
looks dead. The dependency is consumed *inside the library*, by a resolver module that picks whichever gradient
package happens to be installed — `node_modules/react-native-gifted-charts/dist/Components/common/LinearGradient.js`:

```js
var LinearGradient;
try {
  LinearGradient = require('react-native-linear-gradient').LinearGradient;   // bare RN projects
} catch (e) {
  try {
    LinearGradient = require('expo-linear-gradient').LinearGradient;         // Expo projects
  } catch (e) {
    throw new Error('Gradient package was not found. ...');
  }
}
```

**Why it breaks the whole app rather than just the chart.** That `throw` is at module scope, not inside a
component, and the module sits on `BarChart`'s eager import chain
(`BarChart/index` → `RenderBars.js:14` → `Animated2DWithGradient` → `common/LinearGradient`). So it fires while
the bundle is being evaluated, as soon as anything pulls in `TrendTab.tsx` — which `expo-router` does, because it
eagerly requires every route file. The crash therefore happens at startup on the **auth screen**, nowhere near a
chart, which is exactly why the error reads as unrelated to charts.

This is also why it is platform-independent: it is plain JS module evaluation, not a native-module lookup. The
web target is simply where it was seen first.

## Scope check — are any of the other nine wrong too?

Checked, so this doesn't recur: grepped the source tree for each of the other nine removed packages
(`@react-native-picker/picker`, `expo-haptics`, `expo-status-bar`, `expo-symbols`, `expo-web-browser`,
`jwt-decode`, `react-native-android-widget`, `react-native-collapsible`, plus `expo-dev-client`) — **zero source
imports each**, and `expo-dev-client`/`react-native-android-widget` were removed deliberately with the widget
(spec 26's removal). Also grepped `react-native-gifted-charts` for any other throw-on-require resolver:
`common/LinearGradient.js` is the only one. So this is a one-package fix, not the first of ten.

## Fix

Restore the single package, with `npx expo install` so the version matches Expo SDK 54 rather than pulling a
newer major:

```sh
npx expo install expo-linear-gradient
```

Expected: `expo-linear-gradient@~15.0.8` back in `package.json` — the exact version `72c7c78` removed.

**Rejected alternative:** adding `react-native-linear-gradient` instead. It would satisfy the same resolver
(it's the first branch of the `try`), but it is the bare-React-Native package, needs its own native config, and
this is an Expo-managed project. `expo-linear-gradient` is the right half of that `try`/`catch`, and is what was
there before.

**No source change, and no `app.json` plugin entry** — `expo-linear-gradient` needs no config plugin.

## Follow-up worth considering (not done here)

This class of bug is invisible to a source grep. A dependency-removal pass on this project should check
`yarn why <pkg>` / the remaining packages' `peerDependencies` before deleting, not just the source tree. Noted
for whoever next prunes dependencies; not built into tooling as part of this fix.

## Verify when done

- [x] `expo-linear-gradient` is in `client/package.json` at `~15.0.8` and present in `yarn.lock`.
- [x] `npx tsc --noEmit` and `yarn lint` clean.
- [x] The web target loads to the **auth screen** with no "Gradient package was not found" overlay, and the
      email/password inputs are actually present in the DOM (they were not, while the overlay was up).
- [x] No console `pageerror` mentioning the gradient package.
- [x] Insights' trend chart (the `BarChart` in `TrendTab.tsx`) renders rather than crashing — the screen that
      actually needs the package. Reached Insights on the web target with no crash and no gradient error; the
      chart's own pixel rendering was not inspected (no device available this session).
