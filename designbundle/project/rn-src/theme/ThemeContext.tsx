// xpns Design System — Theme context
// Wrap your root layout with <ThemeProvider> and call useTheme() in any component.

import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { colors, ColorScheme } from './colors';

const ThemeContext = createContext<ColorScheme>(colors.dark);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const C = scheme === 'light' ? colors.light : colors.dark;
  return <ThemeContext.Provider value={C}>{children}</ThemeContext.Provider>;
}

/** Drop-in hook — returns current theme's color tokens */
export const useTheme = (): ColorScheme => useContext(ThemeContext);
