import { useUserContext } from "@/context/user.context";
import { usePathname, useRouter } from "expo-router";
import { ReactNode, useEffect } from "react";
import SplashScreen from "./SplashScreen";

// Mounted once in the root layout (above both the auth screens and the tab
// group) so it can redirect either direction regardless of which is active.
export default function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, user } = useUserContext();

  useEffect(() => {
    if (isLoading) return;

    const isOnAuthPage = pathname.startsWith("/auth") || pathname.startsWith("/register");

    if (!user && !isOnAuthPage) {
      router.replace("/auth");
    } else if (user && isOnAuthPage) {
      router.replace("/");
    }
  }, [user, isLoading, pathname]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
