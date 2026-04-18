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
  const formattedPayload = payload?.map((data) => ({ ...data, user: userId }));

  return transactionModel.insertMany(formattedPayload);
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
    .filter((t) => t.type === transactionConstants?.income)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const expense = transactions
    .filter((t) => t.type === transactionConstants?.expense)
    .reduce((acc, curr) => acc + curr.amount, 0);

  return { income, expense, transactions };

  //
};

type TYearlyPayload = {
  targetYear?: number;
};

// ! for getting the yearly transaction summary
const getYearlySummary = async (userId: string, query: TYearlyPayload) => {
  const year = Number(query?.targetYear ?? new Date().getFullYear());

  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

  const transactions = await transactionModel.find({
    user: userId,
    createdAt: { $gte: start, $lt: end },
    isDeleted: false,
  });

  const totalIncome = transactions
    .filter((t) => t?.type === transactionConstants?.income)
    ?.reduce((acc, cur) => acc + cur?.amount, 0);

  const totalExpense = transactions
    ?.filter((t) => t?.type === transactionConstants?.expense)
    ?.reduce((acc, cur) => acc + cur?.amount, 0);

  const monthlySummary: Record<
    number,
    { income: number; expense: number; transactionCount: number }
  > = {};

  for (let i = 0; i < 12; i++) {
    monthlySummary[i] = { income: 0, expense: 0, transactionCount: 0 };
  }

  for (const transaction of transactions) {
    const month = new Date(transaction?.createdAt as Date).getUTCMonth();

    if (transaction.type === transactionConstants.income) {
      monthlySummary[month].income += transaction.amount;
      monthlySummary[month].transactionCount++;
    } else if (transaction.type === transactionConstants.expense) {
      monthlySummary[month].expense += transaction.amount;
      monthlySummary[month].transactionCount++;
    }
  }

  const result = Object.entries(monthlySummary)?.map(([month, data]) => ({
    month: Number(month),
    income: data?.income,
    expense: data?.expense,
    transactionCount: data?.transactionCount,
  }));

  return {
    totalIncome,
    totalExpense,
    yearSummary: result,
  };
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

// ! for moneyManagement (prompt with ai)
const moneyManagement = async (prompt: string) => {
  const response = await openai.chat.completions.create({
    // model: "z-ai/glm-4.5-air:free",
    // model: "arcee-ai/trinity-large-preview:free",
    model: "nvidia/nemotron-3-nano-30b-a3b:free",

    messages: [
      {
        role: "system",
        content: `
You are a specialized financial transaction extraction AI. Your ONLY task is to extract income and expense transactions from user text with high accuracy.

## EXTRACTION RULES:

### 1. Transaction Types
- **income**: Money received (salary, gift, refund, cashnvidia/nemotron-3-nano-30b-a3b:freeback, investment returns)
- **expense**: Money spent (bills, shopping, food, transportation, entertainment)

### 2. Amount Detection
- Extract numeric 
- Handle written numbers (e.g., "five hundred" → 500)
- Handle decimal values (e.g., "150.50", "1,200")
- If multiple amounts in one sentence, create separate transactions
nvidia/nemotron-3-nano-30b-a3b:free
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
`,
      },
      {
        role: "user",
        content: `Text: "${prompt}"`,
      },
    ],
    temperature: 0.7,
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

// ! get weekly summary
const getWeeklySummary = async (userId: string) => {
  const targetDate = new Date();

  const current = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
    ),
  );

  const day = current.getUTCDay();

  // find Friday as week start
  const diffToFriday = day >= 5 ? day - 5 : day + 2;

  const start = new Date(current);
  start.setUTCDate(current.getUTCDate() - diffToFriday);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  const transactions = await transactionModel.find({
    user: userId,
    createdAt: { $gte: start, $lt: end },
    isDeleted: false,
  });

  const totalIncome = transactions
    .filter((t) => t.type === transactionConstants.income)
    .reduce((acc, cur) => acc + cur.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === transactionConstants.expense)
    .reduce((acc, cur) => acc + cur.amount, 0);

  const dailySummary: Record<
    number,
    { income: number; expense: number; transactionCount: number }
  > = {};

  for (let i = 0; i < 7; i++) {
    dailySummary[i] = {
      income: 0,
      expense: 0,
      transactionCount: 0,
    };
  }

  for (const transaction of transactions) {
    const txDate = new Date(transaction.createdAt as Date);

    const diff = Math.floor(
      (txDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diff >= 0 && diff < 7) {
      if (transaction.type === transactionConstants.income) {
        dailySummary[diff].income += transaction.amount;
      } else if (transaction.type === transactionConstants.expense) {
        dailySummary[diff].expense += transaction.amount;
      }

      dailySummary[diff].transactionCount++;
    }
  }

  const dayNames = [
    "Friday",
    "Saturday",
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
  ];

  const result = Object.entries(dailySummary).map(([index, data]) => {
    const dayIndex = Number(index);

    const currentDate = new Date(start);
    currentDate.setUTCDate(start.getUTCDate() + dayIndex);

    return {
      dayIndex,
      dayName: dayNames[dayIndex],

      month: currentDate.getUTCMonth() + 1,
      date: currentDate.getUTCDate(),
      year: currentDate.getUTCFullYear(),

      income: data.income,
      expense: data.expense,
      transactionCount: data.transactionCount,
    };
  });

  return {
    weekStart: start,
    weekEnd: new Date(end.getTime() - 1),
    totalIncome,
    totalExpense,
    weekSummary: result,
  };
};

//
export const transactionServices = {
  addNewTransaction,
  addManyTransaction,
  updateTransaction,

  deleteTransactionData,
  getDailyTransactions,
  getYearlySummary,
  getMonthlyTransactions,
  moneyManagement,
  getWeeklySummary,
};
