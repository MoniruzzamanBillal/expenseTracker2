import httpStatus from "http-status";
import AppError from "../../Error/AppError";
import { openai } from "../../helper/openRouter";
import { transactionConstants } from "./transaction.constant";
import { TTransaction } from "./transaction.interface";
import { transactionModel } from "./transaction.model";

// ! for adding new transaction
const addNewTransaction = async (payload: TTransaction, userId: string) => {
  const result = await transactionModel.create({ ...payload, user: userId });

  return result;
};

// ! for adding tranaction as array
const addManyTransaction = async (payload: TTransaction[], userId: string) => {
  payload.forEach(async (data: TTransaction) => {
    await transactionModel.create({ ...data, user: userId });
  });
};

// ! for getting monthly data --> legecy service function , not in use
const getMonthlyTransactionsLegacy = async (
  userId: string,
  month?: number,
  year?: number,
) => {
  const today = new Date();
  year = year ?? today.getUTCFullYear();
  month = month ?? today.getUTCMonth() + 1;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const transactions = await transactionModel
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
};

type TMonthlyPayload = {
  targetMonth?: number;
};

// ! for getting monthly data
const getMonthlyTransactions = async (
  userId: string,
  query: TMonthlyPayload,
) => {
  const today = new Date();
  const year = today.getUTCFullYear(); // eg : 2025
  const month = query?.targetMonth ?? today.getUTCMonth() + 1; // eg : 2 --> feb

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const transactions = await transactionModel
    .find({
      user: userId,
      createdAt: { $gte: start, $lte: end },
      isDeleted: false,
    })
    .sort({ createdAt: -1 });

  const income = transactions
    .filter((t) => t?.type === transactionConstants?.income)
    .reduce((acc, curr) => acc + curr?.amount, 0);

  const expense = transactions
    .filter((t) => t?.type === transactionConstants?.expense)
    .reduce((acc, curr) => acc + curr?.amount, 0);

  const dailyDate: {
    [day: string]: {
      income: number;
      expense: number;
      transactions: TTransaction[];
    };
  } = {};

  transactions?.forEach((tran) => {
    const day = tran?.createdAt?.getUTCDate() as number;

    const dateString = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

    if (!dailyDate[dateString]) {
      dailyDate[dateString] = { income: 0, expense: 0, transactions: [] };
    }

    dailyDate[dateString].transactions.push(tran);

    if (tran?.type === transactionConstants.income) {
      dailyDate[dateString].income += tran?.amount;
    } else if (tran?.type === transactionConstants?.expense) {
      dailyDate[dateString].expense += tran?.amount;
    }
  });

  const updatedData = Object.entries(dailyDate)?.map(([date, value]) => ({
    date,
    income: value?.income,
    expense: value?.expense,
    transactions: value?.transactions,
  }));

  return { income, expense, transactionData: updatedData };
};

// ! for getting the daily transaction
const getDailyTransactions = async (userId: string) => {
  const today = new Date();

  const start = new Date(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    0,
    0,
    0,
    0,
  );

  const end = new Date(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    23,
    59,
    59,
    999,
  );

  const transactions = await transactionModel
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
};

// ! for getting the yearly transaction summary
const getYearlySummary = async (userId: string) => {
  const currentYear = new Date().getFullYear();

  const start = new Date(currentYear, 0, 1);
  const end = new Date(currentYear + 1, 0, 1);

  const transactions = await transactionModel.find({
    user: userId,
    createdAt: { $gte: start, $lte: end },
    isDeleted: false,
  });

  const monthlySummary: Record<number, { income: number; expense: number }> =
    {};

  for (let i = 0; i < 12; i++) {
    monthlySummary[i] = { income: 0, expense: 0 };
  }

  for (const transaction of transactions) {
    const month = new Date(transaction?.createdAt as Date).getMonth();

    if (transaction.type === transactionConstants.income) {
      monthlySummary[month].income += transaction.amount;
    } else if (transaction.type === transactionConstants.expense) {
      monthlySummary[month].expense += transaction.amount;
    }
  }

  const result = Object.entries(monthlySummary)?.map(([month, data]) => ({
    month: Number(month),
    income: data?.income,
    expense: data?.expense,
  }));

  return result;
};

// ! for updating transaction
const updateTransaction = async (
  transactionId: string,
  payload: Partial<TTransaction>,
) => {
  const transactionData = await transactionModel.findOne({
    _id: transactionId,
    isDeleted: false,
  });

  if (!transactionData) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid transaction id !!!");
  }

  return await transactionModel.findByIdAndUpdate(transactionId, payload, {
    new: true,
  });
};

// ! for deletig transaction data
const deleteTransactionData = async (transactionId: string) => {
  const transactionData = await transactionModel.findById(transactionId);

  if (!transactionData) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid transaction id !!!");
  }

  const result = await transactionModel.findByIdAndUpdate(
    transactionId,
    {
      isDeleted: true,
    },
    {
      new: true,
    },
  );

  return result;
};

// ! for moneyManagement
const moneyManagement = async (prompt: string) => {
  const response = await openai.chat.completions.create({
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

  const rawResponse = response.choices[0].message?.content;

  let parsed;
  try {
    parsed = JSON.parse(rawResponse as string);
  } catch {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "AI returned invalid transaction data",
    );
  }

  return parsed;
};

//
export const transactionServices = {
  addNewTransaction,
  addManyTransaction,
  updateTransaction,
  getMonthlyTransactionsLegacy,
  deleteTransactionData,
  getDailyTransactions,
  getYearlySummary,
  getMonthlyTransactions,
  moneyManagement,
};
