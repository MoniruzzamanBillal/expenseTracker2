import React from "react";
import { View, StyleSheet, DimensionValue } from "react-native";
import { useTheme, spacing, radius } from "@/theme";

const ROWS: { w: DimensionValue; o: number }[] = [
  { w: "62%", o: 1 },
  { w: "48%", o: 0.85 },
  { w: "70%", o: 0.7 },
  { w: "40%", o: 0.55 },
  { w: "56%", o: 0.4 },
];

export default function TransactionCardSkeleton() {
  const C = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      {ROWS.map((row, i) => (
        <View
          key={i}
          style={[
            styles.row,
            { borderBottomColor: C.divider, borderBottomWidth: i === ROWS.length - 1 ? 0 : 1, opacity: row.o },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: C.skeleton }]} />
          <View style={{ flex: 1, gap: 7 }}>
            <View style={[styles.bar, { backgroundColor: C.skeleton, width: row.w, height: 11 }]} />
            <View style={[styles.bar, { backgroundColor: C.skeleton, width: 84, height: 9 }]} />
          </View>
          <View style={[styles.bar, { backgroundColor: C.skeleton, width: 56, height: 12 }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: spacing.rowMinHeight, paddingHorizontal: spacing.md + 2 },
  icon: { width: 36, height: 36, borderRadius: radius.md },
  bar: { borderRadius: 3 },
});
