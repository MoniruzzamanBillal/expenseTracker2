import { ObjectId } from "mongoose";
import { transactionConstants } from "./transaction.constant";

export interface TTransaction {
  user?: ObjectId;
  type: keyof typeof transactionConstants;
  title: string;
  description: string;
  amount: number;
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}
