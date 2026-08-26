# AI Workflow Rules — Server

*(This file's shape is close to identical to `client/ai context/ai-workflow-rules.md` by design — both sides need the same scoping discipline. Only the "Project-specific" section below actually differs; don't "deduplicate" the two files into one, they serve independent projects that may be handed to a session in isolation.)*

## Scoping discipline

- Stay within `server/` for server-only work. If a change requires touching the `Transaction`/`User` shape (fields, enum values), check `client/ai context/architecture.md`'s invariant on client/server type drift before you finish — the two sides' types are hand-maintained, not shared/generated.
- Don't fix items from `known-issues.md` as a side effect of unrelated work. If you notice one while touching nearby code, flag it (mention it in your summary, and update its status in `progress-tracker.md` if you do end up fixing it) rather than silently patching it.

## Protected / handle-with-care areas

- `middleware/authCheck.ts` — any change here affects every protected route at once.
- Transaction ownership logic (`updateTransaction`/`deleteTransactionData` in `transaction.service.ts`) — currently has no ownership check at all (`known-issues.md#AUTH-1`); if you're asked to add one, make sure both the service *and* the controller (which needs to start passing `req.user.userId` through) change together.
- `config/index.ts` — adding a new field here without adding it to `.env.example`/docs is how the existing dead-env-var drift (`known-issues.md#CFG-3`) happened.
- The AI system prompt string in `transaction.service.ts`'s `moneyManagement` — it currently contains a text-corruption bug (`known-issues.md#AI-1`). Read that entry before touching the prompt so you don't accidentally "clean up" formatting while leaving the actual corruption in place, or vice versa.

## Verify-before-moving-on checklist

- [ ] If you added or changed a mutation endpoint: does it check the caller owns the resource?
- [ ] If you touched the `Transaction` schema/interface/validation: do the interface, Mongoose schema, and Zod schema still agree on what's required?
- [ ] If you touched error handling: did you avoid adding a new unconditional stack-trace or raw-driver-message leak?
- [ ] If you touched `moneyManagement`'s response handling: did you add/keep a guard for `choices[0]` being empty?
- [ ] Did you update `progress-tracker.md` if you closed or opened a known gap?

## Documentation sync

Link to `known-issues.md` by ID (`AUTH-1`, `ERR-2`, etc.) in commit messages, PR descriptions, or code comments — don't restate the issue's description there. When you actually fix something tracked in `known-issues.md`, update its status in `progress-tracker.md`'s Known Gaps checklist rather than just deleting the row silently; leave the entry in `known-issues.md` itself for history unless the whole file is being reorganized.
