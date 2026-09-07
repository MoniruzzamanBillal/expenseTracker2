import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme, spacing, radius } from "@/theme";

export default function HistoryCardSkeleton() {
  const C = useTheme();
  return (
    <View style={[styles.card, { borderColor: C.divider }]}>
      <View style={styles.rowBetween}>
        <View style={[styles.bar, { backgroundColor: C.surface2, width: 70, height: 14 }]} />
        <View style={[styles.bar, { backgroundColor: C.surface2, width: 60, height: 12 }]} />
      </View>
      <View style={[styles.bar, { backgroundColor: C.surface2, width: "100%", height: 4, marginTop: 8 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bar: { borderRadius: 4 },
});
