import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { formatTotal as fmt } from "@/utils/formatAmount";
import { StyleSheet, Text, View } from "react-native";

type TProps = {
  income: number;
  expense: number;
  /** Row count shown as "N entries" — includes the offline-queued rows on Home. */
  entryCount: number;
};

/**
 * Today's headline card: net total, an income/expense split bar, and the two
 * In/Expense figures. Purely presentational — `net` and its sign are derived
 * from income/expense here rather than passed in, so there is one place that
 * decides what "positive" means.
 *
 * A zero net is deliberately neither green nor red (C.textMuted): with no
 * entries the card would otherwise read as income.
 */
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
        {/* Both labels sit one step up the text hierarchy from the usual
            kicker/caption pairing — textSecondary -> text and textMuted ->
            textSecondary — so the card header reads clearly rather than
            receding. Tokens, not literals, so light mode steps toward its own
            near-black instead of going pale. */}
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
            <Text style={[text.caption, { color: C?.textSecondary }]}>In</Text>
          </View>
          <Text style={[text.amount, { color: C?.income }]}>
            +৳{fmt(income)}
          </Text>
        </View>
        <View>
          <View style={styles.inOutLabelRow}>
            <View style={[styles.dot, { backgroundColor: C?.expense }]} />
            <Text style={[text.caption, { color: C?.textSecondary }]}>
              Expense
            </Text>
          </View>
          <Text style={[text.amount, { color: C?.expense }]}>
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
    padding: spacing.base,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.base,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  // The type scale jumps 40 (amountLg) straight to 18 (amountMd) with nothing
  // between, so the headline overrides amountLg's metrics instead of reaching
  // for another token — fontFamily.medium and tabular-nums still come from the
  // token, only size/leading/tracking change. Leading and tracking are scaled
  // with the size (44 -> 38, -0.8 -> -0.68) so the figure keeps its proportions.
  netAmount: { fontSize: 34, lineHeight: 38, letterSpacing: -0.68 },
  // Sized off the amount at half its size, not off the type scale, so they
  // track netAmount instead of drifting when it changes.
  netSign: { fontSize: 17 },
  netCurrency: { fontSize: 17 },
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
