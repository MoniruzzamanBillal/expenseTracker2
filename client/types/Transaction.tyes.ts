export type TTransaction = {
  _id?: string;
  title: string;
  description?: string;
  amount: number;
  type: "income" | "expense";
  createdAt?: string;
  updatedAt?: string;
};

export type TTransactionHistory = {
  expense: number;
  income: number;
  month: number;
};
