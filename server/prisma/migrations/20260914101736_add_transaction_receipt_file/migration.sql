-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "receiptFileOriginalName" TEXT,
ADD COLUMN     "receiptFilePublicId" TEXT,
ADD COLUMN     "receiptFileResourceType" TEXT,
ADD COLUMN     "receiptFileUrl" TEXT;
