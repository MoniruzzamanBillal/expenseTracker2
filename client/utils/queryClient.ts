import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { Query, QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";

// One constant for both on purpose: if gcTime < maxAge, restored queries are
// garbage-collected the moment they arrive and persistence silently does nothing
// (ai context/specs/37-offline-cached-and-queued-reads.md, "Risks").
const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: SEVEN_DAYS,
      staleTime: 30_000,
      // The default of 3 retries + backoff is ~7s of skeleton before an offline screen settles.
      retry: 2,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "EXPENSE_TRACKER_QUERY_CACHE",
  throttleTime: 1000,
});

export const persistOptions: PersistQueryClientProviderProps["persistOptions"] =
  {
    persister: queryPersister,
    maxAge: SEVEN_DAYS,
    // Bump to invalidate every persisted cache after a change to a payload shape a screen reads.
    buster: "v1",
    dehydrateOptions: {
      // A paused mutation restored on the next launch could post the same transaction twice.
      // Offline writes go through the explicit queue (transactionQueue), never this.
      shouldDehydrateMutation: () => false,
      // pending-transactions is excluded because its source of truth is AsyncStorage itself
      // (transactionQueue.getAll) — a persisted copy would flash a stale queue before the real read.
      shouldDehydrateQuery: (query: Query) =>
        query.state.status === "success" &&
        query.queryKey[0] !== "pending-transactions",
    },
  };

/**
 * Drops every cached read, in memory and on disk. Called on logout and on a 401 so a second
 * account never sees the first one's figures. Safe to call from outside the React tree.
 */
export const clearPersistedQueryCache = async () => {
  try {
    queryClient.clear();
    await queryPersister.removeClient();
  } catch (error) {
    console.log("could not clear the persisted query cache", error);
  }
};
