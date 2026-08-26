# Project Overview — Server

## What this is

The REST API for ExpenseTracker, a personal income/expense tracking app. Express + Mongoose + TypeScript, deployed to Vercel as a serverless function. Consumed by the Expo/React Native client in `client/` (a fully independent project — see the root `CLAUDE.md`).

## Tech stack

- **Framework**: Express 4, TypeScript
- **Database**: MongoDB via Mongoose
- **Auth**: JWT bearer tokens, `argon2` password hashing
- **AI**: OpenRouter (via the `openai` SDK) for natural-language transaction parsing
- **Hosting**: Vercel serverless (`dist/server.js`)
- **Validation**: Zod

## Module map

| Module | Route prefix | Purpose |
|---|---|---|
| `user` | `/api/auth` | register, login |
| `transaction` | `/api/transactions` | CRUD + daily/monthly/weekly/yearly summaries + AI-assisted bulk entry |

## Domain model at a glance

Two collections only: `User` and `Transaction`. `Transaction.user` references `User` by ObjectId; there is no third domain entity (no categories, budgets, accounts, etc. — the model is intentionally minimal).

## Not a typical long-running Express app

This is a Vercel serverless function — every request potentially cold-starts. See `architecture.md`'s "Serverless considerations" for what that implies about the current Mongoose connection handling.

For layering, the auth model, the AI parsing subsystem, and the full list of numbered invariants, read `architecture.md` next.
