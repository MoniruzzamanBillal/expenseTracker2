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
exports.categoryServices = void 0;
const client_1 = require("@prisma/client");
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../Error/AppError"));
const prisma_1 = require("../../lib/prisma");
const generateObjectId_1 = require("../../util/generateObjectId");
// ! for creating a category
const createCategory = (payload, userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield prisma_1.prisma.category.create({
            data: {
                id: (0, generateObjectId_1.generateObjectId)(),
                userId,
                name: payload.name,
                icon: payload.icon,
            },
        });
        return Object.assign(Object.assign({}, result), { _id: result.id });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw new AppError_1.default(http_status_1.default.CONFLICT, "A category with this name already exists");
        }
        throw error;
    }
});
// ! for getting the logged-in user's own non-deleted categories
const getCategories = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.prisma.category.findMany({
        where: { userId, isDeleted: false },
        orderBy: { createdAt: "asc" },
    });
    return result.map((category) => (Object.assign(Object.assign({}, category), { _id: category.id })));
});
// ! for updating a category (rename and/or change icon)
const updateCategory = (id, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const categoryData = yield prisma_1.prisma.category.findFirst({
        where: { id, userId, isDeleted: false },
    });
    if (!categoryData) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid category id !!!");
    }
    try {
        const result = yield prisma_1.prisma.category.update({
            where: { id },
            data: payload,
        });
        return Object.assign(Object.assign({}, result), { _id: result.id });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw new AppError_1.default(http_status_1.default.CONFLICT, "A category with this name already exists");
        }
        throw error;
    }
});
// ! for soft-deleting a category
const deleteCategory = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const categoryData = yield prisma_1.prisma.category.findFirst({
        where: { id, userId, isDeleted: false },
    });
    if (!categoryData) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid category id !!!");
    }
    const result = yield prisma_1.prisma.category.update({
        where: { id },
        data: { isDeleted: true },
    });
    return Object.assign(Object.assign({}, result), { _id: result.id });
});
//
exports.categoryServices = {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory,
};
