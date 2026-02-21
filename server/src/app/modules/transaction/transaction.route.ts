import { Router } from "express";
import authCheck from "../../middleware/authCheck";
import validateRequest from "../../middleware/validateRequest";
import { transactionControllers } from "./transaction.controller";
import { transactionValidationSchemas } from "./transaction.validation";

const router = Router();

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
router.post("/manage-money", transactionControllers.moneyManagement);

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

//
export const transactionRouter = router;
