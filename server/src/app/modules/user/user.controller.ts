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

  const { userData, accessToken, refreshToken } = result;

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "User logged in successfully!!!",
    data: userData,
    // ! the access token keeps the existing top-level `token` field rather than moving into
    // ! `data`, so "where is the access token" has one answer on both login and refresh
    // ! (spec 18 D6).
    token: accessToken,
    refreshToken,
  });
});

// ! for exchanging a refresh token for a new access token (spec 18). No authCheck on the
// ! route: the access token is expired by definition when the client calls this.
const refreshToken = catchAsync(async (req, res) => {
  const result = await userServices.refreshAccessToken(req.body.refreshToken);

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Access token refreshed successfully",
    data: null,
    token: result.accessToken,
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

// ! for setting/replacing the logged-in user's profile picture (spec 20)
const updateProfilePicture = catchAsync(async (req, res) => {
  const result = await userServices.updateProfilePicture(
    req.user.userId,
    req.file as Express.Multer.File,
  );
  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Profile picture updated successfully",
    data: result,
  });
});

// ! for removing the logged-in user's profile picture (spec 20)
const removeProfilePicture = catchAsync(async (req, res) => {
  const result = await userServices.removeProfilePicture(req.user.userId);
  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Profile picture removed successfully",
    data: result,
  });
});

//
export const userController = {
  crateUser,
  signIn,
  refreshToken,
  getMe,
  updateProfile,
  updateProfilePicture,
  removeProfilePicture,
};
