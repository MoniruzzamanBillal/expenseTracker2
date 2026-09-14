# ExpenseTracker — Independent Feature Proposals

## Context

ExpenseTracker's domain model today is intentionally minimal: just `User` + `Transaction` (income/expense only — no categories, budgets, accounts, or recurring entries), plus one AI feature (natural-language "Smart Add"). This document proposes **new features scoped to ExpenseTracker only** — no dependency on Bike Log, no cross-project sync. Bike Log itself is also explicitly out of scope here per current direction.

These are **proposals for review, not committed specs**. Nothing here has been promoted into `client/ai context/specs/` or `server/ai context/specs/` yet — per those folders' own `00-build-plan.md` convention, a proposal only becomes a numbered spec when work is about to actually start. Use this doc to evaluate which features are worth building and in what order; bring conclusions back for further discussion before any spec is written.

Each proposal includes: the problem it solves, what it looks like in use, a rough implementation sketch (server + client), and effort/sequencing notes — enough to evaluate usefulness without committing to a design yet.

## Sequencing at a glance

```
                     ┌──────────────┐
                     │  Categories   │  (foundational)
                     └──────┬───────┘
                    ┌───────┴───────┐
                    ▼               ▼
              ┌──────────┐    ┌──────────┐
              │ Budgets   │    │ Charts &  │
              │ & alerts  │    │  trends   │
              └──────────┘    └──────────┘

  Independent of categories (can build anytime, any order):
  Receipt photos
```

Categories is the one feature that unlocks or meaningfully improves the other two, so it's the natural starting point if you want maximum leverage from the least work. Receipts don't depend on anything else and can be built standalone in any order.

---

## 1. Transaction categories

**Problem it solves:** Right now every transaction is just "income" or "expense" — there's no way to see _where_ money goes (food vs. bills vs. shopping vs. transport). You can see totals but not a breakdown.

**What it looks like in use:** When adding a transaction, pick a category from a list (Food, Bills, Transport, Shopping, Health, Entertainment, Other, ...) in addition to the income/expense type. Home/History screens can then show a per-category breakdown, not just a flat total.

**Implementation sketch:**

- **Server:** Add `category: string` (or a small enum/lookup) to the `Transaction` model (Prisma schema + the Mongoose model it's migrating from — check current cutover status in `server/ai context/progress-tracker.md` before deciding which to touch first). Add category to the existing summary endpoints' aggregation (daily/monthly/weekly/yearly) so a `categoryBreakdown` field comes back, mirroring the shape Bike Log's own spending-summary endpoint already returns (useful as a reference, not something to import).
- **Client:** A `constants/Category.constant.ts` single source of truth (learn from `known-issues.md#TYPE-1` — don't repeat the three-copies-of-an-enum mistake). Add a category picker to `AddTransactionPage.tsx` and the edit modal. Add a category filter or breakdown view to `history.tsx`/`monthlyTransactions.tsx`.

**Effort:** Medium — touches the schema, both summary endpoints, and every transaction form.

**Depends on:** Nothing. Should come first since Budgets, Charts, and AI insights all get meaningfully better once category data exists.

---

## 2. Per-category budgets with alerts

**Problem it solves:** No way to know "am I overspending on food this month" until after the fact.

**What it looks like in use:** Set a monthly limit per category (e.g., Food: ৳8,000). A progress bar shows spend-so-far vs. limit on Home or a dedicated Budgets screen; crossing 80%/100% triggers a visual warning (and later, a push notification if that infra ever gets added).

**Implementation sketch:**

- **Server:** New `Budget` model (`userId`, `category`, `monthlyLimit`). New endpoint(s): create/update budget, and a "budget status" endpoint that joins budgets against the existing category-breakdown summary for the current month.
- **Client:** New Budgets screen/tab, a progress-bar component per category, form to set/edit limits.

**Effort:** Medium. **Depends on:** Categories (#1).

---

## 3. Receipt/photo attachment on transactions

**Problem it solves:** No way to keep proof of a purchase attached to its transaction entry.

**What it looks like in use:** Optionally attach a photo when adding/editing a transaction; tap a thumbnail later to view it full-screen.

**Implementation sketch:**

- **Server:** Add an image-upload endpoint + storage (check what Bike Log's server spec for image uploads used — same cloud storage account/bucket could likely be reused rather than standing up a second one). Add an optional `receiptUrl`/`receiptUrls` field to `Transaction`.
- **Client:** Reuse the same image-picker + full-screen-viewer _pattern_ already proven in `bikelog_app` (`ImagePickerField`, `ImageViewerModal`) — not the code itself (different project), but the same library choices (`expo-image-picker`, `expo-image`) and interaction design, so there's no need to re-evaluate options from scratch.

**Effort:** Medium. **Depends on:** Nothing.

---

## 4. Charts & trends

**Problem it solves:** No visual sense of spending trends over time — only flat numbers today.

**What it looks like in use:** A trend tab showing a bar chart of monthly totals, and (once categories exist) a donut of category breakdown for the current month.

**Implementation sketch:**

- **Server:** A trend endpoint returning N months of totals (and category breakdown per month, if #1 is done) — same shape as Bike Log server's already-shipped spending-trend endpoint.
- **Client:** `react-native-gifted-charts` + `react-native-svg` — already installed, version-pinned, and proven working on Expo SDK 54 in `bikelog_app` (see its spec `18-spending-mileage-trend-charts.md` for the exact pinned versions and the donut-legend gotcha it hit and fixed in a later spec). Re-checking chart-library options from scratch isn't necessary.

**Effort:** Low-medium once a trend endpoint exists — mostly reusing a proven client pattern. **Depends on:** Categories (#1) only for the category-donut half; the bar-chart-of-totals half needs nothing else.

---

## Housekeeping worth doing alongside whichever feature you pick first

Not new features, but existing documented bugs that will undercut anything built on top of them:

- `client/ai context/known-issues.md#FETCH-1` — the axios response interceptor never rejects on HTTP errors, so every new feature's error handling will silently no-op unless this is fixed first.
- `client/ai context/known-issues.md#AUTH-2` — stale in-memory auth state after a 401 clear.
- `server/ai context/known-issues.md#AUTH-3` (per root `CLAUDE.md`) — password hashes returned in register/login responses.

None of these block starting a new feature, but #1 (FETCH-1) specifically means any new feature that relies on showing errors to the user (budget-limit errors, upload failures) will inherit a broken error path unless it's fixed first.

---

## Not included here (by request, separate discussion later)

- Any feature requiring Bike Log integration (spending sync, shared categories across apps, etc.)
- New Bike Log features
