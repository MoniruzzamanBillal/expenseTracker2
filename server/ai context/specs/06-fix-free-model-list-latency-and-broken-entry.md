# 06: Fix `FREE_MODELS` list — one guaranteed-broken entry, one guaranteed-timeout entry

## Goal

A full backend regression pass (auth, transaction CRUD, all four reports, bulk-add, AI parsing) was run after `FREE_MODELS` was manually expanded to 8 entries. Every non-AI endpoint passed. The AI endpoint (`POST /transactions/manage-money`) also returned a correct `201`, but took **16 seconds** — down from the ~2s baseline in `specs/04`/`05` — because the fallback loop was silently burning through several broken/slow entries before reaching a working one. Fix the list so the endpoint is both correct and fast again.

## Scope

In scope: `FREE_MODELS` in `src/app/helper/openRouter.ts` only — curating which model ids are in the list and their order. No change to `askOpenRouter`'s fallback logic itself, the prompt, `authCheck`, or any other endpoint — all of those were re-verified working in this same test pass and are untouched.

## What was found

Called each of the 8 configured models directly against OpenRouter (bypassing the app) to see real latency and error shape:

| Model | Result | Latency |
|---|---|---|
| `nvidia/nemotron-3.5-lightning:free` | OK | ~11s |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | OK | **~43s** |
| `nvidia/llama-nemotron-rerank-vl-1b-v2:free` | **400 — always fails** | ~0.4s |
| `nvidia/nemotron-3-super-120b-a12b:free` | OK | ~1.2s |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | OK (429 on an earlier pass — flaky) | ~1.4s |
| `google/gemma-4-31b-it:free` | 429 rate-limited, both test passes | ~1.6s |
| `google/gemma-4-26b-a4b-it:free` | 429 rate-limited, both test passes | ~0.7s |
| `minimax/minimax-m2.7:free` | OK | ~3.7s |

Two structural problems, not just transient flakiness:

1. **`nvidia/llama-nemotron-rerank-vl-1b-v2:free` is a rerank model, not a chat model.** OpenRouter's own error is explicit: *"is a rerank model and cannot be used with the chat/completions endpoint."* This isn't rate-limiting or downtime — every single call to `askOpenRouter` will burn one full loop iteration on a guaranteed, permanent failure for as long as this id stays in the list.
2. **`nvidia/nemotron-3-ultra-550b-a55b:free` took ~43s raw** — over double the `openRouterClient`'s own `timeout: 20_000` (20s). In the app, this model will never actually return a result to `askOpenRouter`; it will always fail via client-side timeout after burning the full 20 seconds on every request that reaches it in the fallback order. This is exactly the risk flagged (but, for this specific model id, not caught) in spec 04's design notes about not defaulting to the heaviest Nvidia model.

With both of those sitting ahead of a working model in the list, plus two of the `google/gemma-*` entries both being rate-limited on every test pass, a real request had to fall through several slow/broken attempts before landing on a model that worked — hence the observed 16s.

## Design

Curate back down to 4 models, ordered by demonstrated speed and reliability across two separate test passes:

```ts
const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.7:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
];
```

- Kept `nemotron-3-super-120b-a12b` first — fastest and consistently correct across every test.
- Kept `minimax-m2.7` second — consistently correct, moderate latency, different upstream provider than the Nvidia entries (provider diversity matters for resilience — if Nvidia's shared pool gets rate-limited, this one is unaffected).
- Kept `nemotron-3-nano-omni-30b-a3b-reasoning` third despite one flaky 429 earlier — still fast when it works, and by position 3 a single skipped attempt costs little.
- Kept one `google/gemma-4-*` variant (`26b`, the faster-to-fail one) last as a tail fallback for provider diversity, even though it was rate-limited on both passes — a 429 fails in under a second, so it costs little to keep trying, and OpenRouter's shared free-tier congestion is exactly the kind of thing that clears up on its own.
- **Removed** `nvidia/llama-nemotron-rerank-vl-1b-v2:free` — permanently incompatible with this endpoint, not a fallback candidate at all.
- **Removed** `nvidia/nemotron-3-ultra-550b-a55b:free` — real-world latency exceeds the client's own timeout; it can only ever contribute a wasted 20s, never a result.
- **Removed** `nvidia/nemotron-3.5-lightning:free` and `google/gemma-4-31b-it:free` — both work but are redundant with faster/more-reliable entries already in the trimmed list (`31b` is also the slower-to-fail duplicate of the two gemma variants); trimming keeps the worst-case fallback chain short, per spec 04's original design principle ("keep the list short").

## Implementation notes

Files touched: `server/src/app/helper/openRouter.ts` (`FREE_MODELS` array only).

Gotcha for next time: OpenRouter model catalogs include non-chat model types (rerank, embeddings, moderation) that will 400 on `/chat/completions` — don't add a new free model id to this list from the catalog listing alone; do a real chat-completion smoke call against it first, the way this spec's diagnosis did. Also sanity-check latency, not just correctness — a model that "works" but takes 40s+ is worse than one that fails fast, given the fallback loop tries entries in order.

## Verify when done

- [x] `yarn build` passes.
- [x] `POST /transactions/manage-money` (authenticated) returns `201` with correct parsed transactions, and completes in a few seconds, not 16+. (Re-tested: 1.87s.)
- [x] Full regression re-run: register/login, create/update/delete transaction, bulk-add, all four report endpoints, no-auth 401 on `manage-money` and on a protected transaction route — all still passing (these were already confirmed working before this fix; re-confirmed nothing regressed after the model-list change).
