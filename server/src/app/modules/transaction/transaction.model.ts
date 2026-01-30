import { model, Schema } from "mongoose";
import { transactionConstants } from "./transaction.constant";
import { TTransaction } from "./transaction.interface";

const transactionSchema = new Schema<TTransaction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required !!!"],
    },

    type: {
      type: String,
      enum: Object.values(transactionConstants),
      required: [true, "Transaction type is required !!!"],
    },

    title: {
      type: String,
      required: [true, "Transaction title is required !!!"],
      trim: true,
    },
    description: {
      type: String,
      // required: [true, "Transaction description is required !!!"],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Transaction amount is required !!!"],
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

//
export const transactionModel = model<TTransaction>(
  "Transaction",
  transactionSchema,
);
