import argon2 from "argon2";
import httpStatus from "http-status";
import Jwt from "jsonwebtoken";
import AppError from "../../Error/AppError";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { generateObjectId } from "../../util/generateObjectId";
import { TUser } from "./user.interface";

// ! for creating a user
const createUser = async (payload: TUser) => {
  const hashedPassword = await argon2.hash(payload.password);

  const result = await prisma.user.create({
    data: {
      id: generateObjectId(),
      name: payload.name,
      email: payload.email,
      password: hashedPassword,
      profilePicture: payload.profilePicture,
    },
  });

  return { ...result, _id: result.id };
};

// ! for login a user
type Tlogin = {
  email: string;
  password: string;
};

const loginFromDb = async (payload: Tlogin) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User dont exist with this email !!!",
    );
  }

  const isPasswordMatch = await argon2.verify(
    userData.password,
    payload.password,
  );

  if (!isPasswordMatch) {
    throw new AppError(httpStatus.FORBIDDEN, "Password don't match !!");
  }

  const jwtPayload = {
    userId: userData.id,
    userEmail: userData.email,
  };

  const token = Jwt.sign(jwtPayload, config.jwt_secret as string, {
    expiresIn: "15d",
  });

  return {
    userData: { ...userData, _id: userData.id },
    token,
  };
};

export const userServices = { createUser, loginFromDb };
