import { Prisma } from "@prisma/client";
import httpStatus from "http-status";
import AppError from "../../Error/AppError";
import { prisma } from "../../lib/prisma";
import { transactionServices } from "../transaction/transaction.service";
import { generateObjectId } from "../../util/generateObjectId";
import {
  TAcceptTransactionRequestEdits,
  TIngestTransactionRequest,
} from "./transactionRequest.interface";

const toApiShape = <T extends { id: string; amount: unknown }>(t: T) => ({
  ...t,
  _id: t.id,
  amount: Number(t.amount),
});

// ! for ingesting a transaction request from another app (e.g. bikelog)
const ingestTransactionRequest = async (payload: TIngestTransactionRequest) => {
  try {
    const result = await prisma.transactionRequest.create({
      data: {
        id: generateObjectId(),
        userEmail: payload.userEmail,
        sourceApp: payload.sourceApp,
        sourceType: payload.sourceType,
        sourceRecordId: payload.sourceRecordId,
        type: payload.type ?? "expense",
        title: payload.title,
        description: payload.description,
        amount: payload.amount,
        occurredAt: new Date(payload.occurredAt),
      },
    });

    return toApiShape(result);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.transactionRequest.findUnique({
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
};

// ! for listing the logged-in user's own pending transaction requests
const getPendingTransactionRequests = async (userEmail: string) => {
  const result = await prisma.transactionRequest.findMany({
    where: { userEmail, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return result.map(toApiShape);
};

// ! for accepting a transaction request — creates a real Transaction, atomically
const acceptTransactionRequest = async (
  id: string,
  userEmail: string,
  userId: string,
  edits: TAcceptTransactionRequestEdits,
) => {
  const transactionRequest = await prisma.transactionRequest.findFirst({
    where: { id, userEmail, status: "pending" },
  });

  if (!transactionRequest) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Transaction request not found or already reviewed",
    );
  }

  const title = edits.title ?? transactionRequest.title;
  const description = edits.description ?? transactionRequest.description ?? undefined;
  const amount = edits.amount ?? Number(transactionRequest.amount);

  return prisma.$transaction(async (tx) => {
    const transaction = await transactionServices.addNewTransaction(
      { type: "expense", title, description, amount, isDeleted: false },
      userId,
      tx,
    );

    const updatedRequest = await tx.transactionRequest.update({
      where: { id },
      data: {
        status: "accepted",
        transactionId: transaction._id,
        reviewedAt: new Date(),
      },
    });

    return { transaction, transactionRequest: toApiShape(updatedRequest) };
  });
};

// ! for rejecting a transaction request — soft status flip, kept for audit
const rejectTransactionRequest = async (id: string, userEmail: string) => {
  const transactionRequest = await prisma.transactionRequest.findFirst({
    where: { id, userEmail, status: "pending" },
  });

  if (!transactionRequest) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Transaction request not found or already reviewed",
    );
  }

  const result = await prisma.transactionRequest.update({
    where: { id },
    data: { status: "rejected", reviewedAt: new Date() },
  });

  return toApiShape(result);
};

//
export const transactionRequestServices = {
  ingestTransactionRequest,
  getPendingTransactionRequests,
  acceptTransactionRequest,
  rejectTransactionRequest,
};
