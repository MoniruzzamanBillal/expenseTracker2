import React from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { ThemeProvider, useTheme } from '@/theme';
import UserProvider from '@/context/user.context';
import AuthGuard from '@/utils/AuthGuard';
import SplashScreen from '@/utils/SplashScreen';

export const unstable_settings = {
  anchor: '(tabs)',
};

const queryClient = new QueryClient();

function RootContent() {
  const C = useTheme();
  return (
    <>
      <StatusBar style={C.statusBarStyle} />
      <UserProvider>
        <AuthGuard>
          <Slot />
        </AuthGuard>
      </UserProvider>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  if (!fontsLoaded) return <SplashScreen />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RootContent />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
