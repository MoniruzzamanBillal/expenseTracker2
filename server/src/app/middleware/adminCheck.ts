import { Role } from "@prisma/client";
import httpStatus from "http-status";
import AppError from "../Error/AppError";
import catchAsync from "../util/catchAsync";

// ! must run after authCheck — reads req.user, which authCheck populates.
// ! Role comes from the JWT (user.services.ts's jwtPayload), so a token minted before
// ! spec 17 shipped has no userRole claim and is correctly rejected until re-login.
// ! There is no promotion endpoint by design: making an admin is a direct DB write.
const adminCheck = catchAsync(async (req, res, next) => {
  if (req.user?.userRole !== Role.admin) {
    return next(new AppError(httpStatus.FORBIDDEN, "Admin access required"));
  }

  next();
});

export default adminCheck;
