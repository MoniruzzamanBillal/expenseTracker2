import EmptyState from "@/components/main/shared/EmptyState";
import TransactionCardSkeleton from "@/components/main/shared/TransactionCardSkeleton";
import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TCategoryDetailEntry, TTrendSummary } from "@/types/Transaction.tyes";
import {
  formatCompact as compact,
  formatTotal as fmt,
} from "@/utils/formatAmount";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PieChart } from "react-native-gifted-charts";

const categoryKey = (c: TCategoryDetailEntry) =>
  c.categoryId ?? "uncategorized";

/** "2 Oct" — the day a transaction was logged, for the rows under a category. */
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "d MMM");
};

export default function TrendTab() {
  const C = useTheme();

  // Categories open by default (the point of this view is seeing the detail); a tap
  // on the header collapses one. Keyed by category id so it survives a window change.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useFetchData<TTrendSummary>(
    // months=1 is the current calendar month: the server's window is [1st of this month, 1st
    // of next), so the donut and the per-category detail all describe this month.
    ["trend-transaction", "1"],
    `/transactions/trend-transaction?months=1`,
  );

  const trend = data?.data;
  const categoryBreakdown = trend?.categoryBreakdown ?? [];
  const categoryDetail = trend?.categoryDetail ?? [];
  const breakdownTotal = categoryBreakdown.reduce(
    (sum, c) => sum + c?.expense,
    0,
  );

  const pieData = categoryBreakdown.map((c, i) => ({
    value: c?.expense,
    text: c?.name,
    color: C.chartPalette[i % C.chartPalette.length],
  }));

  if (isLoading) return <TransactionCardSkeleton />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text
        style={[
          text.kicker,
          { color: C.textSecondary, marginBottom: spacing.sm },
        ]}
      >
        By category · this month
      </Text>

      {categoryDetail.length === 0 ? (
        <EmptyState title="No transactions this month" />
      ) : (
        categoryDetail.map((c) => {
          const key = categoryKey(c);
          const open = !collapsed[key];
          return (
            <View
              key={key}
              style={[
                styles.categoryCard,
                { backgroundColor: C.surface, borderColor: C.border },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setCollapsed((p) => ({ ...p, [key]: open }))}
                style={styles.categoryHead}
              >
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: C.accentDim },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={(c.icon || "shape-outline") as any}
                    size={18}
                    color={C.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[text.bodyMd, { color: C.text }]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  <Text style={[text.caption, { color: C.textMuted }]}>
                    {c.transactions.length}{" "}
                    {c.transactions.length === 1 ? "entry" : "entries"}
                  </Text>
                </View>
                <View style={styles.categoryTotals}>
                  {c.expense > 0 ? (
                    <Text style={[text.bodyMd, { color: C.expense }]}>
                      −৳{fmt(c.expense)}
                    </Text>
                  ) : null}
                  {c.income > 0 ? (
                    <Text style={[text.bodyMd, { color: C.income }]}>
                      +৳{fmt(c.income)}
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={C.textMuted}
                  style={{ marginLeft: spacing.sm }}
                />
              </TouchableOpacity>

              {open
                ? c.transactions.map((t) => {
                    const isIncome = t.type === "income";
                    return (
                      <View
                        key={t._id}
                        style={[styles.txRow, { borderTopColor: C.divider }]}
                      >
                        <Text
                          style={[
                            text.caption,
                            styles.txDate,
                            { color: C.textSecondary },
                          ]}
                        >
                          {dayLabel(t.createdAt)}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[text.bodySm, { color: C.text }]}
                            numberOfLines={1}
                          >
                            {t.title}
                          </Text>
                          {t.description ? (
                            <Text
                              style={[text.caption, { color: C.textMuted }]}
                              numberOfLines={1}
                            >
                              {t.description}
                            </Text>
                          ) : null}
                        </View>
                        <Text
                          style={[
                            text.bodySm,
                            { color: isIncome ? C.income : C.expense },
                          ]}
                        >
                          {isIncome ? "+" : "−"}৳{fmt(t.amount)}
                        </Text>
                      </View>
                    );
                  })
                : null}
            </View>
          );
        })
      )}

      {pieData.length > 0 ? (
        <View
          style={[
            styles.chartCard,
            { backgroundColor: C.surface, borderColor: C.border },
          ]}
        >
          <Text
            style={[
              text.kicker,
              {
                color: C.textSecondary,
                marginBottom: spacing.md,
              },
            ]}
          >
            Spending by category · this month
          </Text>
          <View style={styles.donutWrap}>
            <PieChart
              data={pieData}
              donut
              radius={90}
              innerRadius={60}
              // Defaults to white, which in dark mode punched a bright hole
              // through the middle of the card.
              innerCircleColor={C.surface}
              centerLabelComponent={() => (
                <View style={styles.donutCenter}>
                  <Text style={[text.amountMd, { color: C.text }]}>
                    ৳{compact(breakdownTotal)}
                  </Text>
                  <Text style={[text.caption, { color: C.textMuted }]}>
                    spent
                  </Text>
                </View>
              )}
            />
          </View>

          <View style={styles.legend}>
            {categoryBreakdown.map((c, i) => {
              const pct =
                breakdownTotal > 0
                  ? ((c?.expense / breakdownTotal) * 100).toFixed(1)
                  : "0.0";
              return (
                <View
                  key={c?.categoryId ?? "uncategorized"}
                  style={styles.legendRow}
                >
                  <View
                    style={[
                      styles.swatch,
                      {
                        backgroundColor:
                          C.chartPalette[i % C.chartPalette.length],
                      },
                    ]}
                  />
                  <Text
                    style={[text.caption, { color: C.text, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {c?.name}
                  </Text>
                  <Text style={[text.caption, { color: C.textSecondary }]}>
                    ৳{fmt(c?.expense)} ({pct}%)
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <EmptyState title="No spending this month to break down" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  categoryCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  categoryHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  categoryIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTotals: { alignItems: "flex-end" },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
  },
  txDate: { width: 44 },
  donutWrap: { alignItems: "center", marginBottom: spacing.md },
  donutCenter: { alignItems: "center", gap: 1 },
  legend: { gap: spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
