import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, unwrap } from './api';

export interface User {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string | null;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await api.post('/api/auth/login', { email, password });
  const { data, token } = unwrap<User>(res);
  if (token) await AsyncStorage.setItem('token', token);
  return data;
}

export async function register(name: string, email: string, password: string): Promise<User> {
  const res = await api.post('/api/auth/register', { name, email, password });
  const { data, token } = unwrap<User>(res);
  if (token) await AsyncStorage.setItem('token', token);
  return data;
}

export async function logout() {
  await AsyncStorage.removeItem('token');
}
