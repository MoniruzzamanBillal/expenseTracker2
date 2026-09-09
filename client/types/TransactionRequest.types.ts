export type TTransactionRequest = {
  _id: string;
  sourceApp: string;
  sourceType: "fuel" | "maintenance" | "accessory";
  sourceRecordId: string;
  type: "income" | "expense";
  title: string;
  description?: string;
  amount: number;
  occurredAt: string;
  status: "pending" | "accepted" | "rejected";
  transactionId?: string;
  createdAt: string;
};
