# AI Workflow Rules — xpns

## Scoping discipline

- This app's `Transaction`/`IUser` shapes (`types/`) are hand-maintained against whatever server it points at — there's no shared/generated types package. If you change a payload shape here, check the server's contract before finishing.
- Don't fix items from `known-issues.md` as a side effect of unrelated work. If you notice one while touching nearby code, flag it in your summary (and update `progress-tracker.md` if you do end up fixing it) rather than silently patching it.
- This is a **visual-design-first** codebase — it exists to carry the Claude Design handoff's dark/light design system (`theme/`) faithfully. Before changing a screen's layout/spacing/color, check the design source in the repo root (`project/Expense Tracker Design.dc.html`) rather than guessing.

## Protected / handle-with-care areas

- `theme/colors.ts` / `theme/typography.ts` / `theme/spacing.ts` — the single source of truth for every color/font-size/spacing value in the app. A new screen should compose these tokens, not introduce parallel ones.
- `utils/axiosInstance.ts`'s interceptors — the JWT attach + 401 handling + error-toast/reject logic is relied on by every screen's error handling. Read `architecture.md`'s "Data-fetching pipeline" section before changing it.
- `constants/TransactionType.constant.ts` — the only source for the income/expense enum. Don't add a second copy anywhere, ever.
- `utils/AuthGuard.tsx` and the `"user"`/`"token"` AsyncStorage key literals it shares (informally) with `context/user.context.tsx` and `utils/axiosInstance.ts` — changing a key name means updating all three call sites.

## Verify-before-moving-on checklist

- [ ] Did every new color come from `useTheme()` (or `theme/colors.ts` directly), not a hardcoded hex?
- [ ] Did you import the income/expense enum from `constants/TransactionType.constant.ts`?
- [ ] If you added a new data-fetching call, did you go through `hooks/useApi.ts` rather than calling `utils/api.ts`/`axiosInstance` directly?
- [ ] If you touched a mutation's query-key invalidation list, did you check every screen that reads that key (`daily-transaction`, `monthly-transaction`, `weekly-transaction`, `yearly-transaction` all change together on any transaction write)?
- [ ] Did you update `progress-tracker.md` if you closed or opened a known gap?

## Documentation sync

Link to `known-issues.md` by ID in commit messages, PR descriptions, or code comments — don't restate the issue's description there. When you fix something tracked in `known-issues.md`, update its status in `progress-tracker.md`'s Known Gaps checklist rather than deleting the row silently.
