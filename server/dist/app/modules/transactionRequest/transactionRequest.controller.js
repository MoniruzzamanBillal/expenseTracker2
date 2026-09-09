"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionRequestControllers = void 0;
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../config"));
const AppError_1 = __importDefault(require("../../Error/AppError"));
const catchAsync_1 = __importDefault(require("../../util/catchAsync"));
const sendResponse_1 = __importDefault(require("../../util/sendResponse"));
const transactionRequest_service_1 = require("./transactionRequest.service");
// ! for ingesting a transaction request from another app (shared-secret auth, no JWT)
const ingest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const key = req.headers["x-integration-key"];
    if (typeof key !== "string" || key !== config_1.default.integrationApiKey) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, "Invalid or missing integration key");
    }
    const result = yield transactionRequest_service_1.transactionRequestServices.ingestTransactionRequest(req.body);
    (0, sendResponse_1.default)(res, {
        status: http_status_1.default.CREATED,
        success: true,
        message: "Transaction request received",
        data: result,
    });
}));
// ! for listing the logged-in user's own pending transaction requests
const list = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield transactionRequest_service_1.transactionRequestServices.getPendingTransactionRequests((_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.userEmail);
    (0, sendResponse_1.default)(res, {
        status: http_status_1.default.OK,
        success: true,
        message: "Transaction requests retrieved successfully",
        data: result,
    });
}));
// ! for accepting a transaction request
const accept = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const result = yield transactionRequest_service_1.transactionRequestServices.acceptTransactionRequest((_a = req.params) === null || _a === void 0 ? void 0 : _a.id, (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.userEmail, (_c = req === null || req === void 0 ? void 0 : req.user) === null || _c === void 0 ? void 0 : _c.userId, req === null || req === void 0 ? void 0 : req.body);
    (0, sendResponse_1.default)(res, {
        status: http_status_1.default.OK,
        success: true,
        message: "Transaction request accepted",
        data: result,
    });
}));
// ! for rejecting a transaction request
const reject = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const result = yield transactionRequest_service_1.transactionRequestServices.rejectTransactionRequest((_a = req.params) === null || _a === void 0 ? void 0 : _a.id, (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.userEmail);
    (0, sendResponse_1.default)(res, {
        status: http_status_1.default.OK,
        success: true,
        message: "Transaction request rejected",
        data: result,
    });
}));
//
exports.transactionRequestControllers = {
    ingest,
    list,
    accept,
    reject,
};
