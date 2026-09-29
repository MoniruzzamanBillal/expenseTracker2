import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { useTheme, text, radius, spacing } from "@/theme";

type TVariant = "outline" | "emphasis" | "destructive" | "ghost";

type TProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: TVariant;
  /** Override the accent color for outline/emphasis — e.g. pass C.income for an income-type Save button. */
  color?: string;
  icon?: React.ReactNode;
  height?: number;
};

export default function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  style,
  variant = "emphasis",
  color,
  icon,
  height = spacing.button,
}: TProps) {
  const C = useTheme();
  const accentColor = color ?? C?.accent;

  const variantStyle: ViewStyle =
    variant === "emphasis"
      ? { backgroundColor: accentColor, borderColor: accentColor }
      : variant === "destructive"
        ? { backgroundColor: "transparent", borderColor: `${C?.expense}8c` }
        : variant === "ghost"
          ? { backgroundColor: "transparent", borderWidth: 0 }
          : { backgroundColor: "transparent", borderColor: accentColor };

  const labelColor =
    variant === "emphasis" ? C?.onAccent : variant === "destructive" ? C?.expense : variant === "ghost" ? C?.textSecondary : accentColor;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.btn, { height, borderWidth: variant === "ghost" ? 0 : 1 }, variantStyle, (disabled || loading) && { opacity: 0.45 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[text.bodyMd, { color: labelColor }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.card, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.base },
});
