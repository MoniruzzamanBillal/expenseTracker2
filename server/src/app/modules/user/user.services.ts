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

// ! for getting the logged-in user's own profile (password intentionally excluded)
const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      profilePicture: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return { ...user, _id: user.id };
};

// ! for updating the logged-in user's own display name
const updateProfile = async (userId: string, payload: { name: string }) => {
  const result = await prisma.user.update({
    where: { id: userId },
    data: { name: payload.name },
    select: {
      id: true,
      name: true,
      email: true,
      profilePicture: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { ...result, _id: result.id };
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

export const userServices = { createUser, loginFromDb, getMe, updateProfile };
