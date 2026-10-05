import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPostOutcome,
  apiPut,
  apiPutOutcome,
  TWriteOutcome,
} from "@/utils/api";
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";

export type TgenericResponse<TData> = {
  data: TData;
  statusCode: number;
  success: boolean;
  message: string;
};

type TFetchOptions<TData> = Omit<
  UseQueryOptions<TgenericResponse<TData>, Error>,
  "queryKey" | "queryFn"
>;

export const useFetchData = <TData>(
  key: string[],
  endPoint: string,
  options?: TFetchOptions<TData>,
) => {
  return useQuery({
    queryKey: key,
    queryFn: () => apiGet(endPoint),
    ...options,
  });
};

export const usePost = (invalidateQueriesKeys?: string[][]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      url: string;
      payload: Record<string, unknown> | FormData | any;
    }) => {
      return apiPost(params?.url, params?.payload);
    },
    onSuccess: (data) => {
      if (invalidateQueriesKeys) {
        invalidateQueriesKeys?.forEach((key) => {
          queryClient?.invalidateQueries({ queryKey: key });
        });
      }
    },
    onError: (error: any) => {
      // console.log("error = ", error?.response?.data?.message);
      // toast.error(
      //   error?.response?.data?.message || error.message || "Failed to Add.",
      // );
      throw error;
    },
  });
};

// Same shape as usePost, but resolves to a TWriteOutcome so the caller can tell
// a server rejection from a no-response failure (see utils/api.ts). Used by the
// save paths that queue offline, which must not queue a request the server
// actually answered. Invalidates only on a real success.
export const usePostOutcome = (invalidateQueriesKeys?: string[][]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      url: string;
      payload: Record<string, unknown> | FormData | any;
    }): Promise<TWriteOutcome> => {
      return apiPostOutcome(params?.url, params?.payload);
    },
    onSuccess: (outcome) => {
      if (!outcome?.ok) return;

      invalidateQueriesKeys?.forEach((key) => {
        queryClient?.invalidateQueries({ queryKey: key });
      });
    },
  });
};

// Update Hook
export const useUpdateData = (key: string[], endPoint: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => apiPut(endPoint, payload),
    onSuccess: () => {
      queryClient?.invalidateQueries({ queryKey: key });
    },
  });
};

// Identical in shape to usePatch, sitting alongside the existing (differently
// shaped, fixed key/endPoint) useUpdateData without changing it — useUpdateData
// still has zero call sites (known-issues.md#FETCH-2), untouched by this addition.
export const usePut = (invalidateQueriesKeys?: string[][]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { url: string; payload: FormData }) => {
      return apiPut(params?.url, params?.payload);
    },
    onSuccess: () => {
      if (invalidateQueriesKeys) {
        invalidateQueriesKeys?.forEach((key) => {
          queryClient?.invalidateQueries({ queryKey: key });
        });
      }
    },
    onError: (error) => {
      throw error;
    },
  });
};

// The PUT twin of usePostOutcome, same rationale (see utils/api.ts's apiPutOutcome).
// Deliberately has no throwing onError: under FETCH-1 a rejection never arrives, so a caller
// must read the resolved TWriteOutcome instead of relying on a catch that cannot fire.
// Invalidates only on a real success.
export const usePutOutcome = (invalidateQueriesKeys?: string[][]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      url: string;
      payload: Record<string, unknown> | FormData | any;
    }): Promise<TWriteOutcome> => {
      return apiPutOutcome(params?.url, params?.payload);
    },
    onSuccess: (outcome) => {
      if (!outcome?.ok) return;

      invalidateQueriesKeys?.forEach((key) => {
        queryClient?.invalidateQueries({ queryKey: key });
      });
    },
  });
};

export const usePatch = (invalidateQueriesKeys?: string[][]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      url: string;
      payload: Record<string, unknown> | FormData;
    }) => {
      return apiPatch(params?.url, params?.payload);
    },
    onSuccess: () => {
      if (invalidateQueriesKeys) {
        invalidateQueriesKeys?.forEach((key) => {
          queryClient?.invalidateQueries({ queryKey: key });
        });
      }
    },
    onError: (error) => {
      // toast.error(error.message || "Failed to update.");
      throw error;
    },
  });
};

export const useDeleteData = (invalidateQueriesKeys?: string[][]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { url: string }) => {
      return apiDelete(params?.url);
    },
    onSuccess: () => {
      if (invalidateQueriesKeys) {
        invalidateQueriesKeys?.forEach((key) => {
          queryClient?.invalidateQueries({ queryKey: key });
        });
      }
    },
    onError: (error) => {
      // toast.error(error.message || "Failed to Delete");
      throw error;
    },
  });
};
