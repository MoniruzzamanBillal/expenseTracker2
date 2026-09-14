import { Router } from "express";
import authCheck from "../../middleware/authCheck";
import validateRequest from "../../middleware/validateRequest";
import { categoryController } from "./category.controller";
import { categoryValidations } from "./category.validation";

const router = Router();

// ! for creating a category
router.post(
  "/",
  authCheck,
  validateRequest(categoryValidations.createCategorySchema),
  categoryController.createCategory,
);

// ! for getting the logged-in user's own categories
router.get("/", authCheck, categoryController.getCategories);

// ! for updating a category
router.patch(
  "/:id",
  authCheck,
  validateRequest(categoryValidations.updateCategorySchema),
  categoryController.updateCategory,
);

// ! for soft-deleting a category
router.patch("/:id/delete", authCheck, categoryController.deleteCategory);

//
export const categoryRouter = router;
