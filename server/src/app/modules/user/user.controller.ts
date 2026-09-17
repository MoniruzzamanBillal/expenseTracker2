import httpStatus from "http-status";
import catchAsync from "../../util/catchAsync";
import sendResponse from "../../util/sendResponse";
import { userServices } from "./user.services";

// ! for crating a user
const crateUser = catchAsync(async (req, res) => {
  const result = await userServices.createUser(req.body);

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "User created successfully!!!",
    data: result,
  });
});

// ! for login
const signIn = catchAsync(async (req, res) => {
  const result = await userServices.loginFromDb(req.body);

  const { userData, token } = result;

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "User logged in successfully!!!",
    data: userData,
    token: token,
  });
});

// ! for getting the logged-in user's own profile
const getMe = catchAsync(async (req, res) => {
  const result = await userServices.getMe(req.user.userId);
  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

// ! for updating the logged-in user's own profile
const updateProfile = catchAsync(async (req, res) => {
  const result = await userServices.updateProfile(req.user.userId, req.body);
  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

//
export const userController = {
  crateUser,
  signIn,
  getMe,
  updateProfile,
};
