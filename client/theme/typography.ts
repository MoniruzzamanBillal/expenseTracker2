// Design system — type scale (Nocturne)
// Install: npx expo install @expo-google-fonts/inter expo-font

import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

const tnum: TextStyle = { fontVariant: ['tabular-nums'] };

const f = (family: string, fontSize: number, lineHeight: number, letterSpacing = 0): TextStyle => ({
  fontFamily: family,
  fontSize,
  lineHeight,
  letterSpacing,
});

export const text: Record<string, TextStyle> = {
  display: { ...f(fontFamily.medium, 48, 50, -0.96), ...tnum },
  amountInput: { ...f(fontFamily.medium, 52, 60, -1.04), ...tnum },
  amountLg: { ...f(fontFamily.medium, 40, 44, -0.8), ...tnum },
  amountMd: { ...f(fontFamily.medium, 18, 24), ...tnum },
  amount: { ...f(fontFamily.medium, 15, 20), ...tnum },
  amountSm: { ...f(fontFamily.regular, 12, 16), ...tnum },
  h1: f(fontFamily.medium, 28, 34, -0.42),
  h2: f(fontFamily.medium, 20, 24, -0.3), // screen titles
  h3: f(fontFamily.medium, 17, 22, -0.26), // sheet titles, steppers
  body: f(fontFamily.regular, 15, 23),
  bodyMd: f(fontFamily.medium, 15, 23),
  bodySm: f(fontFamily.regular, 13, 19),
  caption: f(fontFamily.regular, 12, 16),
  captionMd: f(fontFamily.medium, 12, 16), // field labels
  kicker: { ...f(fontFamily.semibold, 11, 14, 0.99), textTransform: 'uppercase' },
  tab: f(fontFamily.medium, 10, 12, 0.2),
};
// Bold (700) is loaded but unused in UI; 600 only for kickers/badges.
