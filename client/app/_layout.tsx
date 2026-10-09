import UserProvider from "@/context/user.context";
import { ThemeProvider } from "@/theme";
import { persistOptions, queryClient } from "@/utils/queryClient";
import SplashScreen from "@/utils/SplashScreen";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Provider as PaperProvider } from "react-native-paper";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) return <SplashScreen />;

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <KeyboardProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <ThemeProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <PaperProvider>
                <UserProvider>
                  <Slot />
                  <Toast />
                </UserProvider>
              </PaperProvider>
            </GestureHandlerRootView>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
