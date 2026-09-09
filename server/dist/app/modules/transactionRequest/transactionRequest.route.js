"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionRequestRouter = void 0;
const express_1 = require("express");
const authCheck_1 = __importDefault(require("../../middleware/authCheck"));
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const transactionRequest_controller_1 = require("./transactionRequest.controller");
const transactionRequest_validation_1 = require("./transactionRequest.validation");
const router = (0, express_1.Router)();
// ! for ingesting a transaction request from another app (shared-secret auth, no JWT)
router.post("/ingest", (0, validateRequest_1.default)(transactionRequest_validation_1.transactionRequestValidationSchemas.ingestTransactionRequestSchema), transactionRequest_controller_1.transactionRequestControllers.ingest);
// ! for listing the logged-in user's own pending transaction requests
router.get("/", authCheck_1.default, transactionRequest_controller_1.transactionRequestControllers.list);
// ! for accepting a transaction request
router.patch("/:id/accept", authCheck_1.default, (0, validateRequest_1.default)(transactionRequest_validation_1.transactionRequestValidationSchemas.acceptTransactionRequestSchema), transactionRequest_controller_1.transactionRequestControllers.accept);
// ! for rejecting a transaction request
router.patch("/:id/reject", authCheck_1.default, transactionRequest_controller_1.transactionRequestControllers.reject);
//
exports.transactionRequestRouter = router;
