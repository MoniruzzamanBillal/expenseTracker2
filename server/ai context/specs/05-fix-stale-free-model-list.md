# 05: Fix stale `FREE_MODELS` list from spec 04 (all three slugs retired from OpenRouter's free tier)

## Goal

`04-openrouter-resilient-ai-integration.md`'s manual end-to-end test (`POST /transactions/manage-money` with a valid token) failed with `503 AI service is busy right now, please try again shortly` — all three models in `FREE_MODELS` failed, so `askOpenRouter` exhausted its fallback loop. Root-cause it and get the endpoint actually working again.

## Scope

In scope: diagnosing why all three configured free models failed, and replacing the list with models currently live and free on OpenRouter. Nothing else from spec 04 is reopened — the choke-point helper, the prompt fix, and the `authCheck` addition were already verified separately (401-without-token check passed before this failure) and are untouched here.

## Root cause

The server log only prints `lastError` (the last model tried), which showed:

```
NotFoundError: 404 This model is unavailable for free. The paid version is available now -
use this slug instead: qwen/qwen3-next-80b-a3b-instruct
```

That alone doesn't explain the first two models also failing (`lastError` gets overwritten each iteration, hiding earlier failures). Called OpenRouter's chat completions endpoint directly, once per model, to see each one's actual response:

```
nvidia/nemotron-3-nano-30b-a3b:free   → 404 "unavailable for free ... use nvidia/nemotron-3-nano-30b-a3b"
meta-llama/llama-3.2-3b-instruct:free → 404 "unavailable for free ... use meta-llama/llama-3.2-3b-instruct"
qwen/qwen3-next-80b-a3b-instruct:free → 404 "unavailable for free ... use qwen/qwen3-next-80b-a3b-instruct"
```

All three had been retired from OpenRouter's free tier — this is exactly the model-id drift spec 04's Design section flagged as a risk ("model ids and their free-tier availability drift on OpenRouter's side over time — re-check before finalizing") but the list wasn't actually re-verified against the live catalog before implementation, only carried over from the user-supplied Bike Log reference plus reasoning about which one to keep first. This is a data problem (stale model slugs), not a bug in the fallback logic itself — the loop-and-fallback mechanism worked exactly as designed, it just had nothing valid left to fall back to.

## Design

Queried OpenRouter's live catalog (`GET /api/v1/models`, filtered to ids ending `:free`) and got 18 current free models. Test-called each candidate directly (not through the app) with both a trivial prompt and the actual extraction system prompt + a realistic input (`"Spent 250 on coffee and received salary 50000"`), and only accepted a model that returned a real, correctly-shaped JSON array:

| Model | Trivial call | Extraction call | Notes |
|---|---|---|---|
| `nvidia/nemotron-3-super-120b-a12b:free` | OK | Correct JSON array | kept |
| `minimax/minimax-m2.7:free` | OK | Correct JSON array | kept |
| `google/gemma-4-26b-a4b-it:free` | OK (first try) | `429` rate-limited (second try, seconds later) | kept anyway — the 429 is itself a live demonstration of why a 3-model fallback list matters, and it did work moments earlier |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | Returned mostly whitespace/no real content within the request | — | rejected — looks like a heavy "thinking" model that doesn't reliably return usable content within this client's needs |
| `z-ai/glm-5.2:free` | `429` rate-limited | — | rejected as a primary pick, upstream pool looked consistently busy |

New `FREE_MODELS`, in order:
```ts
const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.7:free",
  "google/gemma-4-26b-a4b-it:free",
];
```

Also added a one-line code comment above the list noting it was verified live on 2026-09-03 against OpenRouter's `/models` catalog, and that the previous list had all three entries retired — so a future session hitting the same `503` symptom checks freshness first instead of re-diagnosing from scratch.

## Implementation notes

Files touched: `server/src/app/helper/openRouter.ts` only (the `FREE_MODELS` array + a comment). No change to `askOpenRouter`'s logic, `transaction.service.ts`, or `transaction.route.ts` — those were already correct per spec 04.

Gotcha for whoever revisits this next: OpenRouter's free-tier lineup churns — don't treat this list as permanent. If `/transactions/manage-money` starts returning `503` again, check the dev server log for `openRouterClient: all free models failed` and re-run the same direct-curl-per-model diagnosis above before assuming the fallback code itself regressed.

## Verify when done

- [x] `yarn build` passes.
- [x] `POST /transactions/manage-money` with a valid token and `{"prompt":"Spent 250 on coffee and received salary 50000"}` → `201` with a correctly-shaped two-item array (one expense, one income), not a `503`.
- [x] Re-confirm the no-token case still returns `401` (make sure this fix didn't touch the auth path).
