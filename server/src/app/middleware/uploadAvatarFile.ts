import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import multer, { FileFilterCallback } from "multer";
import AppError from "../Error/AppError";

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (file.mimetype.startsWith("image/")) {
    return cb(null, true);
  }
  cb(new AppError(httpStatus.BAD_REQUEST, "Only image files are allowed"));
};

// ! 2MB, deliberately well BELOW Vercel's ~4.5MB serverless request-body cap. A body over
// ! that cap is rejected at the platform edge before this function is invoked, so multer
// ! never raises a MulterError and the clean 400 below would be unreachable (see
// ! uploadReceiptFile.ts). The client resizes to 512px (~50-150KB), so 2MB is generous.
const uploadAvatarFile = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

// ! multer.MulterError (e.g. exceeding the size limit) isn't an AppError and has no
// ! `.status`, so globalErrorHandler would turn it into a 500 - normalize it to a 400.
const handleAvatarFileUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploadAvatarFile.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      return next(new AppError(httpStatus.BAD_REQUEST, error.message));
    }
    if (error) {
      return next(error);
    }
    next();
  });
};

export { handleAvatarFileUpload };
export default uploadAvatarFile;
