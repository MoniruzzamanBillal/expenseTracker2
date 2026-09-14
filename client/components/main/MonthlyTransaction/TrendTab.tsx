import EmptyState from "@/components/main/shared/EmptyState";
import TransactionCardSkeleton from "@/components/main/shared/TransactionCardSkeleton";
import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TTrendSummary } from "@/types/Transaction.tyes";
import { format, parse } from "date-fns";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

export default function TrendTab() {
  const C = useTheme();
  const { data, isLoading } = useFetchData<TTrendSummary>(
    ["trend-transaction"],
    "/transactions/trend-transaction",
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
          NET TOTAL, LAST {trend?.months ?? 6} MONTHS
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
