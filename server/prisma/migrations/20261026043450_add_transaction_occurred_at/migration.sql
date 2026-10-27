-- Add the user-editable transaction date. Existing rows had no concept of it, so
-- backfill occurredAt from createdAt (the value the app was treating as the date
-- all along) before enforcing NOT NULL. See server/ai context/specs/21.

-- AlterTable: add nullable first so the backfill can run on existing rows
ALTER TABLE "transactions" ADD COLUMN "occurredAt" TIMESTAMP(3);

-- Backfill: every existing transaction's date is its creation timestamp
UPDATE "transactions" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;

-- Now enforce the required constraint
ALTER TABLE "transactions" ALTER COLUMN "occurredAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "transactions_userId_occurredAt_idx" ON "transactions"("userId", "occurredAt");
