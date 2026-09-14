"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetRouter = void 0;
const express_1 = require("express");
const authCheck_1 = __importDefault(require("../../middleware/authCheck"));
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const budget_controller_1 = require("./budget.controller");
const budget_validation_1 = require("./budget.validation");
const router = (0, express_1.Router)();
// ! for creating a budget
router.post("/", authCheck_1.default, (0, validateRequest_1.default)(budget_validation_1.budgetValidations.createBudgetSchema), budget_controller_1.budgetController.createBudget);
// ! for listing the user's budgets
router.get("/", authCheck_1.default, budget_controller_1.budgetController.getBudgets);
// ! for updating a budget's limit
router.patch("/:id", authCheck_1.default, (0, validateRequest_1.default)(budget_validation_1.budgetValidations.updateBudgetSchema), budget_controller_1.budgetController.updateBudget);
// ! for deleting a budget
router.delete("/:id", authCheck_1.default, budget_controller_1.budgetController.deleteBudget);
//
exports.budgetRouter = router;
