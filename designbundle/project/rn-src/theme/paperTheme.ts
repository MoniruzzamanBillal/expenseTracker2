// xpns Design System — react-native-paper v5 theme overrides
// Usage: <PaperProvider theme={usePaperTheme()}>
// Or statically: <PaperProvider theme={paperDarkTheme}>

import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { colors } from './colors';

export const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary:              colors.dark.accent,
    onPrimary:            '#ffffff',
    primaryContainer:     colors.dark.accentDim,
    onPrimaryContainer:   colors.dark.accentText,
    secondary:            colors.dark.textSecondary,
    background:           colors.dark.background,
    surface:              colors.dark.surface,
    surfaceVariant:       colors.dark.surface2,
    onSurface:            colors.dark.text,
    onSurfaceVariant:     colors.dark.textSecondary,
    outline:              colors.dark.border,
    outlineVariant:       colors.dark.divider,
    error:                colors.dark.expense,
    onError:              '#fff',
    elevation: {
      level0: 'transparent',
      level1: colors.dark.surface,
      level2: colors.dark.surface2,
      level3: colors.dark.surface2,
      level4: colors.dark.surface2,
      level5: colors.dark.surface2,
    },
  },
  roundness: 3, // md3 roundness unit ≈ 4px → 3×4 = 12px
};

export const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:              colors.light.accent,
    onPrimary:            '#ffffff',
    primaryContainer:     colors.light.accentDim,
    onPrimaryContainer:   colors.light.accentText,
    background:           colors.light.background,
    surface:              colors.light.surface,
    surfaceVariant:       colors.light.surface2,
    onSurface:            colors.light.text,
    onSurfaceVariant:     colors.light.textSecondary,
    outline:              colors.light.border,
    error:                colors.light.expense,
  },
  roundness: 3,
};
