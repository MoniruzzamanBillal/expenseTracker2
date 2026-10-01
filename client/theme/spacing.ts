// Design system — spacing, radius, elevation (Nocturne)
import { ColorScheme } from './colors';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  screenPad: 20,
  rowMinHeight: 58,
  hitTarget: 44,
  control: 40,
  button: 44,
  field: 48,
  cta: 50,
  tabBar: 50, // + insets.bottom → 84 on notched iPhones
} as const;

export const radius = {
  sm: 6,
  md: 8,
  card: 10,
  sheet: 14,
  pill: 999,
} as const;

export const elevation = (C: ColorScheme, dark: boolean) => ({
  card: {
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: dark ? '#000' : '#1f2130',
    shadowOpacity: dark ? 0.45 : 0.07,
    shadowRadius: dark ? 18 : 14,
    shadowOffset: { width: 0, height: dark ? 6 : 4 },
    elevation: dark ? 4 : 2,
  },
  sheet: {
    borderTopWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: dark ? 0.6 : 0.12,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -16 },
    elevation: 16,
  },
  glow: {
    // at most one per screen
    borderWidth: 1,
    borderColor: C.accentBorder,
    shadowColor: C.accent,
    shadowOpacity: dark ? 0.3 : 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8, // Android ≥ 28 tints it
  },
});
