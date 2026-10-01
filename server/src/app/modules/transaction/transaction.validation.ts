import { z } from "zod";

const createTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["income", "expense"]),
    // .nullable() as well as .optional(), matching updateTransactionSchema
    // below: .optional() alone admits undefined but not null, so a client
    // sending an explicit `categoryId: null` for "no category" got a 400
    // (client spec 28).
    categoryId: z.string().min(1).nullable().optional(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    amount: z.number().positive("Amount must be greater than 0"),
  }),
});

const updateTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["income", "expense"]).optional(),
    categoryId: z.string().min(1).nullable().optional(),
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
