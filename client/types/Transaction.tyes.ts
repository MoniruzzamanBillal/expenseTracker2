import { TransactionTypeConst } from "@/constants/TransactionType.constant";
import { TCategory } from "./Category.types";

export type TTransaction = {
  _id?: string;
  title: string;
  description?: string;
  amount: number;
  type: keyof typeof TransactionTypeConst;
  createdAt?: string;
  updatedAt?: string;

  user?: string;

  // categoryId is the source of truth for editing; category is an optional
  // denormalized read-convenience field present when the endpoint `include`s
  // the related row (summary endpoints) but absent on plain create/update
  // responses (spec 13).
  categoryId?: string | null;
  category?: TCategory | null;
};

export type TTransactionHistory = {
  expense: number;
  income: number;
  month: number;
  transactionCount: number;
};
