import { axiosInstance } from "./axiosInstance";

export const apiGet = async (endPoint: string, params?: Record<string, unknown>) => {
  const result = await axiosInstance.get(endPoint, { params });
  return result?.data;
};

export const apiPost = async (endPoint: string, payload: Record<string, unknown> | unknown[]) => {
  const result = await axiosInstance.post(endPoint, payload);
  return result?.data;
};

export const apiPatch = async (endPoint: string, payload?: Record<string, unknown>) => {
  const result = await axiosInstance.patch(endPoint, payload);
  return result?.data;
};
