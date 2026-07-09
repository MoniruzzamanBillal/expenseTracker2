# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

ExpenseTracker is a full-stack mobile expense-tracking app with two independent projects (no root `package.json`/workspace — each has its own dependencies and must be worked on from within its own directory):

- `client/` — Expo (React Native) app using file-based routing (`expo-router`).
- `server/` — Express + Mongoose REST API, deployed to Vercel as a serverless function.

## Common commands

### server (run from `server/`)
- `yarn dev` — run the API locally with `ts-node-dev` (auto-restart, transpile-only).
- `yarn build` — compile TypeScript to `dist/` (`tsc`).
- `yarn start:prod` — run the compiled server (`node ./dist/server.js`).
- `yarn lint` / `yarn lint:fix` — ESLint over `src`.
- `yarn prettier` / `yarn prettier:fix` — format `src`.
- There is no real test suite (`yarn test` is a stub that exits with an error).

### client (run from `client/`)
- `yarn start` or `yarn dev` — start the Expo dev server.
- `yarn android` / `yarn ios` / `yarn web` — start targeting a specific platform.
- `yarn lint` — `expo lint`.
- `yarn reset-project` — Expo's scaffolding reset script (moves current `app/` to `app-example/` and creates a blank one); do not run this unless explicitly asked.

There is no root-level lint/build/test command — always `cd` into `client` or `server` first.

## Architecture

### Server (`server/src`)

Standard route → controller → service → model layering, organized by feature module under `src/app/modules/<feature>/`:

- `<feature>.route.ts` — Express router; wires `authCheck` and `validateRequest` middleware before controllers.
- `<feature>.controller.ts` — thin handlers wrapped in `catchAsync` (util/catchAsync.ts), calling into services and replying via `sendResponse` (util/sendResponse.ts) with a consistent `{ success, message, data, token? }` shape.
- `<feature>.service.ts` — business logic and all Mongoose queries.
- `<feature>.model.ts` / `<feature>.interface.ts` / `<feature>.validation.ts` (Zod) / `<feature>.constant.ts`.

Currently two modules: `transaction` and `user`. `src/app/router/index.ts` mounts each module's router under a path prefix (`/api/transactions`, `/api/auth` — see `src/app/app.ts`'s `app.use("/api", MainRouter)`).

Cross-cutting pieces:
- `middleware/authCheck.ts` — verifies the `Authorization: Bearer <jwt>` header and attaches the decoded payload to `req.user` (`{ userId, userEmail }`). Most transaction routes require it; note `POST /transactions/manage-money` (AI parsing endpoint) is intentionally **not** behind `authCheck`.
- `middleware/validateRequest.ts` — runs a Zod schema against `{ body: req.body }`.
- `middleware/globalErrorHandler.ts` — central error formatter. Recognizes `ZodError`, Mongoose `ValidationError`/`CastError`, duplicate-key errors (`code === 11000`), and the custom `AppError` (`Error/AppError.ts`, carries an HTTP `status`). Anything else falls through as a generic 500.
- `builder/Queryuilder.ts` (`Queryuilder` class — note the intentional/typo'd name) — a chainable Mongoose query helper (search/filter/sort/pagination/field-selection) available for list endpoints, though the transaction service currently builds most date-range queries by hand rather than using it.
- `helper/openRouter.ts` — an `openai` SDK client pointed at OpenRouter's API (`baseURL: https://openrouter.ai/api/v1`), used by `transactionServices.moneyManagement` to turn a natural-language prompt into structured `{ type, amount, title, description }` transaction objects via a large system prompt. The model id is hardcoded in `transaction.service.ts`.
- `config/index.ts` loads `.env` (via `dotenv`) and exposes `port`, `database_url`, `jwt_secret`, `openRouterApiKey`.

Transaction date-range logic (monthly/daily/yearly/weekly summaries) is all computed in `transaction.service.ts` using UTC dates — the "week" is defined as Friday–Thursday (see `getWeeklySummary`'s Friday-anchored offset), not the ISO Monday-start week. Soft-delete is used throughout (`isDeleted` flag; queries filter `isDeleted: false`, delete endpoints just flip the flag).

Server TS has no `@/*` path alias — imports are relative. `dist/` is committed build output; don't hand-edit it.

### Client (`client/`)

Expo Router file-based routing under `app/`. `@/*` resolves to the `client/` root (see `tsconfig.json`).

- `app/_layout.tsx` — root provider stack (order matters): `SafeAreaProvider` → `KeyboardProvider` → `QueryClientProvider` (TanStack Query) → `GestureHandlerRootView` → `PaperProvider` (react-native-paper) → `UserProvider` (`context/user.context.tsx`) → `<Slot />` + `<Toast />`.
- `app/(tabs)/` — the authenticated tab group; `(tabs)/_layout.tsx` wraps all tabs in `utils/AuthGuard.tsx`, which redirects to `/auth` when there's no user and back to `/` when an authenticated user hits an auth page.
- `app/auth.tsx`, `app/register.tsx` — login/register screens outside the tab group.
- `context/user.context.tsx` — `UserProvider`/`useUserContext` hold `user`/`token` in state, persisted to `AsyncStorage` (keys `"user"`, `"token"`); `logoutFunction` clears both.
- `utils/axiosInstance.ts` — shared Axios instance: request interceptor attaches the stored JWT as `Authorization: Bearer <token>` and sets the right `Content-Type` for `FormData` vs JSON; response interceptor unwraps to `{ data, meta }`, shows errors via `react-native-toast-message`, and on a 401 clears storage and redirects to `/auth`.
- `utils/api.ts` — thin `apiGet/apiPost/apiPut/apiPatch/apiDelete` wrappers over `axiosInstance`.
- `hooks/useApi.ts` — TanStack Query wrappers (`useFetchData`, `usePost`, `useUpdateData`, `usePatch`, `useDeleteData`) that layer query-key invalidation onto the `utils/api.ts` functions. Prefer these over calling `axiosInstance`/`utils/api.ts` directly from components.
- `utils/envConfig.ts` — `getBaseUrl()` returns a **hardcoded** production URL (`https://exp2server.vercel.app/api`); the localhost alternative is left commented out. Swap this manually when developing against a local server.
- `components/main/` — feature/page-specific components grouped by screen (`Home`, `AddTransaction`, `MonthlyTransaction`, `HistoryPage`, `weeklyTransactionsPage`, `smartAdd`, `shared`), separate from the generic/presentational `components/` (themed-text, themed-view, parallax-scroll-view, ui/) at the top level.
- `constants/TransactionType.constant.ts` and `types/Transaction.tyes.ts` (filename typo, not a mistake to "fix" reflexively — check for other references first) define the shared transaction shape/enum used across screens; keep them in sync with the server's `transaction.constant.ts`/`transaction.interface.ts` (income/expense enum, field names) since there's no shared/generated types package between client and server.
