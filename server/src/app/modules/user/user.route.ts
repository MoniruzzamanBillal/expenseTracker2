import { Router } from "express";
import authCheck from "../../middleware/authCheck";
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

// ! for exchanging a refresh token for a new access token (spec 18).
// ! Deliberately NO authCheck: the caller's access token is expired, which is the whole
// ! reason this endpoint is being hit. Authentication here IS the refresh token's signature.
router.post(
  "/refresh-token",
  validateRequest(userValidations.refreshTokenSchema),
  userController.refreshToken,
);

// ! for getting the logged-in user's own profile
router.get("/me", authCheck, userController.getMe);

// ! for updating the logged-in user's own profile
router.patch(
  "/update-profile",
  authCheck,
  validateRequest(userValidations.updateProfileSchema),
  userController.updateProfile,
);

//
export const userRouter = router;
