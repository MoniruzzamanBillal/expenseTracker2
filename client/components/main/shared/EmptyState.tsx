import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme, text, spacing, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";

type TProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
};

export default function EmptyState({
  title,
  subtitle,
  icon = "receipt-outline",
  actionLabel,
  actionIcon = "add",
  onAction,
}: TProps) {
  const C = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { borderColor: C?.border }]}>
        <Ionicons name={icon} size={22} color={C?.textMuted} />
      </View>
      <Text style={[text.h3, { color: C?.text, marginTop: spacing.md }]}>{title}</Text>
      {subtitle ? (
        <Text style={[text.body, { color: C?.textSecondary, marginTop: spacing.xs }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.8}
          style={[styles.action, { borderColor: C?.accent }]}
        >
          <Ionicons name={actionIcon} size={16} color={C?.accent} />
          <Text style={[text.bodyMd, { color: C?.accent }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "flex-start", paddingTop: 28, paddingHorizontal: 2 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    marginTop: spacing.md,
    height: spacing.hitTarget,
    paddingHorizontal: spacing.base,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
