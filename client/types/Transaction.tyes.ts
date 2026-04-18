import { TransactionTypeConst } from "@/constants/TransactionType.constant";

export type TTransaction = {
  _id?: string;
  title: string;
  description?: string;
  amount: number;
  type: keyof typeof TransactionTypeConst;
  createdAt?: string;
  updatedAt?: string;

  user?: string;
};

export type TTransactionHistory = {
  expense: number;
  income: number;
  month: number;
  transactionCount: number;
};
