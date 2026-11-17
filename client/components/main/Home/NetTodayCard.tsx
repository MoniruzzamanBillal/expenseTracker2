import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { formatTotal as fmt } from "@/utils/formatAmount";
import { StyleSheet, Text, View } from "react-native";

type TProps = {
  income: number;
  expense: number;

  entryCount: number;
};

export default function NetTodayCard({ income, expense, entryCount }: TProps) {
  const C = useTheme();
  const dark = C?.statusBarStyle === "light";

  const net = income - expense;
  const isPositive = net >= 0;
  const netColor =
    net === 0 ? C?.textMuted : isPositive ? C?.income : C?.expense;

  return (
    <View
      style={[
        styles.netCard,
        { backgroundColor: C?.surface },
        elevation(C, dark).glow,
      ]}
    >
      <View style={styles.rowBetween}>
        <Text style={[text.kicker, { color: C?.text }]}>Net today</Text>
        <Text style={[text.caption, { color: C?.textSecondary }]}>
          {entryCount} entries
        </Text>
      </View>

      <View style={styles.netAmountRow}>
        <Text style={[styles.netSign, { color: netColor }]}>
          {net === 0 ? "" : isPositive ? "+" : "−"}
        </Text>
        <Text style={[styles.netCurrency, { color: netColor }]}>৳</Text>
        <Text style={[text.amountLg, styles.netAmount, { color: netColor }]}>
          {fmt(net)}
        </Text>
      </View>

      {income + expense > 0 ? (
        <View style={styles.splitBar}>
          {/* 0.001 keeps a zero-value side from collapsing the other to full width */}
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
      ) : (
        <View
          style={[
            styles.splitBarEmpty,
            { backgroundColor: C?.surface2, borderColor: C?.border },
          ]}
        />
      )}

      <View style={styles.inOutRow}>
        <View>
          <View style={styles.inOutLabelRow}>
            <View style={[styles.dot, { backgroundColor: C?.income }]} />
            <Text
              style={[text.captionMd, styles.inOutLabel, { color: C?.text }]}
            >
              In
            </Text>
          </View>
          <Text style={[text.amount, styles.inOutValue, { color: C?.income }]}>
            +৳{fmt(income)}
          </Text>
        </View>
        <View>
          <View style={styles.inOutLabelRow}>
            <View style={[styles.dot, { backgroundColor: C?.expense }]} />
            <Text
              style={[text.captionMd, styles.inOutLabel, { color: C?.text }]}
            >
              Expense
            </Text>
          </View>
          <Text style={[text.amount, styles.inOutValue, { color: C?.expense }]}>
            −৳{fmt(expense)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  netCard: {
    borderRadius: radius.card,
    padding: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },

  netAmount: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },

  netSign: { fontSize: 15 },
  netCurrency: { fontSize: 15 },
  inOutLabel: { fontSize: 11, lineHeight: 15 },
  inOutValue: { fontSize: 14, lineHeight: 19 },
  splitBar: { flexDirection: "row", gap: 3, height: 6 },
  splitBarEmpty: { height: 6, borderRadius: 3, borderWidth: 1 },
  inOutRow: { flexDirection: "row", gap: spacing.xl },
  inOutLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 1 },
});
