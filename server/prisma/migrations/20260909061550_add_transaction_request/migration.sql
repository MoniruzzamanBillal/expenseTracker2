-- CreateEnum
CREATE TYPE "TransactionRequestStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "transaction_requests" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "sourceApp" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL DEFAULT 'expense',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "TransactionRequestStatus" NOT NULL DEFAULT 'pending',
    "transactionId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_requests_userEmail_status_idx" ON "transaction_requests"("userEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_requests_sourceApp_sourceRecordId_key" ON "transaction_requests"("sourceApp", "sourceRecordId");
