import { Router } from "express";
import authCheck from "../../middleware/authCheck";
import validateRequest from "../../middleware/validateRequest";
import { budgetController } from "./budget.controller";
import { budgetValidations } from "./budget.validation";

const router = Router();

// ! for creating a budget
router.post(
  "/",
  authCheck,
  validateRequest(budgetValidations.createBudgetSchema),
  budgetController.createBudget,
);

// ! for listing the user's budgets
router.get("/", authCheck, budgetController.getBudgets);

// ! for updating a budget's limit
router.patch(
  "/:id",
  authCheck,
  validateRequest(budgetValidations.updateBudgetSchema),
  budgetController.updateBudget,
);

// ! for deleting a budget
router.delete("/:id", authCheck, budgetController.deleteBudget);

//
export const budgetRouter = router;
