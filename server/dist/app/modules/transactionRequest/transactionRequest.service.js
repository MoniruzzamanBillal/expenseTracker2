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
exports.transactionRequestServices = void 0;
const client_1 = require("@prisma/client");
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../Error/AppError"));
const prisma_1 = require("../../lib/prisma");
const transaction_service_1 = require("../transaction/transaction.service");
const generateObjectId_1 = require("../../util/generateObjectId");
const toApiShape = (t) => (Object.assign(Object.assign({}, t), { _id: t.id, amount: Number(t.amount) }));
// ! for ingesting a transaction request from another app (e.g. bikelog)
const ingestTransactionRequest = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const result = yield prisma_1.prisma.transactionRequest.create({
            data: {
                id: (0, generateObjectId_1.generateObjectId)(),
                userEmail: payload.userEmail,
                sourceApp: payload.sourceApp,
                sourceType: payload.sourceType,
                sourceRecordId: payload.sourceRecordId,
                type: (_a = payload.type) !== null && _a !== void 0 ? _a : "expense",
                title: payload.title,
                description: payload.description,
                amount: payload.amount,
                occurredAt: new Date(payload.occurredAt),
            },
        });
        return toApiShape(result);
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            const existing = yield prisma_1.prisma.transactionRequest.findUnique({
                where: {
                    sourceApp_sourceRecordId: {
                        sourceApp: payload.sourceApp,
                        sourceRecordId: payload.sourceRecordId,
                    },
                },
            });
            if (existing) {
                return toApiShape(existing);
            }
        }
        throw error;
    }
});
// ! for listing the logged-in user's own pending transaction requests
const getPendingTransactionRequests = (userEmail) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.prisma.transactionRequest.findMany({
        where: { userEmail, status: "pending" },
        orderBy: { createdAt: "desc" },
    });
    return result.map(toApiShape);
});
// ! for accepting a transaction request — creates a real Transaction, atomically
const acceptTransactionRequest = (id, userEmail, userId, edits) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const transactionRequest = yield prisma_1.prisma.transactionRequest.findFirst({
        where: { id, userEmail, status: "pending" },
    });
    if (!transactionRequest) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, "Transaction request not found or already reviewed");
    }
    const title = (_a = edits.title) !== null && _a !== void 0 ? _a : transactionRequest.title;
    const description = (_c = (_b = edits.description) !== null && _b !== void 0 ? _b : transactionRequest.description) !== null && _c !== void 0 ? _c : undefined;
    const amount = (_d = edits.amount) !== null && _d !== void 0 ? _d : Number(transactionRequest.amount);
    return prisma_1.prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const transaction = yield transaction_service_1.transactionServices.addNewTransaction({ type: "expense", title, description, amount, isDeleted: false }, userId, tx);
        const updatedRequest = yield tx.transactionRequest.update({
            where: { id },
            data: {
                status: "accepted",
                transactionId: transaction._id,
                reviewedAt: new Date(),
            },
        });
        return { transaction, transactionRequest: toApiShape(updatedRequest) };
    }));
});
// ! for rejecting a transaction request — soft status flip, kept for audit
const rejectTransactionRequest = (id, userEmail) => __awaiter(void 0, void 0, void 0, function* () {
    const transactionRequest = yield prisma_1.prisma.transactionRequest.findFirst({
        where: { id, userEmail, status: "pending" },
    });
    if (!transactionRequest) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, "Transaction request not found or already reviewed");
    }
    const result = yield prisma_1.prisma.transactionRequest.update({
        where: { id },
        data: { status: "rejected", reviewedAt: new Date() },
    });
    return toApiShape(result);
});
//
exports.transactionRequestServices = {
    ingestTransactionRequest,
    getPendingTransactionRequests,
    acceptTransactionRequest,
    rejectTransactionRequest,
};
