import httpStatus from "http-status";
import config from "../../config";
import AppError from "../../Error/AppError";
import catchAsync from "../../util/catchAsync";
import sendResponse from "../../util/sendResponse";
import { transactionRequestServices } from "./transactionRequest.service";

// ! for ingesting a transaction request from another app (shared-secret auth, no JWT)
const ingest = catchAsync(async (req, res) => {
  const key = req.headers["x-integration-key"];

  if (typeof key !== "string" || key !== config.integrationApiKey) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid or missing integration key",
    );
  }

  const result = await transactionRequestServices.ingestTransactionRequest(
    req.body,
  );

  sendResponse(res, {
    status: httpStatus.CREATED,
    success: true,
    message: "Transaction request received",
    data: result,
  });
});

// ! for listing the logged-in user's own pending transaction requests
const list = catchAsync(async (req, res) => {
  const result = await transactionRequestServices.getPendingTransactionRequests(
    req?.user?.userEmail,
  );

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Transaction requests retrieved successfully",
    data: result,
  });
});

// ! for accepting a transaction request
const accept = catchAsync(async (req, res) => {
  const result = await transactionRequestServices.acceptTransactionRequest(
    req.params?.id,
    req?.user?.userEmail,
    req?.user?.userId,
    req?.body,
  );

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Transaction request accepted",
    data: result,
  });
});

// ! for rejecting a transaction request
const reject = catchAsync(async (req, res) => {
  const result = await transactionRequestServices.rejectTransactionRequest(
    req.params?.id,
    req?.user?.userEmail,
  );

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Transaction request rejected",
    data: result,
  });
});

//
export const transactionRequestControllers = {
  ingest,
  list,
  accept,
  reject,
};
