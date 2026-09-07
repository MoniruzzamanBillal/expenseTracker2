import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme, spacing, radius } from "@/theme";

export default function TransactionCardSkeleton() {
  const C = useTheme();
  return (
    <View>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.row, { borderBottomColor: C.divider, opacity: 1 - i * 0.12 }]}>
          <View style={[styles.icon, { backgroundColor: C.surface2 }]} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[styles.bar, { backgroundColor: C.surface2, width: "55%" }]} />
            <View style={[styles.bar, { backgroundColor: C.surface2, width: "35%", height: 10 }]} />
          </View>
          <View style={[styles.bar, { backgroundColor: C.surface2, width: 50, height: 14 }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 13, borderBottomWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: radius.sm },
  bar: { height: 12, borderRadius: 4 },
});
