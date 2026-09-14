import httpStatus from "http-status";
import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import AppError from "../Error/AppError";

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    return cb(null, true);
  }
  cb(new AppError(httpStatus.BAD_REQUEST, "Only image or PDF files are allowed"));
};

const uploadReceiptFile = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export default uploadReceiptFile;
