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
const prisma_1 = require("../../lib/prisma");
const cloudinary_1 = require("../../util/cloudinary");
const generateObjectId_1 = require("../../util/generateObjectId");
const transaction_constant_1 = require("./transaction.constant");
const toApiShape = (t) => (Object.assign(Object.assign({}, t), { _id: t.id, amount: Number(t.amount) }));
// ! ownership check for a user-supplied categoryId — never trust a bare id without verifying it
const assertCategoryOwnership = (categoryId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!categoryId)
        return;
    const category = yield prisma_1.prisma.category.findFirst({
        where: { id: categoryId, userId, isDeleted: false },
    });
    if (!category) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid category id !!!");
    }
});
// ! groups a transaction set by category (dynamic per-user categories, no fixed universe)
const buildCategoryBreakdown = (transactions) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const buckets = {};
    for (const t of transactions) {
        const key = (_b = (_a = t.category) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : "uncategorized";
        if (!buckets[key]) {
            buckets[key] = {
                categoryId: (_d = (_c = t.category) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null,
                name: (_f = (_e = t.category) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : "Uncategorized",
                icon: (_h = (_g = t.category) === null || _g === void 0 ? void 0 : _g.icon) !== null && _h !== void 0 ? _h : null,
                income: 0,
                expense: 0,
            };
        }
        if (t.type === transaction_constant_1.transactionConstants.income)
            buckets[key].income += t.amount;
        else if (t.type === transaction_constant_1.transactionConstants.expense)
            buckets[key].expense += t.amount;
    }
    return Object.values(buckets);
};
// ! for adding new transaction
const addNewTransaction = (payload_1, userId_1, ...args_1) => __awaiter(void 0, [payload_1, userId_1, ...args_1], void 0, function* (payload, userId, client = prisma_1.prisma) {
    yield assertCategoryOwnership(payload.categoryId, userId);
    const result = yield client.transaction.create({
        data: {
            id: (0, generateObjectId_1.generateObjectId)(),
            userId,
            type: payload.type,
            categoryId: payload.categoryId,
            title: payload.title,
            description: payload.description,
            amount: payload.amount,
        },
    });
    return toApiShape(result);
});
// ! for adding tranaction as array
const addManyTransaction = (payload, userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all(payload.map((data) => assertCategoryOwnership(data.categoryId, userId)));
    const formattedPayload = payload === null || payload === void 0 ? void 0 : payload.map((data) => ({
        id: (0, generateObjectId_1.generateObjectId)(),
        userId,
        type: data.type,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description,
        amount: data.amount,
    }));
    const result = yield prisma_1.prisma.transaction.createMany({
        data: formattedPayload,
    });
    return result;
});
// ! for getting monthly data
const getMonthlyTransactions = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const today = new Date();
    const year = today.getUTCFullYear(); // eg : 2025
    const month = (_a = query === null || query === void 0 ? void 0 : query.targetMonth) !== null && _a !== void 0 ? _a : today.getUTCMonth() + 1; // eg : 2 --> feb
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const transactionsRaw = yield prisma_1.prisma.transaction.findMany({
        where: {
            userId,
            createdAt: { gte: start, lte: end },
            isDeleted: false,
        },
        orderBy: { createdAt: "desc" },
        include: { category: true },
    });
    const transactions = transactionsRaw.map(toApiShape);
    const income = transactions
        .filter((t) => (t === null || t === void 0 ? void 0 : t.type) === (transaction_constant_1.transactionConstants === null || transaction_constant_1.transactionConstants === void 0 ? void 0 : transaction_constant_1.transactionConstants.income))
        .reduce((acc, curr) => acc + (curr === null || curr === void 0 ? void 0 : curr.amount), 0);
    const expense = transactions
        .filter((t) => (t === null || t === void 0 ? void 0 : t.type) === (transaction_constant_1.transactionConstants === null || transaction_constant_1.transactionConstants === void 0 ? void 0 : transaction_constant_1.transactionConstants.expense))
        .reduce((acc, curr) => acc + (curr === null || curr === void 0 ? void 0 : curr.amount), 0);
    const categoryBreakdown = buildCategoryBreakdown(transactions);
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
    return { income, expense, transactionData: updatedData, categoryBreakdown };
});
// ! for getting the daily transaction
const getDailyTransactions = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const today = new Date();
    const start = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0);
    const end = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999);
    const transactionsRaw = yield prisma_1.prisma.transaction.findMany({
        where: {
            userId,
            createdAt: { gte: start, lte: end },
            isDeleted: false,
        },
        orderBy: { createdAt: "desc" },
        include: { category: true },
    });
    const transactions = transactionsRaw.map(toApiShape);
    const income = transactions
        .filter((t) => t.type === (transaction_constant_1.transactionConstants === null || transaction_constant_1.transactionConstants === void 0 ? void 0 : transaction_constant_1.transactionConstants.income))
        .reduce((acc, curr) => acc + curr.amount, 0);
    const expense = transactions
        .filter((t) => t.type === (transaction_constant_1.transactionConstants === null || transaction_constant_1.transactionConstants === void 0 ? void 0 : transaction_constant_1.transactionConstants.expense))
        .reduce((acc, curr) => acc + curr.amount, 0);
    const categoryBreakdown = buildCategoryBreakdown(transactions);
    return { income, expense, transactions, categoryBreakdown };
    //
});
// ! for getting the yearly transaction summary
const getYearlySummary = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const year = Number((_a = query === null || query === void 0 ? void 0 : query.targetYear) !== null && _a !== void 0 ? _a : new Date().getFullYear());
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
    const transactionsRaw = yield prisma_1.prisma.transaction.findMany({
        where: {
            userId,
            createdAt: { gte: start, lt: end },
            isDeleted: false,
        },
    });
    const transactions = transactionsRaw.map(toApiShape);
    const totalIncome = (_b = transactions
        .filter((t) => (t === null || t === void 0 ? void 0 : t.type) === (transaction_constant_1.transactionConstants === null || transaction_constant_1.transactionConstants === void 0 ? void 0 : transaction_constant_1.transactionConstants.income))) === null || _b === void 0 ? void 0 : _b.reduce((acc, cur) => acc + (cur === null || cur === void 0 ? void 0 : cur.amount), 0);
    const totalExpense = (_c = transactions === null || transactions === void 0 ? void 0 : transactions.filter((t) => (t === null || t === void 0 ? void 0 : t.type) === (transaction_constant_1.transactionConstants === null || transaction_constant_1.transactionConstants === void 0 ? void 0 : transaction_constant_1.transactionConstants.expense))) === null || _c === void 0 ? void 0 : _c.reduce((acc, cur) => acc + (cur === null || cur === void 0 ? void 0 : cur.amount), 0);
    const monthlySummary = {};
    for (let i = 0; i < 12; i++) {
        monthlySummary[i] = { income: 0, expense: 0, transactionCount: 0 };
    }
    for (const transaction of transactions) {
        const month = new Date(transaction === null || transaction === void 0 ? void 0 : transaction.createdAt).getUTCMonth();
        if (transaction.type === transaction_constant_1.transactionConstants.income) {
            monthlySummary[month].income += transaction.amount;
            monthlySummary[month].transactionCount++;
        }
        else if (transaction.type === transaction_constant_1.transactionConstants.expense) {
            monthlySummary[month].expense += transaction.amount;
            monthlySummary[month].transactionCount++;
        }
    }
    const result = (_d = Object.entries(monthlySummary)) === null || _d === void 0 ? void 0 : _d.map(([month, data]) => ({
        month: Number(month),
        income: data === null || data === void 0 ? void 0 : data.income,
        expense: data === null || data === void 0 ? void 0 : data.expense,
        transactionCount: data === null || data === void 0 ? void 0 : data.transactionCount,
    }));
    return {
        totalIncome,
        totalExpense,
        yearSummary: result,
    };
});
// ! for updating transaction
const updateTransaction = (transactionId, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const transactionData = yield prisma_1.prisma.transaction.findFirst({
        where: { id: transactionId, userId, isDeleted: false },
    });
    if (!transactionData) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid transaction id !!!");
    }
    if ("categoryId" in payload) {
        yield assertCategoryOwnership(payload.categoryId, userId);
    }
    const result = yield prisma_1.prisma.transaction.update({
        where: { id: transactionId },
        data: payload,
    });
    return toApiShape(result);
});
// ! for deletig transaction data
const deleteTransactionData = (transactionId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const transactionData = yield prisma_1.prisma.transaction.findFirst({
        where: { id: transactionId, userId, isDeleted: false },
    });
    if (!transactionData) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid transaction id !!!");
    }
    const result = yield prisma_1.prisma.transaction.update({
        where: { id: transactionId },
        data: { isDeleted: true },
    });
    return toApiShape(result);
});
// ! for attaching/replacing a transaction's receipt file (image or PDF) — never at create time
const uploadReceiptFile = (transactionId, userId, file) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const existing = yield prisma_1.prisma.transaction.findFirst({
        where: { id: transactionId, userId, isDeleted: false },
    });
    if (!existing) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid transaction id !!!");
    }
    if (existing.receiptFilePublicId) {
        // best-effort, replaces old asset — resourceType must match what it was uploaded with
        yield (0, cloudinary_1.deleteCloudinaryImage)(existing.receiptFilePublicId, (_a = existing.receiptFileResourceType) !== null && _a !== void 0 ? _a : "image");
    }
    const { url, publicId, resourceType } = yield (0, cloudinary_1.uploadDocumentBuffer)(file.buffer, file.mimetype);
    const result = yield prisma_1.prisma.transaction.update({
        where: { id: transactionId },
        data: {
            receiptFileUrl: url,
            receiptFilePublicId: publicId,
            receiptFileResourceType: resourceType,
            receiptFileOriginalName: file.originalname,
        },
    });
    return toApiShape(result);
});
// ! for removing a transaction's receipt file
const deleteReceiptFile = (transactionId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const existing = yield prisma_1.prisma.transaction.findFirst({
        where: { id: transactionId, userId, isDeleted: false },
    });
    if (!existing) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid transaction id !!!");
    }
    if (!existing.receiptFilePublicId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "No receipt file to delete");
    }
    yield (0, cloudinary_1.deleteCloudinaryImage)(existing.receiptFilePublicId, (_a = existing.receiptFileResourceType) !== null && _a !== void 0 ? _a : "image");
    const result = yield prisma_1.prisma.transaction.update({
        where: { id: transactionId },
        data: {
            receiptFileUrl: null,
            receiptFilePublicId: null,
            receiptFileResourceType: null,
            receiptFileOriginalName: null,
        },
    });
    return toApiShape(result);
});
// ! for moneyManagement (prompt with ai)
const moneyManagement = (prompt) => __awaiter(void 0, void 0, void 0, function* () {
    const systemPrompt = `
You are a specialized financial transaction extraction AI. Your ONLY task is to extract income and expense transactions from user text with high accuracy.

## EXTRACTION RULES:

### 1. Transaction Types
- **income**: Money received (salary, gift, refund, cashback, investment returns)
- **expense**: Money spent (bills, shopping, food, transportation, entertainment)

### 2. Amount Detection
- Extract numeric
- Handle written numbers (e.g., "five hundred" → 500)
- Handle decimal values (e.g., "150.50", "1,200")
- If multiple amounts in one sentence, create separate transactions

### 3. Title Generation
- Create concise, descriptive titles (max 5-6 words)

### 4. Description
- Extract context from the text
- Include important details like:
  - Vendor/store name
  - Purpose of transaction
  - Date/time if mentioned
  - Location if relevant
- Omit description if none provided or if it's generic
- Keep descriptions concise (max 10-15 words)

### 5. Multiple Transactions
- Identify ALL transactions in the text
- Example: "Bought coffee for 200 and lunch for 350" → 2 expense transactions
- Example: "Received salary 50,000 and paid rent 15,000" → 1 income, 1 expense


### 6. Edge Cases
- Correct misspelled words (e.g., "resataurant" → "restaurant")
- If type unclear, use best judgment based on context

### 7. Data Quality
- Remove any duplicate transactions
- Ensure title is not empty
- Type must be exactly "income" or "expense"

## OUTPUT FORMAT:
Return ONLY a valid JSON array with NO additional text, explanation, or markdown:

  JSON format:
  [
    {
      "type": "income | expense",
      "amount": number,
      "title": string,
      "description": string
    }
  ]

## EXAMPLES:

Input: "Spent 250 on coffee and 450 on lunch today"
Output: [
  {"type": "expense", "amount": 250, "title": "Coffee", "description": "Coffee purchase"},
  {"type": "expense", "amount": 450, "title": "Lunch", "description": "Lunch expense"}
]

Input: "Received salary 45,000 and paid 12,000 for rent"
Output: [
  {"type": "income", "amount": 45000, "title": "Salary", "description": "Monthly salary"},
  {"type": "expense", "amount": 12000, "title": "Rent", "description": "Monthly rent payment"}
]


Input: "Paid 500 for mobile recharge"
Output: [
  {"type": "expense", "amount": 500, "title": "Mobile Recharge", "description": "Mobile recharge"}
]

## IMPORTANT:
- ALWAYS return valid JSON
- NEVER include explanatory text outside JSON
- If no transactions found, return empty array []
- Ensure all required fields are present
`;
    const rawResponse = yield (0, openRouter_1.askOpenRouter)([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Text: "${prompt}"` },
    ], { temperature: 0.2 });
    let parsed;
    try {
        parsed = JSON.parse(rawResponse);
    }
    catch (_a) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "AI returned invalid transaction data");
    }
    return parsed;
});
// ! get weekly summary
const getWeeklySummary = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const targetDate = new Date();
    const current = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
    const day = current.getUTCDay();
    // find Friday as week start
    const diffToFriday = day >= 5 ? day - 5 : day + 2;
    const start = new Date(current);
    start.setUTCDate(current.getUTCDate() - diffToFriday);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    const transactionsRaw = yield prisma_1.prisma.transaction.findMany({
        where: {
            userId,
            createdAt: { gte: start, lt: end },
            isDeleted: false,
        },
        include: { category: true },
    });
    const transactions = transactionsRaw.map(toApiShape);
    const totalIncome = transactions
        .filter((t) => t.type === transaction_constant_1.transactionConstants.income)
        .reduce((acc, cur) => acc + cur.amount, 0);
    const totalExpense = transactions
        .filter((t) => t.type === transaction_constant_1.transactionConstants.expense)
        .reduce((acc, cur) => acc + cur.amount, 0);
    const categoryBreakdown = buildCategoryBreakdown(transactions);
    const dailyData = {};
    transactions.forEach((tran) => {
        const txDate = new Date(tran.createdAt);
        const year = txDate.getUTCFullYear();
        const month = txDate.getUTCMonth() + 1;
        const day = txDate.getUTCDate();
        const dateString = `${year}-${month
            .toString()
            .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        if (!dailyData[dateString]) {
            dailyData[dateString] = {
                income: 0,
                expense: 0,
                transactions: [],
            };
        }
        dailyData[dateString].transactions.push(tran);
        if (tran.type === transaction_constant_1.transactionConstants.income) {
            dailyData[dateString].income += tran.amount;
        }
        else if (tran.type === transaction_constant_1.transactionConstants.expense) {
            dailyData[dateString].expense += tran.amount;
        }
    });
    const transactionData = Object.entries(dailyData).map(([date, value]) => ({
        date,
        income: value.income,
        expense: value.expense,
        transactions: value.transactions,
    }));
    return {
        weekStart: start,
        weekEnd: end,
        income: totalIncome,
        expense: totalExpense,
        transactionData,
        categoryBreakdown,
    };
});
// ! rolling N-month income/expense totals + latest month's category breakdown
const getTrendSummary = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const months = Math.min(24, Math.max(1, Number(query === null || query === void 0 ? void 0 : query.months) || 6));
    const now = new Date();
    // Window: [start, end) — start is the 1st of the oldest included month,
    // end is the 1st of the month *after* the current one (exclusive upper bound).
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const transactionsRaw = yield prisma_1.prisma.transaction.findMany({
        where: { userId, isDeleted: false, createdAt: { gte: start, lt: end } },
        include: { category: true },
    });
    const transactions = transactionsRaw.map(toApiShape);
    // Pre-seed one zero-valued bucket per month in the window, oldest first — same
    // "never drop a quiet month" discipline getYearlySummary already applies per-year,
    // generalized here to an arbitrary rolling window that can cross a year boundary.
    const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const buckets = {};
    for (let i = 0; i < months; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1) + i, 1));
        buckets[monthKey(d)] = {
            targetMonth: monthKey(d),
            income: 0,
            expense: 0,
            transactions: [],
        };
    }
    for (const t of transactions) {
        const key = monthKey(new Date(t.createdAt));
        if (!buckets[key])
            continue; // defensive — shouldn't happen given the query's own range
        if (t.type === transaction_constant_1.transactionConstants.income)
            buckets[key].income += t.amount;
        else if (t.type === transaction_constant_1.transactionConstants.expense)
            buckets[key].expense += t.amount;
        buckets[key].transactions.push(t);
    }
    // Object.values preserves insertion order here since every key is a "YYYY-MM" string,
    // never a bare-integer-like key JS would otherwise reorder — buckets stay oldest→newest.
    const monthlyBuckets = Object.values(buckets);
    const latest = monthlyBuckets[monthlyBuckets.length - 1];
    const latestExpenseTransactions = latest.transactions.filter((t) => t.type === transaction_constant_1.transactionConstants.expense);
    return {
        months,
        monthlySummary: monthlyBuckets.map(({ targetMonth, income, expense }) => ({
            targetMonth,
            income,
            expense,
        })),
        categoryBreakdown: buildCategoryBreakdown(latestExpenseTransactions),
    };
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
    getWeeklySummary,
    uploadReceiptFile,
    deleteReceiptFile,
    getTrendSummary,
};
