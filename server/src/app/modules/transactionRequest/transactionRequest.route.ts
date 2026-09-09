import { Router } from "express";
import authCheck from "../../middleware/authCheck";
import validateRequest from "../../middleware/validateRequest";
import { transactionRequestControllers } from "./transactionRequest.controller";
import { transactionRequestValidationSchemas } from "./transactionRequest.validation";

const router = Router();

// ! for ingesting a transaction request from another app (shared-secret auth, no JWT)
router.post(
  "/ingest",
  validateRequest(transactionRequestValidationSchemas.ingestTransactionRequestSchema),
  transactionRequestControllers.ingest,
);

// ! for listing the logged-in user's own pending transaction requests
router.get("/", authCheck, transactionRequestControllers.list);

// ! for accepting a transaction request
router.patch(
  "/:id/accept",
  authCheck,
  validateRequest(transactionRequestValidationSchemas.acceptTransactionRequestSchema),
  transactionRequestControllers.accept,
);

// ! for rejecting a transaction request
router.patch("/:id/reject", authCheck, transactionRequestControllers.reject);

//
export const transactionRequestRouter = router;
