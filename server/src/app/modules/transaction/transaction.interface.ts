import { transactionConstants } from "./transaction.constant";

export interface TTransaction {
  userId?: string;
  type: keyof typeof transactionConstants;
  categoryId?: string | null;
  title: string;
  description?: string;
  amount: number;
  isDeleted: boolean;

  // ISO string from the client on create/update; a Date once read back from Prisma.
  occurredAt?: Date | string;

  receiptFileUrl?: string | null;
  receiptFilePublicId?: string | null;
  receiptFileResourceType?: string | null;
  receiptFileOriginalName?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}
