// xpns design system — theme context. Wrap the root layout with <ThemeProvider>
// and call useTheme() from any component to read the active color scheme.

import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { colors, ColorScheme } from './colors';

const ThemeContext = createContext<ColorScheme>(colors.dark);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const C = scheme === 'light' ? colors.light : colors.dark;
  return <ThemeContext.Provider value={C}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ColorScheme => useContext(ThemeContext);
