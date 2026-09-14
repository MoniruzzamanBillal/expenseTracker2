"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionRouter = void 0;
const express_1 = require("express");
const http_status_1 = __importDefault(require("http-status"));
const multer_1 = __importDefault(require("multer"));
const AppError_1 = __importDefault(require("../../Error/AppError"));
const authCheck_1 = __importDefault(require("../../middleware/authCheck"));
const uploadReceiptFile_1 = __importDefault(require("../../middleware/uploadReceiptFile"));
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const transaction_controller_1 = require("./transaction.controller");
const transaction_validation_1 = require("./transaction.validation");
const router = (0, express_1.Router)();
// ! multer.MulterError (e.g. exceeding the 10MB size limit) isn't an AppError and has no
// ! `.status`, so globalErrorHandler's generic fallback would otherwise turn it into an
// ! unhelpful 500 — normalize it to a clean 400 here, scoped to just this route.
const handleReceiptFileUpload = (req, res, next) => {
    uploadReceiptFile_1.default.single("file")(req, res, (error) => {
        if (error instanceof multer_1.default.MulterError) {
            return next(new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message));
        }
        if (error) {
            return next(error);
        }
        next();
    });
};
// ! Get monthly transactions
router.get("/monthly-transaction", authCheck_1.default, transaction_controller_1.transactionControllers.getMonthlyTransactions);
// ! for getting the daily transaction
router.get("/daily-transaction", authCheck_1.default, transaction_controller_1.transactionControllers.getDailyTransactions);
// ! for getting the yearly transaction
router.get("/yearly-transaction", authCheck_1.default, transaction_controller_1.transactionControllers.getYearlySummary);
// ! for getting the weekly transaction
router.get("/weekly-transaction", authCheck_1.default, transaction_controller_1.transactionControllers.getWeeklySummary);
// ! for getting the rolling N-month trend summary
router.get("/trend-transaction", authCheck_1.default, transaction_controller_1.transactionControllers.getTrendSummary);
// ! for adding new transaction
router.post("/new-transaction", authCheck_1.default, (0, validateRequest_1.default)(transaction_validation_1.transactionValidationSchemas.createTransactionSchema), transaction_controller_1.transactionControllers.addNewTransaction);
// ! for adding many transaction
router.post("/many-transaction", authCheck_1.default, transaction_controller_1.transactionControllers.addManyTransaction);
// ! for money management , giving prompt to generate cost-spendature
router.post("/manage-money", authCheck_1.default, transaction_controller_1.transactionControllers.moneyManagement);
// ! for updating transaction
router.patch("/update-transaction/:transactionId", authCheck_1.default, (0, validateRequest_1.default)(transaction_validation_1.transactionValidationSchemas.updateTransactionSchema), transaction_controller_1.transactionControllers.updateTransaction);
// ! for deletig transaction data
router.patch("/delete-transaction/:transactionId", authCheck_1.default, transaction_controller_1.transactionControllers.deleteTransactionData);
// ! for uploading/replacing a transaction's receipt file (image or PDF)
router.put("/receipt-file/:transactionId", authCheck_1.default, handleReceiptFileUpload, transaction_controller_1.transactionControllers.uploadReceiptFile);
// ! for removing a transaction's receipt file
router.delete("/receipt-file/:transactionId", authCheck_1.default, transaction_controller_1.transactionControllers.deleteReceiptFile);
//
exports.transactionRouter = router;
