import AsyncStorage from "@react-native-async-storage/async-storage";
import { TransactionTypeConst } from "@/constants/TransactionType.constant";

const QUEUE_KEY = "pendingTransactions";

export type TPendingTransactionPayload = {
  type: keyof typeof TransactionTypeConst;
  amount: number;
  title: string;
  description?: string;
};

export type TPendingTransactionOrigin = "manual" | "smart-add";
export type TPendingTransactionStatus = "pending" | "failed";

export type TPendingTransaction = {
  localId: string;
  payload: TPendingTransactionPayload;
  origin: TPendingTransactionOrigin;
  batchId?: string;
  status: TPendingTransactionStatus;
  error?: string;
  createdAt: string;
};

export type TEnqueueInput = {
  payload: TPendingTransactionPayload;
  origin: TPendingTransactionOrigin;
  batchId?: string;
};

// crypto.randomUUID() isn't guaranteed to exist in the Hermes runtime without a polyfill —
// fall back to a manual id rather than pulling in a uuid dependency for this.
const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const readQueue = async (): Promise<TPendingTransaction[]> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as TPendingTransaction[];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: TPendingTransaction[]): Promise<void> => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const enqueue = async (
  items: TEnqueueInput[],
): Promise<TPendingTransaction[]> => {
  const queue = await readQueue();
  const now = new Date().toISOString();

  const newEntries: TPendingTransaction[] = items.map((item) => ({
    localId: generateId(),
    payload: item.payload,
    origin: item.origin,
    batchId: item.batchId,
    status: "pending",
    createdAt: now,
  }));

  await writeQueue([...queue, ...newEntries]);
  return newEntries;
};

const remove = async (localId: string): Promise<void> => {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.localId !== localId));
};

const updateStatus = async (
  localId: string,
  status: TPendingTransactionStatus,
  error?: string,
): Promise<void> => {
  const queue = await readQueue();
  const updated = queue.map((item) =>
    item.localId === localId ? { ...item, status, error } : item,
  );
  await writeQueue(updated);
};

export const transactionQueue = {
  getAll: readQueue,
  enqueue,
  remove,
  updateStatus,
};

export const createBatchId = generateId;
