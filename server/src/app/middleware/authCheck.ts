import httpStatus from "http-status";
import Jwt, { JwtPayload } from "jsonwebtoken";
import config from "../config";
import AppError from "../Error/AppError";
import catchAsync from "../util/catchAsync";

const authCheck = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return next(
      new AppError(
        httpStatus.UNAUTHORIZED,
        "Authorization header missing or malformed"
      )
    );
  }

  const token = header.split(" ")[1];

  let decoded: JwtPayload;
  try {
    decoded = Jwt.verify(token, config.jwt_secret as string) as JwtPayload;
  } catch (error) {
    return next(
      new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired token")
    );
  }

  req.user = decoded;
  next();
});

export default authCheck;
