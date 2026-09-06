import { apiGet, apiPatch, apiPost } from "@/utils/api";
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";

// Every ExpenseTracker API response shares this envelope.
export type TgenericResponse<TData> = {
  data: TData;
  success: boolean;
  message: string;
  token?: string;
};

type TFetchOptions<TData> = Omit<
  UseQueryOptions<TgenericResponse<TData>, Error>,
  "queryKey" | "queryFn"
>;

/** GET wrapper — mirrors the ExpenseTracker client's useFetchData. */
export const useFetchData = <TData>(
  key: string[],
  endPoint: string,
  params?: Record<string, unknown>,
  options?: TFetchOptions<TData>,
) => {
  return useQuery({
    queryKey: key,
    queryFn: () => apiGet(endPoint, params),
    ...options,
  });
};

/** POST wrapper — call with { url, payload }, invalidates the given query keys on success. */
export const usePost = (invalidateQueriesKeys?: string[][]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { url: string; payload: Record<string, unknown> | unknown[] }) =>
      apiPost(params.url, params.payload),
    onSuccess: () => {
      invalidateQueriesKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
};

/** PATCH wrapper — call with { url, payload }, invalidates the given query keys on success.
 *  Used for updates AND soft-deletes (the API's "delete" is a PATCH). */
export const usePatch = (invalidateQueriesKeys?: string[][]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { url: string; payload?: Record<string, unknown> }) =>
      apiPatch(params.url, params.payload),
    onSuccess: () => {
      invalidateQueriesKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
};
