# ExpenseTracker — Nocturne redesign (handoff for Claude Code)

Apply this design to the Expo app in `client/`. The server (`server/`) is unchanged.

## Read in this order
1. `01 Foundations.dc.html` — tokens (paste-ready `colors.ts`, `typography.ts`, `spacing.ts` inside the `c_dc_js` logic block: `colorsTs`, `typeTs`, `spacingTs`), navigation map, shared component spec, and backend gaps.
2. `02 Today and Capture.dc.html` — Today (index), Add, receipt flow, Smart Add, Quick Add, Android widget.
3. `03 Review and Manage.dc.html` — Activity (monthlyTransactions), Insights (history + trend), Budgets, Requests, Settings, Auth.
4. Child pieces: `TxRow` (TransactionCard), `TabBar` ((tabs)/_layout), `StatePhone` (empty/loading/error pattern), `Status` (mock status bar only — ignore).

Each screen section has a "Build notes" column: endpoint, field → element mapping, and deliberate divergences. Phone labels (H1, A4, RQ2…) are stable IDs.

## Translating the mockup HTML to React Native
- The mockups are HTML with inline styles. CSS vars map to theme keys: `--ground`→background, `--card`→surface, `--muted`→surface2, `--tint`→accentDim, `--skel`→skeleton, `--accent`, `--accentText`, `--accentBorder`, `--ink`→text, `--ink2`→textSecondary, `--ink3`→textMuted, `--edge`→border, `--hair`→divider, `--pos`→income, `--neg`→expense, `--warn`→warning, `--c1..c5`→chartPalette, `--uncat`→uncategorized, `--scrim`.
- `<x-ic name="…">` = Ionicons from `@expo/vector-icons` (same name). `<i class="mdi mdi-…">` = MaterialCommunityIcons (category icons, stored in `category.icon`).
- Faded rules (`linear-gradient(90deg, transparent, …)`) → 1px `expo-linear-gradient`.
- Glow card → `elevation.glow` (accent border + accent-colored shadow, no spread).
- Charts → `react-native-gifted-charts` (BarChart, LineChart areaChart, PieChart donut). The HTML bars/SVG are visual references only.
- Tabs: Today · Activity · Add · Insights · Budgets. Budgets becomes visible; smart-add, transaction-requests, settings stay `href: null`.
- Money: `currency` constant (৳, en-IN), tabular-nums everywhere.

## Don't build
Anything in the "Needs a backend change" list in 01 — those are workarounds, not features.

`*.html` in `standalone/` are the same boards bundled for offline viewing (compressed — view in a browser, don't parse).
