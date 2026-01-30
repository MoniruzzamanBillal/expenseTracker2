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
exports.transactionServices = void 0;
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../Error/AppError"));
const transaction_constant_1 = require("./transaction.constant");
const transaction_model_1 = require("./transaction.model");
// ! for adding new transaction
const addNewTransaction = (payload, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield transaction_model_1.transactionModel.create(Object.assign(Object.assign({}, payload), { user: userId }));
    return result;
});
// ! for getting monthly data --> legecy service function , not in use
const getMonthlyTransactionsLegacy = (userId, month, year) => __awaiter(void 0, void 0, void 0, function* () {
    const today = new Date();
    year = year !== null && year !== void 0 ? year : today.getUTCFullYear();
    month = month !== null && month !== void 0 ? month : today.getUTCMonth() + 1;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const transactions = yield transaction_model_1.transactionModel
        .find({
        user: userId,
        createdAt: { $gte: start, $lte: end },
        isDeleted: false,
    })
        .sort({ createdAt: -1 });
    const income = transactions
        .filter((t) => t.type === "income")
        .reduce((acc, curr) => acc + curr.amount, 0);
    const expense = transactions
        .filter((t) => t.type === "expense")
        .reduce((acc, curr) => acc + curr.amount, 0);
    return { income, expense, transactions };
});
// ! for getting monthly data
const getMonthlyTransactions = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const today = new Date();
    const year = today.getUTCFullYear(); // eg : 2025
    const month = (_a = query === null || query === void 0 ? void 0 : query.targetMonth) !== null && _a !== void 0 ? _a : today.getUTCMonth() + 1; // eg : 2 --> feb
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const transactions = yield transaction_model_1.transactionModel
        .find({
        user: userId,
        createdAt: { $gte: start, $lte: end },
        isDeleted: false,
    })
        .sort({ createdAt: -1 });
    const income = transactions
        .filter((t) => (t === null || t === void 0 ? void 0 : t.type) === (transaction_constant_1.transactionConstants === null || transaction_constant_1.transactionConstants === void 0 ? void 0 : transaction_constant_1.transactionConstants.income))
        .reduce((acc, curr) => acc + (curr === null || curr === void 0 ? void 0 : curr.amount), 0);
    const expense = transactions
        .filter((t) => (t === null || t === void 0 ? void 0 : t.type) === (transaction_constant_1.transactionConstants === null || transaction_constant_1.transactionConstants === void 0 ? void 0 : transaction_constant_1.transactionConstants.expense))
        .reduce((acc, curr) => acc + (curr === null || curr === void 0 ? void 0 : curr.amount), 0);
    const dailyDate = {};
    transactions === null || transactions === void 0 ? void 0 : transactions.forEach((tran) => {
        var _a;
        const day = (_a = tran === null || tran === void 0 ? void 0 : tran.createdAt) === null || _a === void 0 ? void 0 : _a.getUTCDate();
        const dateString = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        if (!dailyDate[dateString]) {
            dailyDate[dateString] = { income: 0, expense: 0, transactions: [] };
        }
        dailyDate[dateString].transactions.push(tran);
        if ((tran === null || tran === void 0 ? void 0 : tran.type) === transaction_constant_1.transactionConstants.income) {
            dailyDate[dateString].income += tran === null || tran === void 0 ? void 0 : tran.amount;
        }
        else if ((tran === null || tran === void 0 ? void 0 : tran.type) === (transaction_constant_1.transactionConstants === null || transaction_constant_1.transactionConstants === void 0 ? void 0 : transaction_constant_1.transactionConstants.expense)) {
            dailyDate[dateString].expense += tran === null || tran === void 0 ? void 0 : tran.amount;
        }
    });
    const updatedData = (_b = Object.entries(dailyDate)) === null || _b === void 0 ? void 0 : _b.map(([date, value]) => ({
        date,
        income: value === null || value === void 0 ? void 0 : value.income,
        expense: value === null || value === void 0 ? void 0 : value.expense,
        transactions: value === null || value === void 0 ? void 0 : value.transactions,
    }));
    return { income, expense, transactionData: updatedData };
});
// ! for getting the daily transaction
const getDailyTransactions = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const today = new Date();
    const start = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0);
    const end = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999);
    const transactions = yield transaction_model_1.transactionModel
        .find({
        user: userId,
        createdAt: { $gte: start, $lte: end },
        isDeleted: false,
    })
        .sort({ createdAt: -1 });
    const income = transactions
        .filter((t) => t.type === "income")
        .reduce((acc, curr) => acc + curr.amount, 0);
    const expense = transactions
        .filter((t) => t.type === "expense")
        .reduce((acc, curr) => acc + curr.amount, 0);
    return { income, expense, transactions };
    //
});
// ! for getting the yearly transaction summary
const getYearlySummary = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const currentYear = new Date().getFullYear();
    const start = new Date(currentYear, 0, 1);
    const end = new Date(currentYear + 1, 0, 1);
    const transactions = yield transaction_model_1.transactionModel.find({
        user: userId,
        createdAt: { $gte: start, $lte: end },
        isDeleted: false,
    });
    const monthlySummary = {};
    for (let i = 0; i < 12; i++) {
        monthlySummary[i] = { income: 0, expense: 0 };
    }
    for (const transaction of transactions) {
        const month = new Date(transaction === null || transaction === void 0 ? void 0 : transaction.createdAt).getMonth();
        if (transaction.type === transaction_constant_1.transactionConstants.income) {
            monthlySummary[month].income += transaction.amount;
        }
        else if (transaction.type === transaction_constant_1.transactionConstants.expense) {
            monthlySummary[month].expense += transaction.amount;
        }
    }
    const result = (_a = Object.entries(monthlySummary)) === null || _a === void 0 ? void 0 : _a.map(([month, data]) => ({
        month: Number(month),
        income: data === null || data === void 0 ? void 0 : data.income,
        expense: data === null || data === void 0 ? void 0 : data.expense,
    }));
    return result;
});
// ! for updating transaction
const updateTransaction = (transactionId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const transactionData = yield transaction_model_1.transactionModel.findOne({
        _id: transactionId,
        isDeleted: false,
    });
    if (!transactionData) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid transaction id !!!");
    }
    return yield transaction_model_1.transactionModel.findByIdAndUpdate(transactionId, payload, {
        new: true,
    });
});
// ! for deletig transaction data
const deleteTransactionData = (transactionId) => __awaiter(void 0, void 0, void 0, function* () {
    const transactionData = yield transaction_model_1.transactionModel.findById(transactionId);
    if (!transactionData) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid transaction id !!!");
    }
    const result = yield transaction_model_1.transactionModel.findByIdAndUpdate(transactionId, {
        isDeleted: true,
    }, {
        new: true,
    });
    return result;
});
//
exports.transactionServices = {
    addNewTransaction,
    updateTransaction,
    getMonthlyTransactionsLegacy,
    deleteTransactionData,
    getDailyTransactions,
    getYearlySummary,
    getMonthlyTransactions,
};
