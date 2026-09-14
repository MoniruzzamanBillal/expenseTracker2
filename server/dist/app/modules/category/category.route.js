"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryRouter = void 0;
const express_1 = require("express");
const authCheck_1 = __importDefault(require("../../middleware/authCheck"));
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const category_controller_1 = require("./category.controller");
const category_validation_1 = require("./category.validation");
const router = (0, express_1.Router)();
// ! for creating a category
router.post("/", authCheck_1.default, (0, validateRequest_1.default)(category_validation_1.categoryValidations.createCategorySchema), category_controller_1.categoryController.createCategory);
// ! for getting the logged-in user's own categories
router.get("/", authCheck_1.default, category_controller_1.categoryController.getCategories);
// ! for updating a category
router.patch("/:id", authCheck_1.default, (0, validateRequest_1.default)(category_validation_1.categoryValidations.updateCategorySchema), category_controller_1.categoryController.updateCategory);
// ! for soft-deleting a category
router.patch("/:id/delete", authCheck_1.default, category_controller_1.categoryController.deleteCategory);
//
exports.categoryRouter = router;
