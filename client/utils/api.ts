import axios from "axios";
import { axiosInstance } from "./axiosInstance";

/**
 * What a failed read throws. The response interceptor resolves on error instead of rejecting
 * (known-issues.md#FETCH-1), so without this `apiGet` returned `undefined` for a dead network and a
 * 500 alike, and TanStack Query rejected that itself with "data is undefined" — the string the
 * user saw on screen. This is the read-side counterpart of TWriteOutcome below.
 */
export class ApiReadError extends Error {
  /** true when the request never reached a server (offline, DNS, 60s timeout) */
  readonly offline: boolean;
  readonly status?: number;

  constructor(message: string, offline: boolean, status?: number) {
    super(message);
    this.name = "ApiReadError";
    this.offline = offline;
    this.status = status;
  }
}

export const apiGet = async (endPoint: string) => {
  const resule = await axiosInstance.get(endPoint);

  // Not an AxiosError → the interceptor's success shape, { data, meta }.
  if (axios.isAxiosError(resule)) {
    // No response means the request never reached a server: offline, DNS failure, or the timeout.
    if (!resule?.response) {
      throw new ApiReadError("You're offline.", true);
    }

    throw new ApiReadError(
      (resule?.response?.data as any)?.message ||
        resule?.message ||
        "The server could not complete this request.",
      false,
      resule?.response?.status,
    );
  }

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

/**
 * The outcome of a write, with the reason it failed when it did.
 *
 * The response interceptor resolves on error instead of rejecting
 * (known-issues.md#FETCH-1), so the helpers above return `undefined` for a 400
 * exactly as they do for a dead network — a caller can't tell "the server said
 * no" from "there was no server". That matters for the offline queue: one
 * should be queued, the other must not be. This keeps the interceptor as is and
 * gives the few callers that need the distinction a way to ask.
 */
export type TWriteOutcome<TBody = any> =
  | { ok: true; body: TBody }
  | { ok: false; offline: true }
  | { ok: false; offline: false; status?: number; message: string };

/**
 * The PUT counterpart of apiPostOutcome, for the same reason: the interceptor resolves on
 * error (known-issues.md#FETCH-1), so apiPut returns `undefined` for a 400, a 500 and a dead
 * network alike. The receipt upload needs to tell the user *why* it failed, which apiPut
 * cannot express — see ai context/specs/35-fix-receipt-upload-failure-on-add-transaction.md.
 */
export const apiPutOutcome = async <TBody = any>(
  endPoint: string,
  payLoad: any,
): Promise<TWriteOutcome<TBody>> => {
  const result = await axiosInstance.put(endPoint, payLoad);

  // Not an AxiosError → the interceptor's success shape, { data, meta }.
  if (!axios.isAxiosError(result)) {
    return { ok: true, body: (result as any)?.data as TBody };
  }

  // An AxiosError carrying no response never reached a server: offline, DNS
  // failure, or the 60s timeout. Anything else means the server answered.
  if (!result?.response) {
    return { ok: false, offline: true };
  }

  return {
    ok: false,
    offline: false,
    status: result?.response?.status,
    message:
      (result?.response?.data as any)?.message ||
      result?.message ||
      "The server rejected this. Please try again.",
  };
};

export const apiPostOutcome = async <TBody = any>(
  endPoint: string,
  payLoad: any,
): Promise<TWriteOutcome<TBody>> => {
  const result = await axiosInstance.post(endPoint, payLoad);

  // Not an AxiosError → the interceptor's success shape, { data, meta }.
  if (!axios.isAxiosError(result)) {
    return { ok: true, body: (result as any)?.data as TBody };
  }

  // An AxiosError carrying no response never reached a server: offline, DNS
  // failure, or the 60s timeout. Anything else means the server answered.
  if (!result?.response) {
    return { ok: false, offline: true };
  }

  return {
    ok: false,
    offline: false,
    status: result?.response?.status,
    message:
      (result?.response?.data as any)?.message ||
      result?.message ||
      "The server rejected this. Please try again.",
  };
};
