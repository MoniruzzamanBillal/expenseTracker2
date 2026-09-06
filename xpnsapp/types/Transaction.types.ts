import { TTransactionType } from "@/constants/TransactionType.constant";

export type TTransaction = {
  _id: string;
  userId: string;
  type: TTransactionType;
  title: string;
  description: string | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
};

/** A parsed-but-unsaved transaction returned by Smart Add, before it has an _id. */
export type TDraftTransaction = {
  type: TTransactionType;
  title: string;
  description?: string | null;
  amount: number;
};

export type TDayBucket = {
  date: string; // "2026-08-03"
  income: number;
  expense: number;
  transactions: TTransaction[];
};

export type TMonthSummary = {
  month: number; // 0-indexed: 0 = Jan
  income: number;
  expense: number;
  transactionCount: number;
};
