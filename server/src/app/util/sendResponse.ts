import { Response } from "express";

type Tresponse<T> = {
  status: number;
  success: boolean;
  message: string;
  data: T;
  token?: string;
  // ! login returns both tokens (spec 18). Like `token`, this is undefined on every other
  // ! endpoint and JSON.stringify drops it, so no existing response shape changes.
  refreshToken?: string;
};

const sendResponse = <T>(res: Response, data: Tresponse<T>) => {
  res.status(data.status).json({
    success: data.success,
    message: data.message,
    data: data.data,
    token: data.token,
    refreshToken: data.refreshToken,
  });
};

export default sendResponse;
