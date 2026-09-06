import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { useTheme, text, radius } from '@/theme';

type TProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: 'primary' | 'ghost';
  /** Override the accent color — e.g. pass C.expense for the expense-type Save button. */
  color?: string;
};

export default function PrimaryButton({ label, onPress, loading, disabled, style, variant = 'primary', color }: TProps) {
  const C = useTheme();
  const accentColor = color ?? C.accent;
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.btn,
        isPrimary
          ? { borderColor: accentColor, backgroundColor: `${accentColor}26` }
          : { borderColor: C.border, backgroundColor: 'transparent' },
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={accentColor} size="small" />
      ) : (
        <Text style={[text.bodyMd, { color: isPrimary ? accentColor : C.textSecondary }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { height: 52, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
