import { z } from "zod";

const createTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["income", "expense"]),
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required "),
    amount: z.number().positive("Amount must be greater than 0"),
  }),
});

const updateTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["income", "expense"]).optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
  }),
});

//
export const transactionValidationSchemas = {
  createTransactionSchema,
  updateTransactionSchema,
};
