# 38: Fix — Duplicate `@tanstack/query-core` Pulled In by the Persist Packages

> Status: **in progress (2026-10-09)** — implementation-fix spec, found **while** implementing spec 37 Step 0. Same pattern as specs 19/20.

## The problem

Spec 37 D1 says to pin both persist packages to exactly `5.90.20` "matching the installed `@tanstack/react-query`", on the assumption that this yields a single `@tanstack/query-core`. It does not:

| Package (pinned `5.90.20`)                          | Depends on                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `@tanstack/react-query@5.90.20` (already installed) | `query-core@5.90.20`                                                                    |
| `@tanstack/query-async-storage-persister@5.90.20`   | `query-core@5.90.18` (exact) + `query-persist-client-core@5.91.17`                      |
| `@tanstack/query-persist-client-core@5.91.17`       | `query-core@5.90.18` (exact)                                                            |
| `@tanstack/react-query-persist-client@5.90.20`      | `query-persist-client-core@5.91.17` (peer: `react-query ^5.90.20`)                      |

The persist packages are versioned **independently** of `query-core` — a matching version _number_ says nothing about the `query-core` they pin. Result after `yarn add`:

```
node_modules/@tanstack/query-core                                   5.90.18   ← used by the persist packages
node_modules/@tanstack/react-query/node_modules/@tanstack/query-core  5.90.20   ← used by react-query
```

Two `QueryClient`/`Query` classes. `npx tsc --noEmit` caught it immediately:

```
utils/queryClient.ts(40,7): error TS2322: Type '(query: Query) => boolean' is not assignable to …
  Property '#private' in type 'Query' refers to a different member that cannot be accessed from within type 'Query'.
```

At runtime this is the failure spec 37 warned about (class identity / `#private` checks across the two copies), so it must be fixed rather than typed around.

**Why spec 37's own check missed it:** Step 0's `find node_modules -maxdepth 4 -type d -name query-core` stops at depth 4; the nested copy is at depth 5 (`node_modules/@tanstack/react-query/node_modules/@tanstack/query-core`). The check as written can pass with two copies present.

## Options considered

1. **Pin the persist packages to the release whose pinned `query-core` is 5.90.20 — chosen.** Verified against the registry: `query-async-storage-persister@5.90.22` → `query-core 5.90.20` + `query-persist-client-core@5.91.19`; `query-persist-client-core@5.91.19` → `query-core 5.90.20`; `react-query-persist-client@5.90.22` → `query-persist-client-core 5.91.19`, peer `react-query ^5.90.20`. Everything resolves to one `query-core@5.90.20`. No package.json magic, still exact-pinned.
2. `resolutions: { "@tanstack/query-core": "5.90.20" }` — works, but forces a version on packages that declared an exact different one, and is invisible config the next upgrade has to remember. Rejected unless option 1 stops being available.
3. Upgrade `@tanstack/react-query` to match 5.90.18 — a downgrade, and an unrelated change to a shipped dependency. Rejected.

## Steps

- [x] **Step 1 — Re-pin.** `yarn add --exact @tanstack/react-query-persist-client@5.90.22 @tanstack/query-async-storage-persister@5.90.22`.
- [x] **Step 2 — Verify a single copy at any depth.** `find node_modules -type d -name query-core -path '*@tanstack*'` returns exactly one path, version 5.90.20; `grep -c '^"@tanstack/query-core@' yarn.lock` is 1.
- [x] **Step 3 — Re-run `npx tsc --noEmit`.** The `Query` `#private` error in `utils/queryClient.ts` is gone.
- [x] **Step 4 — Correct the source spec.** Spec 37 D1/Step 0 now name `5.90.22` and a depth-unbounded check, with a pointer here, so the next reader doesn't re-pin to `5.90.20`.

## Rule going forward

When react-query is upgraded, the persist packages are **not** moved to "the same version number" — pick the persist release whose `npm view <pkg>@<ver> dependencies` shows the new `query-core`, then check with the unbounded `find` above.

## Verify when done

- [x] Exactly one `@tanstack/query-core` in `node_modules` (any depth) and one entry in `yarn.lock`.
- [x] `npx tsc --noEmit` reports nothing from `utils/queryClient.ts`.
