import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { formatTotal as fmt } from "@/utils/formatAmount";
import { StyleSheet, Text, View } from "react-native";

type TProps = {
  label: string;

  caption?: string;
  income: number;
  expense: number;

  showSplitBar?: boolean;
};

export default function NetSummaryCard({
  label,
  caption,
  income,
  expense,
  showSplitBar = false,
}: TProps) {
  const C = useTheme();
  const dark = C?.statusBarStyle === "light";
  const net = income - expense;
  const netColor = net >= 0 ? C?.income : C?.expense;

  return (
    <View
      style={[
        styles.netCard,
        { backgroundColor: C?.surface },
        elevation(C, dark).glow,
      ]}
    >
      <View style={styles.rowBetween}>
        <Text
          style={[text.kicker, styles.cardKicker, { color: C?.textSecondary }]}
        >
          {label}
        </Text>
        {!!caption && (
          <Text
            style={[
              text.caption,
              styles.cardCaption,
              { color: C?.textSecondary },
            ]}
          >
            {caption}
          </Text>
        )}
      </View>

      <View style={styles.netAmountRow}>
        <Text style={[styles.netSign, { color: netColor }]}>
          {net >= 0 ? "+" : "−"}
        </Text>
        <Text style={[styles.netCurrency, { color: netColor }]}>৳</Text>
        <Text style={[text.amountLg, styles.netAmount, { color: netColor }]}>
          {fmt(net)}
        </Text>
      </View>

      {showSplitBar && (
        <View style={styles.splitBar}>
          <View
            style={{
              flex: income || 0.001,
              borderRadius: 3,
              backgroundColor: C?.income,
            }}
          />
          <View
            style={{
              flex: expense || 0.001,
              borderRadius: 3,
              backgroundColor: C?.expense,
            }}
          />
        </View>
      )}

      <View style={styles.inOutRow}>
        <Text style={[text.caption, styles.cardCaption, { color: C?.income }]}>
          In +৳{fmt(income)}
        </Text>
        <Text style={[text.caption, styles.cardCaption, { color: C?.expense }]}>
          Expense −৳{fmt(expense)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  netCard: {
    borderRadius: radius.card,
    padding: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },

  netAmount: { fontSize: 24, lineHeight: 29, letterSpacing: -0.5 },
  cardKicker: { fontSize: 10, lineHeight: 13, letterSpacing: 0.9 },
  cardCaption: { fontSize: 10, lineHeight: 14 },
  netSign: { fontSize: 13 },
  netCurrency: { fontSize: 13 },
  splitBar: { flexDirection: "row", gap: 3, height: 6 },
  inOutRow: { flexDirection: "row", gap: spacing.xl },
});
