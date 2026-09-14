"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryValidations = void 0;
const zod_1 = require("zod");
const createCategorySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, "Name is required"),
        icon: zod_1.z.string().min(1).optional(),
    }),
});
const updateCategorySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        icon: zod_1.z.string().min(1).optional(),
    }),
});
//
exports.categoryValidations = {
    createCategorySchema,
    updateCategorySchema,
};
