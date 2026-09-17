# 19: Fix stale `useCategories()` reference in spec 16 (Budgets)

Status: 🔧 Implementation fix — discovered while implementing `16-budgets-screen.md`, not a new feature.

## Problem

`16-budgets-screen.md`'s Design §4 (`BudgetsPage.tsx`) reads:

> `useBudgets()` for the list; `useCategories()` (spec 12) for the "categories without a budget yet" set used by the create modal.

`useCategories()` does not exist and was never supposed to: `12-category-management-ui.md` and `13-wire-category-to-transaction-ui.md` both explicitly decided **against** a dedicated per-domain `useCategories.ts` wrapper hook — categories are fetched via a direct `useFetchData<TCategory[]>(["categories"], "/categories")` call inline in whichever component needs them (`CategoryManager.tsx`, `CategoryPicker.tsx` both already do this). The `useCategories()` mention in spec 16 is a leftover from before that decision was made for specs 12/13 — the 2026-09-14 doc revision (`docs(client/specs): drop dedicated useCategories hook...`) updated 12 and 13 but missed this one mention in 16.

## Fix

`BudgetsPage.tsx` calls `useFetchData<TCategory[]>(["categories"], "/categories")` directly, exactly the same way `CategoryManager.tsx`/`CategoryPicker.tsx` already do — no new hook file. Everything else in spec 16 (`useBudgets`, `useCreateBudget`, `useUpdateBudget`, `useDeleteBudget` in `hooks/useBudgets.ts`) is implemented exactly as written; only this one inline fetch call in `BudgetsPage.tsx` deviates from the spec's literal text to match the actual, already-established project convention.

## Verify

- [x] `BudgetsPage.tsx` contains no `useCategories` import/call — grep confirms.
- [x] The unbudgeted-category set (`categories.filter(c => !budgets.some(b => b.categoryId === c._id))`) is still computed correctly from the direct fetch's result.
