import { NextFunction, Request, Response, Router } from "express";
import httpStatus from "http-status";
import multer from "multer";
import AppError from "../../Error/AppError";
import authCheck from "../../middleware/authCheck";
import uploadReceiptFile from "../../middleware/uploadReceiptFile";
import validateRequest from "../../middleware/validateRequest";
import { transactionControllers } from "./transaction.controller";
import { transactionValidationSchemas } from "./transaction.validation";

const router = Router();

// ! multer.MulterError (e.g. exceeding the 10MB size limit) isn't an AppError and has no
// ! `.status`, so globalErrorHandler's generic fallback would otherwise turn it into an
// ! unhelpful 500 — normalize it to a clean 400 here, scoped to just this route.
const handleReceiptFileUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploadReceiptFile.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      return next(new AppError(httpStatus.BAD_REQUEST, error.message));
    }
    if (error) {
      return next(error);
    }
    next();
  });
};

// ! Get monthly transactions
router.get(
  "/monthly-transaction",
  authCheck,
  transactionControllers.getMonthlyTransactions,
);

// ! for getting the daily transaction
router.get(
  "/daily-transaction",
  authCheck,
  transactionControllers.getDailyTransactions,
);

// ! for getting the yearly transaction
router.get(
  "/yearly-transaction",
  authCheck,
  transactionControllers.getYearlySummary,
);

// ! for getting the weekly transaction
router.get(
  "/weekly-transaction",
  authCheck,
  transactionControllers.getWeeklySummary,
);

// ! for getting the rolling N-month trend summary
router.get(
  "/trend-transaction",
  authCheck,
  transactionControllers.getTrendSummary,
);

// ! for adding new transaction
router.post(
  "/new-transaction",
  authCheck,
  validateRequest(transactionValidationSchemas.createTransactionSchema),
  transactionControllers.addNewTransaction,
);

// ! for adding many transaction
router.post(
  "/many-transaction",
  authCheck,
  transactionControllers.addManyTransaction,
);

// ! for money management , giving prompt to generate cost-spendature
router.post(
  "/manage-money",
  authCheck,
  transactionControllers.moneyManagement,
);

// ! for updating transaction
router.patch(
  "/update-transaction/:transactionId",
  authCheck,
  validateRequest(transactionValidationSchemas.updateTransactionSchema),
  transactionControllers.updateTransaction,
);

// ! for deletig transaction data
router.patch(
  "/delete-transaction/:transactionId",
  authCheck,
  transactionControllers.deleteTransactionData,
);

// ! for uploading/replacing a transaction's receipt file (image or PDF)
router.put(
  "/receipt-file/:transactionId",
  authCheck,
  handleReceiptFileUpload,
  transactionControllers.uploadReceiptFile,
);

// ! for removing a transaction's receipt file
router.delete(
  "/receipt-file/:transactionId",
  authCheck,
  transactionControllers.deleteReceiptFile,
);

//
export const transactionRouter = router;
