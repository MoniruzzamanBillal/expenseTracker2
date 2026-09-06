import { IUser } from "@/types/global.types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type IUserProviderValues = {
  user: IUser | null;
  token: string | null;
  isLoading: boolean;
  handleSetUser: (user: IUser | null) => void;
  handleSetToken: (token: string | null) => void;
  logoutFunction: () => void;
};

const UserContext = createContext<IUserProviderValues | undefined>(undefined);

export default function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      const [storedUser, storedToken] = await Promise.all([
        AsyncStorage.getItem("user"),
        AsyncStorage.getItem("token"),
      ]);

      if (storedUser && storedToken) {
        try {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        } catch {
          // Corrupted storage — treat as logged out.
        }
      }
      setIsLoading(false);
    };

    loadUserData();
  }, []);

  const handleSetUser = async (nextUser: IUser | null) => {
    setUser(nextUser);
    if (nextUser) {
      await AsyncStorage.setItem("user", JSON.stringify(nextUser));
    } else {
      await AsyncStorage.removeItem("user");
    }
  };

  const handleSetToken = async (nextToken: string | null) => {
    setToken(nextToken);
    if (nextToken) {
      await AsyncStorage.setItem("token", nextToken);
    } else {
      await AsyncStorage.removeItem("token");
    }
  };

  const logoutFunction = async () => {
    await AsyncStorage.multiRemove(["user", "token"]);
    setUser(null);
    setToken(null);
  };

  return (
    <UserContext.Provider
      value={{ user, token, isLoading, handleSetUser, handleSetToken, logoutFunction }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within the UserProvider context");
  }
  return context;
};
