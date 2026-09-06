import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://YOUR_API_URL'; // ← replace

export const api = axios.create({ baseURL: BASE_URL });

// Attach JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Unwrap the standard envelope { success, message, data, token? } */
export function unwrap<T>(res: { data: { data: T; token?: string } }) {
  return res.data;
}
