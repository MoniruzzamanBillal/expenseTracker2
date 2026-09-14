import { TBudget } from "@/types/Budget.types";
import { useDeleteData, useFetchData, usePatch, usePost } from "./useApi";

export const useBudgets = () =>
  useFetchData<TBudget[]>(["budgets"], "/budgets");
export const useCreateBudget = () => usePost([["budgets"]]);
export const useUpdateBudget = () => usePatch([["budgets"]]);
export const useDeleteBudget = () => useDeleteData([["budgets"]]);
