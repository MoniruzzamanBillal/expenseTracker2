// Design system — theme context. Wrap the root layout with <ThemeProvider>
// and call useTheme() from any component to read the active color scheme.
// useThemePreference() additionally exposes the user's manual Dark/Light/
// System override (Settings' Appearance control) — client-only, persisted
// to AsyncStorage, no API involved.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors, ColorScheme } from './colors';

export type TThemePreference = 'dark' | 'light' | 'system';

const PREFERENCE_STORAGE_KEY = 'themePreference';

const ThemeContext = createContext<ColorScheme>(colors.dark);
const ThemePreferenceContext = createContext<{
  preference: TThemePreference;
  setPreference: (p: TThemePreference) => void;
}>({ preference: 'system', setPreference: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<TThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(PREFERENCE_STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = (p: TThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(PREFERENCE_STORAGE_KEY, p).catch(() => {});
  };

  const resolvedScheme = preference === 'system' ? systemScheme : preference;
  const C = resolvedScheme === 'light' ? colors.light : colors.dark;

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      <ThemeContext.Provider value={C}>{children}</ThemeContext.Provider>
    </ThemePreferenceContext.Provider>
  );
}

export const useTheme = (): ColorScheme => useContext(ThemeContext);
export const useThemePreference = () => useContext(ThemePreferenceContext);
