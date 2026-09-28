import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, text, spacing, radius, elevation } from "@/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type TProps = {
  income: number;
  expense: number;
  label?: string;
};

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

export default function TotalBalanceCard({ income = 0, expense = 0, label = "Today's Balance" }: TProps) {
  const C = useTheme();
  const balance = income - expense;
  const isPositive = balance >= 0;

  return (
    <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, elevation(C, C.statusBarStyle === "light").card]}>
      <Text style={[text.captionMd, { color: C.textSecondary, marginBottom: spacing.sm }]}>
        {label.toUpperCase()}
      </Text>
      <Text style={[text.display, { color: isPositive ? C.text : C.expense, marginBottom: spacing.lg }]}>
        {isPositive ? "" : "−"}৳{fmt(balance)}
      </Text>
      <View style={styles.pills}>
        <View style={[styles.pill, { backgroundColor: C.incomeBg }]}>
          <View style={styles.pillLabelRow}>
            <MaterialCommunityIcons name="arrow-up" size={11} color={C.income} />
            <Text style={[text.captionMd, { color: C.income }]}>INCOME</Text>
          </View>
          <Text style={[text.amountSm, { color: C.text }]}>৳{fmt(income)}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: C.expenseBg }]}>
          <View style={styles.pillLabelRow}>
            <MaterialCommunityIcons name="arrow-down" size={11} color={C.expense} />
            <Text style={[text.captionMd, { color: C.expense }]}>EXPENSES</Text>
          </View>
          <Text style={[text.amountSm, { color: C.text }]}>৳{fmt(expense)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.sheet, borderWidth: 1, padding: spacing.xl, marginBottom: spacing.lg },
  pills: { flexDirection: "row", gap: spacing.md },
  pill: { flex: 1, borderRadius: radius.md, padding: spacing.md },
  pillLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.xs },
});
