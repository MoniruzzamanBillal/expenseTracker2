import { api, unwrap } from './api';

// ─── Shared transaction shape ────────────────────────────────────────────────
export interface Transaction {
  _id: string;
  userId: string;
  type: 'income' | 'expense';
  title: string;
  description: string | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────
export interface DailyData {
  income: number;
  expense: number;
  transactions: Transaction[];
}

export interface DayBucket {
  date: string;        // "2026-08-03"
  income: number;
  expense: number;
  transactions: Transaction[];
}

export interface MonthlyData {
  income: number;
  expense: number;
  transactionData: DayBucket[];
}

export interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  income: number;
  expense: number;
  transactionData: DayBucket[];
}

export interface MonthSummary {
  month: number;           // 0-indexed: 0 = Jan
  income: number;
  expense: number;
  transactionCount: number;
}

export interface YearlyData {
  totalIncome: number;
  totalExpense: number;
  yearSummary: MonthSummary[];
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────
export async function fetchDaily(): Promise<DailyData> {
  const res = await api.get('/api/transactions/daily-transaction');
  return unwrap<DailyData>(res).data;
}

export async function fetchMonthly(targetMonth: number): Promise<MonthlyData> {
  const res = await api.get('/api/transactions/monthly-transaction', {
    params: { targetMonth },
  });
  return unwrap<MonthlyData>(res).data;
}

export async function fetchWeekly(): Promise<WeeklyData> {
  const res = await api.get('/api/transactions/weekly-transaction');
  return unwrap<WeeklyData>(res).data;
}

export async function fetchYearly(targetYear: number): Promise<YearlyData> {
  const res = await api.get('/api/transactions/yearly-transaction', {
    params: { targetYear },
  });
  return unwrap<YearlyData>(res).data;
}

export async function createTransaction(payload: {
  type: 'income' | 'expense';
  title: string;
  amount: number;
  description?: string;
}): Promise<Transaction> {
  const res = await api.post('/api/transactions/new-transaction', payload);
  return unwrap<Transaction>(res).data;
}

/** Smart Add step 1: parse free text → unsaved transactions */
export async function parseTransactions(prompt: string): Promise<Omit<Transaction, '_id' | 'createdAt' | 'updatedAt' | 'userId'>[]> {
  const res = await api.post('/api/transactions/manage-money', { prompt });
  return unwrap(res).data as any;
}

/** Smart Add step 2: save all parsed transactions */
export async function saveManyTransactions(
  items: { type: 'income' | 'expense'; title: string; amount: number; description?: string }[]
): Promise<Transaction[]> {
  const res = await api.post('/api/transactions/many-transaction', { transactions: items });
  return unwrap<Transaction[]>(res).data;
}

export async function updateTransaction(
  id: string,
  payload: Partial<Pick<Transaction, 'type' | 'title' | 'amount' | 'description'>>
): Promise<Transaction> {
  const res = await api.patch(`/api/transactions/update-transaction/${id}`, payload);
  return unwrap<Transaction>(res).data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.patch(`/api/transactions/delete-transaction/${id}`);
}
