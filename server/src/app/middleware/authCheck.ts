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
        "Authorization header missing or malformed",
      ),
    );
  }

  // ! `undefined` for a bare "Bearer" with no token; Jwt.verify then throws, so this
  // ! already fails closed through the catch below. Left as-is (spec 18 D5).
  const token = header.split(" ")[1];

  let decoded: JwtPayload;
  try {
    // ! the ACCESS secret specifically (spec 18 D1) - a refresh token presented here fails
    // ! signature verification, which is the point of the two secrets being different.
    decoded = Jwt.verify(
      token,
      config.jwt_access_secret as string,
    ) as JwtPayload;
  } catch (error) {
    // ! the client's interceptor keys its refresh attempt off the 401 status, not this
    // ! string - but with a 15-minute access token, routine expiry is now by far the most
    // ! common row in error_logs, so these two cases have to be told apart when reading it.
    // ! Closes known-issues.md#AUTH-6 (every verify failure reported as "Token expired").
    const expired = error instanceof Jwt.TokenExpiredError;

    return next(
      new AppError(
        httpStatus.UNAUTHORIZED,
        expired ? "Access token expired" : "Access token is invalid",
      ),
    );
  }

  // ! second line of defence behind the separate secrets: if JWT_ACCESS_SECRET and
  // ! JWT_REFRESH_SECRET are ever set to the same value by mistake, this is what stops a
  // ! 15-day refresh token from buying a 15-day session (spec 18 D1).
  // ! A token minted before spec 18 has no `type` claim and is rejected here - every
  // ! pre-existing session is signed out once, deliberately (spec 18 D10).
  if (decoded?.type !== "access") {
    return next(new AppError(httpStatus.UNAUTHORIZED, "Invalid token type"));
  }

  req.user = decoded;
  next();
});

export default authCheck;
