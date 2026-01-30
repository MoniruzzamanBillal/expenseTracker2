import argon2 from "argon2";
import httpStatus from "http-status";
import AppError from "../../Error/AppError";
import { TUser } from "./user.interface";
import { userModel } from "./user.model";

import Jwt from "jsonwebtoken";
import config from "../../config";

// ! for craeting a user
const createUser = async (payload: TUser) => {
  const result = await userModel.create(payload);

  return result;
};

// ! for login a user
type Tlogin = {
  email: string;
  password: string;
};
const loginFromDb = async (payload: Tlogin) => {
  const userData = await userModel.findOne({ email: payload?.email });

  if (!userData) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User dont exist with this email !!!",
    );
  }

  const isPasswordMatch = await argon2.verify(
    userData?.password,
    payload?.password,
  );

  if (!isPasswordMatch) {
    throw new AppError(httpStatus.FORBIDDEN, "Password don't match !!");
  }

  const jwtPayload = {
    userId: userData?.id,
    userEmail: userData?.email,
  };

  const token = Jwt.sign(jwtPayload, config.jwt_secret as string, {
    expiresIn: "2d",
  });

  return {
    userData,
    token,
  };
};

//
export const userServices = { createUser, loginFromDb };
