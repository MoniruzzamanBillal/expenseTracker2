import httpStatus from "http-status";
import config from "../../config";
import AppError from "../../Error/AppError";
import catchAsync from "../../util/catchAsync";
import sendResponse from "../../util/sendResponse";
import { errorLogServices } from "./errorLog.service";

// ! for listing error logs (admin only)
const getErrorLogs = catchAsync(async (req, res) => {
  const result = await errorLogServices.getErrorLogsFromDB(
    req.query as Record<string, unknown>,
  );

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Error logs retrieved successfully",
    data: result,
  });
});

// ! for getting a single error log (admin only)
const getErrorLogById = catchAsync(async (req, res) => {
  const result = await errorLogServices.getErrorLogByIdFromDB(req.params?.id);

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Error log retrieved successfully",
    data: result,
  });
});

// ! machine-to-machine endpoint hit by a scheduled job, not a logged-in admin — guarded by a
// ! shared secret header instead of authCheck/adminCheck, same shape as
// ! transactionRequest.controller.ts's ingest (spec 17 D6)
const cleanupExpiredErrorLogs = catchAsync(async (req, res) => {
  const secret = req.headers["x-cron-secret"];

  if (typeof secret !== "string" || secret !== config.cronSecret) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid or missing cron secret",
    );
  }

  const result = await errorLogServices.cleanupExpiredErrorLogsFromDB();

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Expired error logs cleaned up",
    data: result,
  });
});

export const errorLogController = {
  getErrorLogs,
  getErrorLogById,
  cleanupExpiredErrorLogs,
};
