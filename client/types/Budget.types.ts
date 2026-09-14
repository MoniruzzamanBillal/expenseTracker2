export type TBudget = {
  _id: string;
  categoryId: string;
  category: { name: string; icon?: string };
  monthlyLimit: number;
  spent: number;
  percentage: number;
  isOverLimit: boolean;
};
