"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetServices = void 0;
const client_1 = require("@prisma/client");
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../Error/AppError"));
const prisma_1 = require("../../lib/prisma");
const generateObjectId_1 = require("../../util/generateObjectId");
// ! ownership check for a user-supplied categoryId
const assertCategoryOwnership = (categoryId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const category = yield prisma_1.prisma.category.findFirst({
        where: { id: categoryId, userId, isDeleted: false },
    });
    if (!category) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid category id !!!");
    }
});
// ! for creating a budget
const createBudget = (payload, userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield assertCategoryOwnership(payload.categoryId, userId);
    try {
        const result = yield prisma_1.prisma.budget.create({
            data: {
                id: (0, generateObjectId_1.generateObjectId)(),
                userId,
                categoryId: payload.categoryId,
                monthlyLimit: payload.monthlyLimit,
            },
        });
        return Object.assign(Object.assign({}, result), { _id: result.id });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw new AppError_1.default(http_status_1.default.CONFLICT, "A budget already exists for this category — update it instead");
        }
        throw error;
    }
});
// ! for listing the user's budgets, enriched with this month's actual spend
const getBudgets = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const budgetsRaw = yield prisma_1.prisma.budget.findMany({
        where: { userId },
        include: { category: true },
    });
    const budgets = budgetsRaw.filter((budget) => !budget.category.isDeleted);
    const budgetCategoryIds = budgets.map((budget) => budget.categoryId);
    const today = new Date();
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() + 1;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const spendByCategory = yield prisma_1.prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
            userId,
            categoryId: { in: budgetCategoryIds },
            type: "expense",
            isDeleted: false,
            createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
    });
    return budgets.map((budget) => {
        var _a;
        const spentEntry = spendByCategory.find((entry) => entry.categoryId === budget.categoryId);
        const spent = Number((_a = spentEntry === null || spentEntry === void 0 ? void 0 : spentEntry._sum.amount) !== null && _a !== void 0 ? _a : 0);
        const monthlyLimit = Number(budget.monthlyLimit);
        const percentage = (spent / monthlyLimit) * 100;
        return {
            _id: budget.id,
            categoryId: budget.categoryId,
            category: { name: budget.category.name, icon: budget.category.icon },
            monthlyLimit,
            spent,
            percentage,
            isOverLimit: spent > monthlyLimit,
        };
    });
});
// ! for updating a budget's limit
const updateBudget = (id, userId, monthlyLimit) => __awaiter(void 0, void 0, void 0, function* () {
    const budgetData = yield prisma_1.prisma.budget.findFirst({
        where: { id, userId },
    });
    if (!budgetData) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid budget id !!!");
    }
    const result = yield prisma_1.prisma.budget.update({
        where: { id },
        data: { monthlyLimit },
    });
    return Object.assign(Object.assign({}, result), { _id: result.id });
});
// ! for deleting a budget (real hard delete — see spec 12's Design note)
const deleteBudget = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const budgetData = yield prisma_1.prisma.budget.findFirst({
        where: { id, userId },
    });
    if (!budgetData) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid budget id !!!");
    }
    const result = yield prisma_1.prisma.budget.delete({
        where: { id },
    });
    return Object.assign(Object.assign({}, result), { _id: result.id });
});
//
exports.budgetServices = {
    createBudget,
    getBudgets,
    updateBudget,
    deleteBudget,
};
