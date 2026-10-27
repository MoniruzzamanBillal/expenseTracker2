import { z } from "zod";

// ! user-editable transaction date. ISO 8601 string; must not be in the future.
// ! The 1-day tolerance absorbs client clock skew and timezone edges — the frontend
// ! date picker is the precise "no future date" guard (spec 21); this is a backstop.
const occurredAtSchema = z
  .string()
  .datetime()
  .refine((v) => new Date(v).getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
    message: "Transaction date cannot be in the future",
  })
  .optional();

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
    occurredAt: occurredAtSchema,
  }),
});

const updateTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["income", "expense"]).optional(),
    categoryId: z.string().min(1).nullable().optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
    occurredAt: occurredAtSchema,
  }),
});

//
export const transactionValidationSchemas = {
  createTransactionSchema,
  updateTransactionSchema,
};
