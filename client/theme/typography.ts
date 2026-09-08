// Design system — type scale
// Install: npx expo install @expo-google-fonts/inter expo-font

import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
};

export const text: Record<string, TextStyle> = {
  balance: { fontSize: 48, fontFamily: fontFamily.semiBold, letterSpacing: -1, lineHeight: 52 },
  h1: { fontSize: 28, fontFamily: fontFamily.semiBold, letterSpacing: -0.5, lineHeight: 34 },
  h2: { fontSize: 22, fontFamily: fontFamily.semiBold, letterSpacing: -0.3, lineHeight: 28 },
  h3: { fontSize: 18, fontFamily: fontFamily.medium, letterSpacing: -0.2, lineHeight: 24 },
  navTitle: { fontSize: 18, fontFamily: fontFamily.semiBold, letterSpacing: -0.2, lineHeight: 24 },
  body: { fontSize: 15, fontFamily: fontFamily.regular, lineHeight: 22 },
  bodyMd: { fontSize: 15, fontFamily: fontFamily.medium, lineHeight: 22 },
  bodySm: { fontSize: 14, fontFamily: fontFamily.regular, lineHeight: 20 },
  caption: { fontSize: 12, fontFamily: fontFamily.regular, lineHeight: 18 },
  label: { fontSize: 11, fontFamily: fontFamily.medium, letterSpacing: 0.8, lineHeight: 16 },
  amount: { fontSize: 17, fontFamily: fontFamily.semiBold, lineHeight: 22 },
  amountSm: { fontSize: 15, fontFamily: fontFamily.semiBold, lineHeight: 20 },
  amountXs: { fontSize: 14, fontFamily: fontFamily.semiBold, lineHeight: 18 },
};
