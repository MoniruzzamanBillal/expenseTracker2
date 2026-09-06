import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { getBaseUrl } from "./envConfig";

const instance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 60000,
});

// Request interceptor — attach the JWT (if we have one) to every call.
instance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — unwrap on success, toast + reject on failure so
// callers' onError/catch actually run.
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await AsyncStorage.removeItem("user");
      await AsyncStorage.removeItem("token");
      Toast.show({ type: "error", text1: "Session expired, please log in again", position: "top" });
      router.replace("/auth");
    }

    // error.response is undefined for a no-response failure (offline/timeout/
    // unreachable) — fall back to Axios's own message instead of a blank toast.
    const errorMessage =
      error?.response?.data?.message ||
      error?.message ||
      "Something went wrong. Please try again.";

    Toast.show({ type: "error", text1: errorMessage, position: "top" });

    return Promise.reject(error);
  },
);

export { instance as axiosInstance };
