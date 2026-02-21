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
const openRouter_1 = require("../../helper/openRouter");
const transaction_constant_1 = require("./transaction.constant");
const transaction_model_1 = require("./transaction.model");
// ! for adding new transaction
const addNewTransaction = (payload, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield transaction_model_1.transactionModel.create(Object.assign(Object.assign({}, payload), { user: userId }));
    return result;
});
// ! for adding tranaction as array
const addManyTransaction = (payload, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const formattedPayload = payload === null || payload === void 0 ? void 0 : payload.map((data) => (Object.assign(Object.assign({}, data), { user: userId })));
    return transaction_model_1.transactionModel.insertMany(formattedPayload);
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
const getYearlySummary = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const year = Number((_a = query === null || query === void 0 ? void 0 : query.targetYear) !== null && _a !== void 0 ? _a : new Date().getFullYear());
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
    const transactions = yield transaction_model_1.transactionModel.find({
        user: userId,
        createdAt: { $gte: start, $lt: end },
        isDeleted: false,
    });
    const monthlySummary = {};
    for (let i = 0; i < 12; i++) {
        monthlySummary[i] = { income: 0, expense: 0 };
    }
    for (const transaction of transactions) {
        const month = new Date(transaction === null || transaction === void 0 ? void 0 : transaction.createdAt).getUTCMonth();
        if (transaction.type === transaction_constant_1.transactionConstants.income) {
            monthlySummary[month].income += transaction.amount;
        }
        else if (transaction.type === transaction_constant_1.transactionConstants.expense) {
            monthlySummary[month].expense += transaction.amount;
        }
    }
    const result = (_b = Object.entries(monthlySummary)) === null || _b === void 0 ? void 0 : _b.map(([month, data]) => ({
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
// ! for moneyManagement (prompt with ai)
const moneyManagement = (prompt) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const response = yield openRouter_1.openai.chat.completions.create({
        // model: "z-ai/glm-4.5-air:free",
        model: "arcee-ai/trinity-large-preview:free",
        messages: [
            {
                role: "system",
                content: `
You are an AI that extracts money transactions from text.

Rules:
- A single text may contain MULTIPLE income and expense entries
- Return an ARRAY of objects
- Each object must represent ONE transaction
- Return ONLY valid JSON
- No explanation, no markdown, no extra text

JSON format:
[
  {
    "type": "income | expense",
    "amount": number,
    "title": string,
    "description": string
  }
]

Text:
"${prompt}"
`,
            },
            {
                role: "user",
                content: `
Text:
"${prompt}"
`,
            },
        ],
    });
    const rawResponse = (_a = response.choices[0].message) === null || _a === void 0 ? void 0 : _a.content;
    let parsed;
    try {
        parsed = JSON.parse(rawResponse);
    }
    catch (_b) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "AI returned invalid transaction data");
    }
    return parsed;
});
//
exports.transactionServices = {
    addNewTransaction,
    addManyTransaction,
    updateTransaction,
    deleteTransactionData,
    getDailyTransactions,
    getYearlySummary,
    getMonthlyTransactions,
    moneyManagement,
};
