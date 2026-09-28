import { radius, spacing, text, useTheme } from "@/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type TSummaryPill = {
  label: string;
  value: string;
  color: string;
  bg: string;
};

/** The small tinted stat pills used at the top of Activity/Insights (e.g. avg/day, balance). */
export default function SummaryPills({ pills }: { pills: TSummaryPill[] }) {
  const C = useTheme();
  return (
    <View style={styles.row}>
      {pills.map((p) => (
        <View key={p.label} style={[styles.pill, { backgroundColor: p.bg }]}>
          <Text style={[text.kicker, { color: p.color, marginBottom: 3 }]}>{p.label}</Text>
          <Text style={[text.amountMd, { color: C.text }]}>{p.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  pill: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
});
