import { z } from "zod";

const createBudgetSchema = z.object({
  body: z.object({
    categoryId: z.string().min(1, "Category is required"),
    monthlyLimit: z.number().positive("Limit must be greater than 0"),
  }),
});

const updateBudgetSchema = z.object({
  body: z.object({
    monthlyLimit: z.number().positive("Limit must be greater than 0"),
  }),
});

//
export const budgetValidations = {
  createBudgetSchema,
  updateBudgetSchema,
};
