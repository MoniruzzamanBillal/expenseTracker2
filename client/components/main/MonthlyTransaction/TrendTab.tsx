import EmptyState from "@/components/main/shared/EmptyState";
import TransactionCardSkeleton from "@/components/main/shared/TransactionCardSkeleton";
import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TTrendSummary } from "@/types/Transaction.tyes";
import { format, parse } from "date-fns";
import { useState } from "react";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

const MONTH_OPTIONS = [3, 6, 12] as const;
type TMonths = (typeof MONTH_OPTIONS)[number];

export default function TrendTab() {
  const C = useTheme();

  // spec 23 / G3 — user-selectable lookback window; server default is 6
  const [months, setMonths] = useState<TMonths>(6);

  const { data, isLoading } = useFetchData<TTrendSummary>(
    ["trend-transaction", String(months)],
    `/transactions/trend-transaction?months=${months}`,
  );

  const trend = data?.data;
  const monthlySummary = trend?.monthlySummary ?? [];
  const categoryBreakdown = trend?.categoryBreakdown ?? [];
  const breakdownTotal = categoryBreakdown.reduce(
    (sum, c) => sum + c.expense,
    0,
  );

  const barData = monthlySummary.map((m) => {
    const net = m.income - m.expense;
    return {
      value: net,
      label: format(parse(m.targetMonth, "yyyy-MM", new Date()), "MMM"),
      frontColor: net >= 0 ? C.income : C.expense,
    };
  });

  const pieData = categoryBreakdown.map((c, i) => ({
    value: c.expense,
    text: c.name,
    color: C.chartPalette[i % C.chartPalette.length],
  }));

  if (isLoading) return <TransactionCardSkeleton />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* spec 23 / G3 — months segmented control */}
      <View
        style={[
          styles.segmentTrack,
          { backgroundColor: C.surface2, borderColor: C.border },
        ]}
      >
        {MONTH_OPTIONS.map((m) => {
          const active = months === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => setMonths(m)}
              activeOpacity={0.8}
              style={[
                styles.segmentOpt,
                {
                  borderColor: active ? C.accent : "transparent",
                  backgroundColor: active ? C.accentDim : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  text.bodyMd,
                  { color: active ? C.accent : C.textSecondary },
                ]}
              >
                {m}mo
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={[
          styles.chartCard,
          { backgroundColor: C.surface, borderColor: C.border },
        ]}
      >
        <Text
          style={[
            text.label,
            { color: C.textSecondary, marginBottom: spacing.md },
          ]}
        >
          NET TOTAL, LAST {trend?.months ?? months} MONTHS
        </Text>
        <BarChart
          data={barData}
          barWidth={28}
          spacing={24}
          roundedTop
          roundedBottom
          yAxisThickness={0}
          xAxisThickness={0}
          xAxisLabelTextStyle={{ color: C.textSecondary, fontSize: 11 }}
          yAxisTextStyle={{ color: C.textSecondary, fontSize: 11 }}
        />
      </View>

      {pieData.length > 0 ? (
        <View
          style={[
            styles.chartCard,
            { backgroundColor: C.surface, borderColor: C.border },
          ]}
        >
          <Text
            style={[
              text.label,
              { color: C.textSecondary, marginBottom: spacing.md },
            ]}
          >
            SPENDING BY CATEGORY, LAST MONTH
          </Text>
          <View style={styles.donutWrap}>
            <PieChart data={pieData} donut radius={90} innerRadius={60} />
          </View>

          <View style={styles.legend}>
            {categoryBreakdown.map((c, i) => {
              const pct =
                breakdownTotal > 0
                  ? ((c.expense / breakdownTotal) * 100).toFixed(1)
                  : "0.0";
              return (
                <View
                  key={c.categoryId ?? "uncategorized"}
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
                    {c.name}
                  </Text>
                  <Text style={[text.caption, { color: C.textSecondary }]}>
                    ৳{fmt(c.expense)} ({pct}%)
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <EmptyState title="No spending last month to break down" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segmentTrack: {
    flexDirection: "row",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: spacing.base,
  },
  segmentOpt: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: "center",
    borderWidth: 1,
  },
  chartCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  donutWrap: { alignItems: "center", marginBottom: spacing.md },
  legend: { gap: spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
