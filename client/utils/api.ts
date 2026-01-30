import { axiosInstance } from "./axiosInstance";

export const apiGet = async (endPoint: string) => {
  const resule = await axiosInstance.get(endPoint);
  return resule?.data;
};

export const apiPost = async (endPoint: string, payLoad: any) => {
  const resule = await axiosInstance.post(endPoint, payLoad);
  return resule?.data;
};

export const apiPut = async (endPoint: string, payLoad: any) => {
  const resule = await axiosInstance.put(endPoint, payLoad);
  return resule?.data;
};
export const apiPatch = async (endPoint: string, payLoad: any) => {
  const resule = await axiosInstance.patch(endPoint, payLoad);
  return resule?.data;
};

export const apiDelete = async (endPoint: string) => {
  const resule = await axiosInstance.delete(endPoint);
  return resule?.data;
};
