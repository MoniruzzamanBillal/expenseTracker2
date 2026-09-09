import { z } from "zod";

const ingestTransactionRequestSchema = z.object({
  body: z.object({
    sourceApp: z.string().min(1),
    sourceType: z.enum(["fuel", "maintenance", "accessory"]),
    sourceRecordId: z.string().min(1),
    userEmail: z.string().email(),
    type: z.enum(["income", "expense"]).default("expense"),
    title: z.string().min(1),
    description: z.string().optional(),
    amount: z.number().positive(),
    occurredAt: z.string().datetime(),
  }),
});

const acceptTransactionRequestSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
  }),
});

//
export const transactionRequestValidationSchemas = {
  ingestTransactionRequestSchema,
  acceptTransactionRequestSchema,
};
