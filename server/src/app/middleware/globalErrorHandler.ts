import { ErrorRequestHandler } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import AppError from "../Error/AppError";
import { handleCastError } from "../Error/handleCatError";
import { handleDuplicateError } from "../Error/handleDuplicateError";
import { handleValidationError } from "../Error/handleValidationError";
import { handleZodError } from "../Error/handleZodError";
import { TerrorSource } from "../interface/error";
import { errorLogServices } from "../modules/errorLog/errorLog.service";

const globalErrorHandler: ErrorRequestHandler = async (
  error,
  req,
  res,
  next,
) => {
  let status = error.status || 500;
  let message = error.message || "Something went wrong!!";

  let errorSources: TerrorSource = [
    {
      path: "",
      message: "",
    },
  ];

  // ! zod validation error
  if (error instanceof ZodError) {
    const simplifiedError = handleZodError(error);
    status = simplifiedError?.statusCode;
    message = simplifiedError?.message;
    errorSources = simplifiedError?.errorSources;
  }

  // ! mongoose validation error
  else if (error?.name === "ValidationError") {
    const simplifiedError = handleValidationError(error);
    status = simplifiedError?.statusCode;
    message = simplifiedError?.message;
    errorSources = simplifiedError?.errorSources;
  }

  // ! cast error
  if (error?.name === "CastError") {
    const simplifiedError = handleCastError(error);
    status = simplifiedError?.statusCode;
    message = simplifiedError?.message;
    errorSources = simplifiedError?.errorSources;
  }

  // ! handle duplicate error
  else if (error?.code === 11000) {
    const simplifiedError = handleDuplicateError(error);
    status = simplifiedError?.statusCode;
    message = simplifiedError?.message;
    errorSources = simplifiedError?.errorSources;
  }

  // ! handle custom app error
  else if (error instanceof AppError) {
    status = error?.status;
    message = error?.message;
    errorSources = [{ path: "", message: error?.message }];
  }

  // ! await'd, not fire-and-forget: on Vercel serverless an invocation can be torn down the
  // ! moment the response is flushed, so a write issued after res.json() isn't guaranteed to
  // ! complete. Self-contained try/catch — a failure to log must never block, replace, or
  // ! change the error response the client gets (spec 17 D1).
  try {
    await errorLogServices.createErrorLog({
      status,
      message,
      errorName: error?.name,
      errorSources,
      // ! 404s are the highest-volume row on a public URL (bot scans) and their stack is
      // ! synthetic — it only points at app.ts's catch-all. Skip it (spec 17 D9).
      // ! For a thrown non-Error (#ERR-7) `stack` is undefined and `message` is the generic
      // ! fallback, so keep the raw value instead or the cause is lost entirely.
      stack:
        status === httpStatus.NOT_FOUND
          ? undefined
          : (error?.stack ?? (error == null ? undefined : String(error))),
      method: req.method,
      path: req.originalUrl,
      userId: req.user?.userId ?? null,
      userEmail: req.user?.userEmail ?? null,
    });
  } catch (logError) {
    // eslint-disable-next-line no-console
    console.error("Failed to persist error log:", logError);
  }

  return res.status(status).json({
    success: false,
    message,
    errorSources,
    stack: error?.stack,
  });
};

export default globalErrorHandler;
