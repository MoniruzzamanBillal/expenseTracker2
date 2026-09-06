# 04: Resilient OpenRouter integration (multi-model fallback choke point)

## Goal

Replace the current single-model, no-fallback OpenRouter call in the AI transaction-parsing feature with a shared `askOpenRouter` helper — modeled on the pattern already proven in the user's other project (Bike Log) — that tries a list of free models in order and falls back automatically when one is rate-limited or down, instead of failing the whole request the moment the single hardcoded model has a bad moment.

## Scope

**In scope:**
- New shared choke-point helper in `src/app/helper/openRouter.ts`: typed chat-message/options shapes, a configured `OpenAI` client (timeout, disabled SDK-level retries, OpenRouter attribution headers), an ordered free-model fallback list, and the `askOpenRouter(messages, options)` function every AI feature must call through.
- Rewire `transaction.service.ts`'s `moneyManagement` to call `askOpenRouter` instead of constructing its own single-model `openai.chat.completions.create` request.
- While that function is being rewritten anyway, three directly-related, already-flagged issues in the exact lines being touched (`known-issues.md`):
  - **AI-1** — the system prompt string is textually corrupted (a model-id string got pasted over two spots in the prompt text by an apparent find-and-replace: `"cashnvidia/nemotron-3-nano-30b-a3b:freeback"` and a stray model id mid-sentence between the amount bullets and the "Title Generation" heading). Fixed as part of retyping the prompt.
  - **AI-5** — hardcoded model id with two dead commented-out alternatives above it. Superseded by the `FREE_MODELS` list.
  - **AI-3** — `temperature: 0.7` for what's meant to be deterministic structured-JSON extraction. Lowered for this call.
  - **AI-4** (incidental, not separately engineered) — unsafe `response.choices[0]` indexing with no empty-check. Resolved as a side effect of `askOpenRouter`'s existing `if (!content) throw ...` guard, which already covers an empty/missing `choices` array.
- **AUTH-2** — `POST /transactions/manage-money` has no `authCheck`, unlike every other transaction route, and is a live unauthenticated cost/abuse vector against the OpenRouter key. One-line fix (`authCheck` middleware), same route being touched by this spec, and already ranked #1 in `progress-tracker.md`'s Next Up list — bundled here rather than left dangling.

**Explicitly out of scope (flag in `progress-tracker.md`, do not touch):**
- **AI-2** — no schema validation on the parsed AI output (not an array of `{type, amount, title, description}` guaranteed, no markdown-fence stripping). This is downstream of the AI call itself, not part of "the integration" — separate spec if picked up.
- **VALID-1** — `/many-transaction` has zero request validation.
- Any change to the client (`client/`).
- Any other AI call site — there is only one (`moneyManagement`); nothing else in this codebase talks to OpenRouter today, so there's no second consumer to migrate onto the shared helper.

## Design

### `src/app/helper/openRouter.ts` (rewritten)

Mirrors the Bike Log pattern the user pasted, adapted to this project's error type (`AppError`) and naming:

```ts
import httpStatus from "http-status";
import OpenAI from "openai";
import AppError from "../Error/AppError";
import config from "../config";

export type TChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type TAskOptions = {
  jsonMode?: boolean;
  temperature?: number;
};

const openRouterClient = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.openRouterApiKey,
  timeout: 20_000,
  maxRetries: 0,
  defaultHeaders: {
    // ! placeholder — swap for the deployed server URL once one is settled on
    "HTTP-Referer": "https://expensetracker-server.vercel.app",
    "X-Title": "Expense Tracker",
  },
});

// ! free models to try in order - if one is rate limited/down, fall back to the next
const FREE_MODELS = [
  "nvidia/nemotron-3-nano-30b-a3b:free", // already proven working for this feature — keep first
  "meta-llama/llama-3.2-3b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
];

// ! single choke point every ai feature talks through
export const askOpenRouter = async (
  messages: TChatMessage[],
  options?: TAskOptions,
): Promise<string> => {
  let lastError: unknown;

  for (const model of FREE_MODELS) {
    try {
      const response = await openRouterClient.chat.completions.create({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        ...(options?.jsonMode
          ? { response_format: { type: "json_object" as const } }
          : {}),
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("Empty response from model");
      }

      return content;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  console.error("openRouterClient: all free models failed", lastError);

  throw new AppError(
    httpStatus.SERVICE_UNAVAILABLE,
    "AI service is busy right now, please try again shortly",
  );
};
```

Do **not** also export the raw `openRouterClient` — the whole point of the choke point is that nothing outside this file talks to OpenRouter directly, so a future second AI feature is forced through the same fallback/timeout/header behavior instead of quietly re-implementing (or forgetting) it.

**`FREE_MODELS` list — reasoning, not copied blindly from Bike Log:**
- Kept `nvidia/nemotron-3-nano-30b-a3b:free` first since it's the model already live and working for this exact extraction task today — no behavior change for the common case.
- Dropped Bike Log's `nvidia/nemotron-3-ultra-550b-a55b:free` from the top slot — a much heavier model is not obviously better for short structured-extraction prompts and may carry tighter free-tier rate limits; not worth the risk as the primary choice for this feature. Left out entirely rather than added as a 4th fallback, to keep the list short — add it back if real-world fallback exhaustion is observed.
- Model ids and their free-tier availability drift on OpenRouter's side over time — before finalizing, re-check `https://openrouter.ai/models?max_price=0` that all three ids are still live and still free.

**`jsonMode` — do not enable it for `moneyManagement`'s call.** OpenRouter's `response_format: { type: "json_object" }` requires the model to emit a top-level JSON *object*; the extraction prompt's contract is a top-level JSON *array*. Enabling `jsonMode: true` here without also restructuring the prompt and parser to something like `{"transactions": [...]}` would break on models that enforce the object constraint strictly. Leave `moneyManagement`'s call as free-form text + `JSON.parse` (unchanged behavior from today) — restructuring to use `jsonMode` is a reasonable follow-up but is its own decision, not bundled into this spec.

### `src/app/modules/transaction/transaction.service.ts` — `moneyManagement`

- Replace the import: `import { openai } from "../../helper/openRouter"` → `import { askOpenRouter } from "../../helper/openRouter"`.
- Replace the whole `openai.chat.completions.create({...})` call + manual `response.choices[0].message?.content` read with:
  ```ts
  const rawResponse = await askOpenRouter(
    [
      { role: "system", content: /* corrected prompt, see below */ },
      { role: "user", content: `Text: "${prompt}"` },
    ],
    { temperature: 0.2 },
  );
  ```
- `temperature: 0.2` (was `0.7`) — this is structured-JSON extraction where determinism matters more than creative variance (AI-3).
- Retype the system prompt content, fixing the two corruption spots verbatim:
  - `"cashnvidia/nemotron-3-nano-30b-a3b:freeback"` → `"cashback"`.
  - The stray `nvidia/nemotron-3-nano-30b-a3b:free` line sitting between the amount-detection bullets and the `### 3. Title Generation` heading → deleted, restoring the original sentence flow.
  - Do not otherwise rewrite the prompt's wording/rules — only remove the corruption, to keep this a scoped fix rather than a prompt-quality rewrite.
- The rest of the function (the `try { JSON.parse(rawResponse) } catch { throw AppError(...) }` block and `return parsed`) is unchanged — `askOpenRouter` returns the same `string` shape `response.choices[0].message?.content` used to.

### `src/app/modules/transaction/transaction.route.ts`

- Line 53: `router.post("/manage-money", transactionControllers.moneyManagement)` → `router.post("/manage-money", authCheck, transactionControllers.moneyManagement)`. `authCheck` is already imported in this file (used by every other route) — no new import needed.
- No signature change needed in the controller or service: `moneyManagement` only ever parses free text into transaction shapes and doesn't persist anything against `userId`, so adding auth is purely a gate, not a data-shape change.

## Implementation notes

Files touched:
- `server/src/app/helper/openRouter.ts` — rewritten (raw client export removed, `askOpenRouter` added).
- `server/src/app/modules/transaction/transaction.service.ts` — `moneyManagement` rewritten to call the helper; corrected prompt string; import updated.
- `server/src/app/modules/transaction/transaction.route.ts` — one-line `authCheck` addition to `/manage-money`.

Gotchas:
- `config.openRouterApiKey` (lowercase env var name, `process.env.openRouterApiKey`) is pre-existing and unconventional — not in scope to rename, keep as-is.
- `maxRetries: 0` on the `OpenAI` client is deliberate: the SDK's own retry logic retries the *same* model on transient failure, which is redundant with (and would multiply request volume against) this helper's own retry-via-*different*-model loop across `FREE_MODELS`.
- After this change, `openai` (the raw client) should have zero remaining imports anywhere outside `helper/openRouter.ts` — grep for it to confirm the choke point is actually being respected, not just added alongside the old export.

## Verify when done

- [x] `yarn build` (tsc) passes with no errors.
- [x] `yarn lint` clean on every file this spec touches — one new warning (`no-console` in `helper/openRouter.ts`, matching the pasted reference implementation's operational logging on total failure); no new errors. 4 pre-existing errors remain elsewhere, untouched by this spec (same set noted in spec 02).
- [x] `grep -rn "helper/openRouter" src` shows only `transaction.service.ts` importing `askOpenRouter` (and the helper file itself) — no remaining import of a raw `openai` client from this path.
- [x] `POST /transactions/manage-money` with **no** `Authorization` header → `401`, confirming AUTH-2 is fixed.
- [x] `POST /transactions/manage-money` with a valid token and a body like `{"prompt": "Spent 250 on coffee and received salary 50000"}` → `201` with a parsed array containing one expense and one income transaction — confirms extraction still works end-to-end through the new helper. (First attempt hit a `503` because the originally-planned `FREE_MODELS` list had all been retired from OpenRouter's free tier since the spec was written — root-caused and fixed under `05-fix-stale-free-model-list.md`; passed after that fix.)
- [x] Temporarily set the first entry of `FREE_MODELS` to a deliberately invalid model id, re-run the same request, confirm it still succeeds via fallback (proves the fallback loop actually triggers, not just that it compiles) — then revert the deliberate breakage. Confirmed: request still returned `201` with the invalid id first in the list.
- [x] Open `transaction.service.ts` and visually confirm the system prompt string no longer contains any `nvidia/nemotron-3-nano-30b-a3b:free` substring embedded in its text.
- [x] Update `progress-tracker.md`: register this spec in the Spec status table; mark `AUTH-2`, `AI-1`, `AI-3`, `AI-4`, `AI-5` resolved in Known Gaps (with this spec's filename as the reference, per the existing convention for `AUTH-1`/`AUTH-10`); leave `AI-2`/`VALID-1` open and unchanged.
