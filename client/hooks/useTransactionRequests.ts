import { useFetchData, usePatch } from "@/hooks/useApi";
import { TTransactionRequest } from "@/types/TransactionRequest.types";

const TRANSACTION_REQUESTS_KEY = ["transaction-requests"];

const ACCEPT_INVALIDATE_KEYS = [
  TRANSACTION_REQUESTS_KEY,
  ["daily-transaction"],
  ["monthly-transaction"],
  ["weekly-transaction"],
  ["yearly-transaction"],
];

// ! server-side pending sync requests from bikelog — unrelated to usePendingTransactions.ts's
// ! on-device offline-sync queue, do not conflate the two
export const useFetchTransactionRequests = () =>
  useFetchData<TTransactionRequest[]>(
    TRANSACTION_REQUESTS_KEY,
    "/transaction-requests",
  );

export const useAcceptTransactionRequest = () =>
  usePatch(ACCEPT_INVALIDATE_KEYS);

export const useRejectTransactionRequest = () =>
  usePatch([TRANSACTION_REQUESTS_KEY]);
