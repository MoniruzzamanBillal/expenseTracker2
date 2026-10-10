import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import morgan from "morgan";

import cookieParser from "cookie-parser";
import httpStatus from "http-status";
import AppError from "./app/Error/AppError";
import globalErrorHandler from "./app/middleware/globalErrorHandler";
import { MainRouter } from "./app/router";

const app: Application = express();

app.use(express.json());

// app.use(cors());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8081",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(morgan("dev"));
app.use(cookieParser());

// ! rouutes
app.use("/api", MainRouter);

app.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.send({ message: "server is running  !! " });
  } catch (error) {
    next(error);
  }
});

// ! not found route — must sit BEFORE globalErrorHandler and hand off via next(), so an
// ! unmatched route is formatted and LOGGED by the one error path like every other failure
// ! (spec 17 D8, closes known-issues.md#ERR-6). Responding directly here, after the error
// ! handler was already mounted, is what kept every 404 out of the logs: Express only invokes
// ! 4-arity error middleware on an error, so this handler was never reached through it.
// ! The requested path isn't lost — globalErrorHandler records req.originalUrl on the log row.
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(httpStatus.NOT_FOUND, "API NOT FOUND!"));
});

//! global error handler — last, so nothing registered after it can be skipped
app.use(globalErrorHandler);

export default app;
