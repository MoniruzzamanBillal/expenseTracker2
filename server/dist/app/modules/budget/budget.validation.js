"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetValidations = void 0;
const zod_1 = require("zod");
const createBudgetSchema = zod_1.z.object({
    body: zod_1.z.object({
        categoryId: zod_1.z.string().min(1, "Category is required"),
        monthlyLimit: zod_1.z.number().positive("Limit must be greater than 0"),
    }),
});
const updateBudgetSchema = zod_1.z.object({
    body: zod_1.z.object({
        monthlyLimit: zod_1.z.number().positive("Limit must be greater than 0"),
    }),
});
//
exports.budgetValidations = {
    createBudgetSchema,
    updateBudgetSchema,
};
