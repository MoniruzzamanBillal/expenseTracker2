import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { getBaseUrl } from "./envConfig";

const instance = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
});

instance.defaults.headers.post["Content-Type"] = "application/json";
instance.defaults.timeout = 60000;

// Request interceptor
instance.interceptors.request.use(
  async function (config) {
    // <========
    // If the request is a POST request and the data is not FormData,
    // set Content-Type to application/json
    // ========>
    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    } else {
      // Let the browser set the correct multipart boundary
      config.headers["Content-Type"] = "multipart/form-data";
    }

    // Skip adding Authorization header for login endpoint
    const token = await AsyncStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  function (error) {
    console.log("error from axios instance = ", error);
    return Promise.reject(error);
  },
);

instance.interceptors.response.use(
  // ✅ Handle success
  //@ts-expect-error: response type is not always consistent
  function (response) {
    return {
      data: response?.data,
      meta: response?.data?.meta,
    };
  },

  // ❌ Handle errors
  async function (error) {
    console.log("error from 58 line = ", error?.response);

    // !
    if (error?.response?.status === 401) {
      console.log("inside if !!");

      await AsyncStorage.removeItem("user");
      await AsyncStorage.removeItem("token");

      Toast.show({
        type: "error",
        text1: "Token expired , please login ",
        position: "top",
      });

      router.replace("/auth");
    }
    // !

    const errorMessage = error?.response?.data?.message;

    console.log(errorMessage);

    Toast.show({
      type: "error",
      text1: errorMessage,
      position: "top",
    });

    return error;
    // return Promise.reject(error);
  },
);

export { instance as axiosInstance };
