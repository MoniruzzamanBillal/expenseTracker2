"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const multer_1 = __importDefault(require("multer"));
const AppError_1 = __importDefault(require("../Error/AppError"));
const fileFilter = (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
        return cb(null, true);
    }
    cb(new AppError_1.default(http_status_1.default.BAD_REQUEST, "Only image or PDF files are allowed"));
};
const uploadReceiptFile = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});
exports.default = uploadReceiptFile;
