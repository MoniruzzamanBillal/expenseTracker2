import { transactionConstants } from "./transaction.constant";

export interface TTransaction {
  userId?: string;
  type: keyof typeof transactionConstants;
  categoryId?: string | null;
  title: string;
  description?: string;
  amount: number;
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}
