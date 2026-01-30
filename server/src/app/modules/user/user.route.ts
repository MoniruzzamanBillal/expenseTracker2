import { Router } from "express";
import validateRequest from "../../middleware/validateRequest";
import { userController } from "./user.controller";
import { userValidations } from "./user.validation";

const router = Router();

// ! for registering a user
router.post(
  "/register",
  validateRequest(userValidations.createUserSchema),
  userController.crateUser,
);

// ! for login
router.post(
  "/login",
  validateRequest(userValidations.loginValidationSchema),
  userController.signIn,
);

//
export const userRouter = router;
