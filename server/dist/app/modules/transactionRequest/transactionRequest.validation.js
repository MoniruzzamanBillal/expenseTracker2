"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionRequestValidationSchemas = void 0;
const zod_1 = require("zod");
const ingestTransactionRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        sourceApp: zod_1.z.string().min(1),
        sourceType: zod_1.z.enum(["fuel", "maintenance", "accessory"]),
        sourceRecordId: zod_1.z.string().min(1),
        userEmail: zod_1.z.string().email(),
        type: zod_1.z.enum(["income", "expense"]).default("expense"),
        title: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        amount: zod_1.z.number().positive(),
        occurredAt: zod_1.z.string().datetime(),
    }),
});
const acceptTransactionRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        amount: zod_1.z.number().positive().optional(),
    }),
});
//
exports.transactionRequestValidationSchemas = {
    ingestTransactionRequestSchema,
    acceptTransactionRequestSchema,
};
