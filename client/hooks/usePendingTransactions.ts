import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Toast from "react-native-toast-message";

import { apiPost } from "@/utils/api";
import {
  TEnqueueInput,
  TPendingTransactionPayload,
  transactionQueue,
} from "@/utils/transactionQueue";

const PENDING_QUERY_KEY = ["pending-transactions"];

const SYNCED_INVALIDATION_KEYS = [
  ["daily-transaction"],
  ["monthly-transaction"],
  ["weekly-transaction"],
  ["yearly-transaction"],
];

export const usePendingTransactions = () => {
  return useQuery({
    queryKey: PENDING_QUERY_KEY,
    queryFn: transactionQueue.getAll,
  });
};

export const useEnqueuePendingTransactions = () => {
  const queryClient = useQueryClient();

  return async (items: TEnqueueInput[]) => {
    const enqueued = await transactionQueue.enqueue(items);
    await queryClient.invalidateQueries({ queryKey: PENDING_QUERY_KEY });
    return enqueued;
  };
};

export const useUpdatePendingTransaction = () => {
  const queryClient = useQueryClient();

  return async (localId: string, payload: TPendingTransactionPayload) => {
    await transactionQueue.updatePayload(localId, payload);
    await queryClient.invalidateQueries({ queryKey: PENDING_QUERY_KEY });
  };
};

export const useRemovePendingTransaction = () => {
  const queryClient = useQueryClient();

  return async (localId: string) => {
    await transactionQueue.remove(localId);
    await queryClient.invalidateQueries({ queryKey: PENDING_QUERY_KEY });
  };
};

export const useSyncPendingTransactions = () => {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncAll = async () => {
    setIsSyncing(true);

    let syncedCount = 0;
    let failedCount = 0;

    try {
      const queue = await transactionQueue.getAll();

      // Sequential on purpose: keeps failure attribution to one specific item
      // instead of an all-or-nothing batch (see spec 02, "Sync mechanics").
      for (const item of queue) {
        const result = await apiPost(
          "/transactions/new-transaction",
          item.payload,
        );

        if (result?.success) {
          await transactionQueue.remove(item.localId);
          syncedCount += 1;
        } else {
          await transactionQueue.updateStatus(
            item.localId,
            "failed",
            "Sync failed — check connection or re-login",
          );
          failedCount += 1;
        }
      }

      await queryClient.invalidateQueries({ queryKey: PENDING_QUERY_KEY });
      SYNCED_INVALIDATION_KEYS.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      if (syncedCount > 0 || failedCount > 0) {
        Toast.show({
          type: failedCount > 0 ? "error" : "success",
          text1:
            failedCount > 0
              ? `${syncedCount} synced, ${failedCount} failed`
              : `${syncedCount} transaction${syncedCount === 1 ? "" : "s"} synced`,
          position: "top",
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return { syncAll, isSyncing };
};
