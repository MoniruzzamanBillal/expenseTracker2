import { Role } from "@prisma/client";
import argon2 from "argon2";
import httpStatus from "http-status";
import Jwt, { JwtPayload } from "jsonwebtoken";
import AppError from "../../Error/AppError";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { generateObjectId } from "../../util/generateObjectId";
import { TUser } from "./user.interface";

// ! ---------------------------------------------------------------------------------------
// ! Token issuing (spec 18). Two tokens, two secrets, plus a `type` claim on each.
// !
// ! The claim is not redundant with the separate secrets: it is what still protects the
// ! system if JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are ever set to the same value by
// ! mistake. Without both, a refresh token sent as `Authorization: Bearer <...>` would
// ! verify in authCheck and hand out a 15-day session (spec 18 D1).
// !
// ! The TTLs are literals rather than config/env values on purpose (spec 18 D3):
// ! @types/jsonwebtoken types SignOptions["expiresIn"] as `number | ms.StringValue`, a
// ! template-literal union that a `string | undefined` read from process.env cannot satisfy.
// ! ---------------------------------------------------------------------------------------

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "15d";

type TTokenType = "access" | "refresh";

type TTokenPayload = {
  userId: string;
  userEmail: string;
  // ! read by middleware/adminCheck.ts (spec 17). A token minted before spec 17 shipped
  // ! carries no userRole; one minted before spec 18 carries no `type` either, and authCheck
  // ! now rejects it - every pre-spec-18 session is signed out once, by design (spec 18 D10).
  userRole: Role;
};

const signToken = (payload: TTokenPayload, type: TTokenType) =>
  Jwt.sign(
    { ...payload, type },
    (type === "access"
      ? config.jwt_access_secret
      : config.jwt_refresh_secret) as string,
    { expiresIn: type === "access" ? ACCESS_TOKEN_TTL : REFRESH_TOKEN_TTL },
  );

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

  const jwtPayload: TTokenPayload = {
    userId: userData.id,
    userEmail: userData.email,
    userRole: userData.userRole,
  };

  return {
    userData: { ...userData, _id: userData.id },
    accessToken: signToken(jwtPayload, "access"),
    refreshToken: signToken(jwtPayload, "refresh"),
  };
};

// ! for exchanging a valid refresh token for a fresh access token (spec 18).
// ! The refresh token itself is NOT rotated - the client keeps the one it has, per direct
// ! user instruction (spec 18 D7), so a session has a hard 15-day ceiling from login.
// !
// ! Nothing about either token is stored server-side (spec 18 D8): no RefreshToken table,
// ! no denylist, no jti. Validity is signature + exp, which means a stolen refresh token
// ! cannot be revoked individually - the only levers are isDeleted on the user (below) or
// ! rotating JWT_REFRESH_SECRET, which signs everyone out.
const refreshAccessToken = async (refreshToken: string) => {
  let decoded: JwtPayload;

  try {
    decoded = Jwt.verify(
      refreshToken,
      config.jwt_refresh_secret as string,
    ) as JwtPayload;
  } catch (error) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Refresh token is invalid or expired, please login again",
    );
  }

  if (decoded?.type !== "refresh") {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid token type");
  }

  // ! The new access token is built from the CURRENT row, not from the refresh token's own
  // ! claims (spec 18 D4). One indexed primary-key lookup per user per 15 minutes buys:
  // !   - the only per-user revocation this stateless design has - flipping isDeleted now
  // !     ends access within 15 minutes instead of 15 days (narrows known-issues #AUTH-4,
  // !     which stays open: authCheck itself still never queries the DB);
  // !   - a role change landing without a re-login, which spec 17's 15-day token made
  // !     impossible (promote to admin -> effective on the next refresh).
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, userRole: true, isDeleted: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User no longer has access, please login again",
    );
  }

  return {
    accessToken: signToken(
      { userId: user.id, userEmail: user.email, userRole: user.userRole },
      "access",
    ),
  };
};

export const userServices = {
  createUser,
  loginFromDb,
  refreshAccessToken,
  getMe,
  updateProfile,
};
