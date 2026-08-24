# Code Standards — Server

## File naming (current pattern + flagged exceptions)

Each feature module under `src/app/modules/<feature>/` follows: `<feature>.route.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.model.ts`, `<feature>.interface.ts`, `<feature>.validation.ts`, `<feature>.constant.ts`.

**Do not silently "fix" these to match a convention** — they're existing, working code, and normalizing them is a separate, deliberate refactor, not a side effect of an unrelated change:
- `user.services.ts` is plural; `transaction.service.ts` is singular. Match whichever file you're already in.
- `builder/Queryuilder.ts` — typo'd filename and class name (`Queryuilder`), and it's unused. Don't import it into new code; don't rename it as a drive-by.
- `user.controller.ts`'s local const/export `crateUser` is a typo for `createUser`. The service method it calls is correctly spelled.

## Validation pattern

Zod schemas live in `<feature>.validation.ts`, wired via the `validateRequest` middleware in the route file, and only ever validate `req.body` (never `params`/`query` — see `known-issues.md#VALID-3`). Two write endpoints currently ship with **no** validation at all: `POST /transactions/many-transaction` and `POST /transactions/manage-money` (`known-issues.md#VALID-1`, `#VALID-2`). If you add a new write endpoint, give it a Zod schema — don't follow those two as precedent.

## Error handling pattern

`catchAsync` (`util/catchAsync.ts`) wraps every controller so thrown/rejected errors reach `globalErrorHandler.ts`. Throw `AppError(status, message)` (`Error/AppError.ts`) for expected business-logic failures (e.g. "transaction not found"). The global handler currently returns a stack trace on every response regardless of environment — don't add sensitive detail to an error's `message` assuming it stays server-side (`known-issues.md#ERR-1`). Full behavior and gaps: `known-issues.md`'s `ERR-` section — don't re-derive it here.

## Response envelope

`sendResponse` (`util/sendResponse.ts`) produces `{ success, message, data, token? }`. Follow this shape for any new endpoint.

## Testing

There is no test suite. `yarn test` is a stub that exits with an error. Don't assume any existing behavior is covered by tests — verify manually (`yarn dev` + a REST client) before and after a change.

## Adding a new module — naming checklist going forward

- `<feature>.route.ts`/`.controller.ts`/`.service.ts` (singular, matching `transaction`'s convention, not `user`'s)
- Mount the route prefix to match the folder name unless there's a strong reason not to (the `user`→`/api/auth` mismatch is legacy, not a pattern to repeat — `known-issues.md#NAME-3`)
- Give every write endpoint a Zod schema covering `body` at minimum
- Use `AppError` for expected failures; let unexpected ones fall through to the generic 500 path
