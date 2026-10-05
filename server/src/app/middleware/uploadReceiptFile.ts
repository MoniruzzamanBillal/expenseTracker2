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

// ! 4MB, deliberately BELOW Vercel's ~4.5MB serverless request-body cap. A body over that
// ! cap is rejected at the platform edge before this function is invoked, so multer never
// ! raises a MulterError, transaction.route.ts's wrapper never normalizes it to a 400, and
// ! globalErrorHandler never shapes the response — the caller gets Vercel's own
// ! { error: { code, message } } instead, whose `message` our client can't even read.
// ! Keeping the limit under the cap is what makes the clean 400 reachable at all.
const uploadReceiptFile = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 },
});

export default uploadReceiptFile;
