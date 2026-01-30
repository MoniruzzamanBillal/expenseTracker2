import { useUserContext } from "@/context/user.context";
import { usePathname, useRouter } from "expo-router";
import { ReactNode, useEffect } from "react";
import SplashScreen from "./SplashScreen";

function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { isLoading, user } = useUserContext();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const isOnAuthPage = pathname.startsWith("/auth");

    setTimeout(() => {
      if (!user && !isOnAuthPage) {
        router.replace("/auth");
      } else if (user && isOnAuthPage) {
        router.replace("/");
      }
    }, 100);
  }, [user, isLoading, pathname]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}

export default AuthGuard;
