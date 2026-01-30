import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { IUser } from "@/types/global.types";
import AsyncStorage from "@react-native-async-storage/async-storage";

type IUserProviderValues = {
  user: IUser | null;
  setUser: (user: IUser | null) => void;
  token: string | null;
  setToken: (token: string | null) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  handleSetUser: (user: IUser | null) => void;
  handleSetToken: (token: string | null) => void;
  logoutFunction: () => void;
};

const UserContext = createContext<IUserProviderValues | undefined>(undefined);

const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadUserData = async () => {
      const storedUser = await AsyncStorage.getItem("user");
      const storedToken = await AsyncStorage.getItem("token");

      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      }

      setIsLoading(false);
    };

    loadUserData();
  }, []);

  // Store user in localStorage when set
  const handleSetUser = async (user: IUser | null) => {
    setUser(user);
    if (user) {
      await AsyncStorage.setItem("user", JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem("user");
    }
  };

  // Store token in localStorage when set
  const handleSetToken = async (token: string | null) => {
    setToken(token);
    if (token) {
      await AsyncStorage.setItem("token", token);
    } else {
      await AsyncStorage.removeItem("token");
    }
  };

  // ! for logout a user
  const logoutFunction = async () => {
    try {
      await AsyncStorage.removeItem("user");
      await AsyncStorage.removeItem("token");
      setUser(null);
      setToken(null);
    } catch (error) {
      console.log("something went wrong while logging out !!!");
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        token,
        setUser,
        setToken,
        handleSetUser,
        handleSetToken,
        setIsLoading,
        logoutFunction,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error(
      "useUserContext must be used within the UserProvider context",
    );
  }

  return context;
};

export default UserProvider;
