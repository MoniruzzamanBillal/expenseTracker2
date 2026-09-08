import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, text, spacing } from "@/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type TProps = { title: string; subtitle?: string };

export default function EmptyState({ title, subtitle }: TProps) {
  const C = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { borderColor: C.border }]}>
        <MaterialCommunityIcons name="tray-arrow-down" size={26} color={C.textMuted} />
      </View>
      <Text style={[text.bodyMd, { color: C.textSecondary, marginBottom: spacing.xs }]}>{title}</Text>
      {subtitle ? <Text style={[text.caption, { color: C.textMuted, textAlign: "center" }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 64, paddingHorizontal: 32 },
  icon: { width: 56, height: 56, borderRadius: 999, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: spacing.base },
});
