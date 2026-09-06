import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet,
  ActivityIndicator, ViewStyle,
} from 'react-native';
import { useTheme, text, spacing, radius } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** 'primary' = accent outline fill  |  'ghost' = secondary */
  variant?: 'primary' | 'ghost';
  /** Override the accent color — e.g. pass C.expense for destructive actions */
  color?: string;
}

export function PrimaryButton({
  label, onPress, loading, disabled, style,
  variant = 'primary', color,
}: Props) {
  const C = useTheme();
  const accentColor = color ?? C.accent;
  const isPrimary   = variant === 'primary';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        s.btn,
        isPrimary
          ? { borderColor: accentColor, backgroundColor: `${accentColor}26` } // 15% opacity
          : { borderColor: C.border, backgroundColor: 'transparent' },
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={accentColor} size="small" />
      ) : (
        <Text style={[text.bodyMd, { color: isPrimary ? accentColor : C.textSecondary }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
