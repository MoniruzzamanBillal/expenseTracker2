export const TransactionTypeConst = {
  income: "income",
  expense: "expense",
} as const;

export type TTransactionType = keyof typeof TransactionTypeConst;
