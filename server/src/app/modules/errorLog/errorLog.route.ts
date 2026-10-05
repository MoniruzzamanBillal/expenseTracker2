import { Router } from "express";
import adminCheck from "../../middleware/adminCheck";
import authCheck from "../../middleware/authCheck";
import { errorLogController } from "./errorLog.controller";

const router = Router();

// ! for listing error logs
router.get("/", authCheck, adminCheck, errorLogController.getErrorLogs);

// ! for getting a single error log
router.get("/:id", authCheck, adminCheck, errorLogController.getErrorLogById);

export const errorLogRouter = router;

// ! separate router, mounted under /cron — no authCheck/adminCheck, protected by the
// ! x-cron-secret header instead (see errorLog.controller.ts)
const cronRouter = Router();

cronRouter.post(
  "/cleanup-error-logs",
  errorLogController.cleanupExpiredErrorLogs,
);

export const errorLogCronRouter = cronRouter;
