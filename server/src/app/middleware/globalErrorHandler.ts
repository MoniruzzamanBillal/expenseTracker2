import { ErrorRequestHandler } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import AppError from "../Error/AppError";
import config from "../config";
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
    // ! #ERR-1 (spec 19 D5): the stack used to go out unconditionally, in every
    // ! environment - confirmed live on the Vercel deployment, /var/task/dist paths and all.
    // !
    // ! The test is `=== "development"`, NOT `!== "production"`, and that is the whole
    // ! point. Both hide it on Vercel (which sets NODE_ENV=production for production AND
    // ! preview), but they differ where it matters: an environment whose NODE_ENV is unset,
    // ! misspelled or lost. `!== "production"` leaks there; this fails closed. A missing env
    // ! var is the likeliest misconfiguration in a project whose .env is gitignored and
    // ! hand-synced to Vercel, so silence is the right default.
    // !
    // ! Nothing is lost in production (spec 19 D7): the stack is persisted on the error_logs
    // ! row by the insert directly above, served at GET /api/admin/error-logs/:id behind
    // ! authCheck + adminCheck, and the client already renders it from there
    // ! (components/main/ErrorLogs/ErrorLogDetailSheet.tsx). Don't "restore" this for
    // ! debuggability - the stack is already available, to an admin instead of to everyone.
    // !
    // ! `undefined`, not null, so res.json drops the key entirely - the same mechanism
    // ! sendResponse relies on for its optional token/refreshToken.
    stack: config.node_env === "development" ? error?.stack : undefined,
  });
};

export default globalErrorHandler;
