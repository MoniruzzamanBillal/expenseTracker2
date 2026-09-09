import {
  transactionRequestSourceTypeConstants,
  transactionRequestStatusConstants,
} from "./transactionRequest.constant";

export type TIngestTransactionRequest = {
  sourceApp: string;
  sourceType: keyof typeof transactionRequestSourceTypeConstants;
  sourceRecordId: string;
  userEmail: string;
  type?: "income" | "expense";
  title: string;
  description?: string;
  amount: number;
  occurredAt: string;
};

export type TAcceptTransactionRequestEdits = {
  title?: string;
  description?: string;
  amount?: number;
};

export type TTransactionRequestStatus =
  keyof typeof transactionRequestStatusConstants;
