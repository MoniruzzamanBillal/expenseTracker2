# AI Workflow Rules — Client

*(This file's shape is close to identical to `server/ai context/ai-workflow-rules.md` by design — both sides need the same scoping discipline. Only the "Project-specific" section below actually differs; don't "deduplicate" the two files into one, they serve independent projects that may be handed to a session in isolation.)*

## Scoping discipline

- Stay within `client/` for client-only work. If a change requires touching the `Transaction` shape, check `server/ai context/architecture.md`'s invariant on client/server type drift before you finish — the two sides' types are hand-maintained, not shared/generated.
- Don't fix items from `known-issues.md` as a side effect of unrelated work. If you notice one while touching nearby code, flag it (mention it in your summary, and update its status in `progress-tracker.md` if you do end up fixing it) rather than silently patching it.

## Protected / handle-with-care areas

- `utils/axiosInstance.ts`'s interceptors — the error-rejection bug (`known-issues.md#FETCH-1`) has wide-reaching downstream effects; don't touch this file without reading that entry first, and don't assume any existing `onError`/`catch` around a mutation currently does anything.
- `context/user.context.tsx` and the AsyncStorage key literals it shares (informally) with `axiosInstance.ts` — changing a key name means updating three files, not one (`known-issues.md#AUTH-3`).
- The three enum-definition sites for income/expense (`known-issues.md#TYPE-1`) — new code should only ever read from `constants/TransactionType.constant.ts`.
- `types/Transaction.tyes.ts` — the filename typo is load-bearing across ~13 files; a rename is a full-repo-grep change, not a quick fix.

## Verify-before-moving-on checklist

- [ ] Did you import the income/expense enum from `constants/TransactionType.constant.ts` rather than one of the other two copies?
- [ ] If you touched `Transaction`'s shape on the client, did you check whether the server's `transaction.interface.ts` needs the same change?
- [ ] Did you avoid adding a new `try/catch` around a mutation that will silently never fire under the current interceptor bug?
- [ ] If you touched a pull-to-refresh handler, did you `await refetch()` before clearing the refreshing state (unlike the existing pattern — `known-issues.md#FETCH-6`)?
- [ ] Did you update `progress-tracker.md` if you closed or opened a known gap?

## Documentation sync

Link to `known-issues.md` by ID (`FETCH-1`, `TYPE-1`, etc.) in commit messages, PR descriptions, or code comments — don't restate the issue's description there. When you actually fix something tracked in `known-issues.md`, update its status in `progress-tracker.md`'s Known Gaps checklist rather than just deleting the row silently; leave the entry in `known-issues.md` itself for history unless the whole file is being reorganized.
