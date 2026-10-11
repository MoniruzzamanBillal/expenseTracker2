import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { IUser } from "@/types/global.types";
import { registerLogoutHandler } from "@/utils/authEvents";
import { clearPersistedQueryCache } from "@/utils/queryClient";
import { clearTokens, hydrateTokens, setTokens } from "@/utils/tokenStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";

type IUserProviderValues = {
  user: IUser | null;
  setUser: (user: IUser | null) => void;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  handleSetUser: (user: IUser | null) => void;
  /**
   * Login only: stores both tokens together (spec 39). Returns a promise so a caller can
   * await the write before flipping `user` non-null - AuthGuard redirects into the tab group
   * on that, and those screens start firing requests immediately.
   */
  handleSetSession: (accessToken: string, refreshToken: string) => Promise<void>;
  logoutFunction: () => void;
};

const UserContext = createContext<IUserProviderValues | undefined>(undefined);

const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ! for logout a user — the single definition of what logging out means, reached from three
  // ! places: Settings' button, a failed token refresh (via authEvents), and the partial-session
  // ! guard in loadUserData below.
  const logoutFunction = async () => {
    try {
      await AsyncStorage.removeItem("user");
      // Spec 39: tokens live in SecureStore on native now, so they can't be removed with a
      // plain AsyncStorage call. clearTokens also drops the legacy pre-spec-39 "token" key.
      await clearTokens();
      // Spec 37: persisted reads outlive the session otherwise, and a second account would see
      // the first one's figures.
      await clearPersistedQueryCache();
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    } catch (error) {
      console.log("something went wrong while logging out !!!");
    }
  };

  useEffect(() => {
    const loadUserData = async () => {
      const storedUser = await AsyncStorage.getItem("user");
      const { accessToken, refreshToken } = await hydrateTokens();

      if (storedUser && accessToken && refreshToken) {
        setUser(JSON.parse(storedUser));
        setAccessToken(accessToken);
        setRefreshToken(refreshToken);
      } else if (storedUser || accessToken || refreshToken) {
        // ! A partial session is not a session (spec 39 D8). This is what the first launch
        // ! after the spec 39 update hits: a stored "user" alongside the legacy single token
        // ! and no token pair. Clearing it lands on /auth cleanly instead of leaving a stale
        // ! user in memory while every request 401s.
        await clearTokens();
        await AsyncStorage.removeItem("user");
      }

      setIsLoading(false);
    };

    loadUserData();
  }, []);

  // ! Let non-React code (axiosInstance's 401 branch) reach logoutFunction — specs 25 + 39.
  // ! logoutFunction only closes over stable state setters, so registering once on mount
  // ! carries no stale-closure risk.
  useEffect(() => {
    registerLogoutHandler(logoutFunction);
  }, []);

  // Store user in AsyncStorage when set
  const handleSetUser = async (user: IUser | null) => {
    setUser(user);
    if (user) {
      await AsyncStorage.setItem("user", JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem("user");
    }
  };

  // ! Store both tokens on login (spec 39). There is deliberately no setter for the access
  // ! token alone: a refresh writes it through utils/tokenStorage directly, outside React,
  // ! because it happens inside the axios interceptor.
  const handleSetSession = async (
    accessToken: string,
    refreshToken: string,
  ) => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    await setTokens(accessToken, refreshToken);
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        accessToken,
        refreshToken,
        setUser,
        handleSetUser,
        handleSetSession,
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
