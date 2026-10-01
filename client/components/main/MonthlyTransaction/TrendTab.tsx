import EmptyState from "@/components/main/shared/EmptyState";
import TransactionCardSkeleton from "@/components/main/shared/TransactionCardSkeleton";
import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TTrendSummary } from "@/types/Transaction.tyes";
import { format, parse } from "date-fns";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { formatCompact as compact, formatTotal as fmt } from "@/utils/formatAmount";

const MONTH_OPTIONS = [3, 6, 12] as const;
type TMonths = (typeof MONTH_OPTIONS)[number];

/** Room reserved left of the plot for the y-axis labels — see AXIS_LABEL below. */
const Y_AXIS_WIDTH = 46;
const BAR_MIN_WIDTH = 8;
const BAR_MAX_WIDTH = 26;

/** 1/2/5 × 10^k, so tick values land on numbers a person reads as round. */
const niceStep = (raw: number) => {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
};

export default function TrendTab() {
  const C = useTheme();

  // spec 23 / G3 — user-selectable lookback window; server default is 6
  const [months, setMonths] = useState<TMonths>(6);
  const [cardWidth, setCardWidth] = useState(0);

  const { data, isLoading } = useFetchData<TTrendSummary>(
    ["trend-transaction", String(months)],
    `/transactions/trend-transaction?months=${months}`,
  );

  const trend = data?.data;
  const monthlySummary = trend?.monthlySummary ?? [];
  const categoryBreakdown = trend?.categoryBreakdown ?? [];
  const breakdownTotal = categoryBreakdown.reduce(
    (sum, c) => sum + c?.expense,
    0,
  );

  const barData = monthlySummary.map((m) => {
    const net = m?.income - m?.expense;
    return {
      value: net,
      label: format(parse(m?.targetMonth, "yyyy-MM", new Date()), "MMM"),
      frontColor: net >= 0 ? C.income : C.expense,
    };
  });

  const pieData = categoryBreakdown.map((c, i) => ({
    value: c?.expense,
    text: c?.name,
    color: C.chartPalette[i % C.chartPalette.length],
  }));

  // The chart has to be told its width or it lays out to the *screen* width and
  // spills past the card: BarAndLineChartsWrapper positions its ScrollView
  // absolutely and, with no `width` prop, sizes the content to `totalWidth`
  // unclipped (`!props.width && { width: totalWidth }`). Measured rather than
  // derived from Dimensions so it stays right regardless of what padding the
  // parent screen applies.
  const plotWidth = Math.max(120, cardWidth - Y_AXIS_WIDTH);

  // Bars are sized from the space available instead of being fixed at 28/24,
  // which at 12 months needed ~620pt and was the other half of the overflow.
  // Solving for `n * (bar + gap) === plotWidth` keeps the last bar on-card at
  // every lookback.
  const slot = barData.length > 0 ? plotWidth / barData.length : plotWidth;
  const barWidth = Math.max(BAR_MIN_WIDTH, Math.min(BAR_MAX_WIDTH, Math.floor(slot * 0.5)));
  const barGap = Math.max(4, slot - barWidth);

  // Both halves of the axis are given the same explicit step so the ticks are
  // labelled and the zero line is a real zero. Left to itself the chart derives
  // maxValue from the data, and a window where every month's net is negative
  // collapses the positive half to 0 — which is what left the y-axis unlabelled.
  const nets = barData.map((b) => b.value);
  const maxNet = Math.max(0, ...nets);
  const minNet = Math.min(0, ...nets);
  const step = niceStep(Math.max(Math.abs(maxNet), Math.abs(minNet)) / 2);
  const sectionsAbove = Math.max(1, Math.ceil(maxNet / step));
  const sectionsBelow = minNet < 0 ? Math.max(1, Math.ceil(-minNet / step)) : 0;

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
          styles.barCard,
          { backgroundColor: C.surface, borderColor: C.border },
        ]}
        onLayout={(e) => setCardWidth(e.nativeEvent.layout.width - spacing.md * 2)}
      >
        <Text
          style={[text.kicker, { color: C.textSecondary, marginBottom: spacing.md }]}
        >
          Net total · last {trend?.months ?? months} months
        </Text>

        {barData.length === 0 ? (
          <Text style={[text.bodySm, { color: C.textMuted }]}>
            No months to chart yet.
          </Text>
        ) : cardWidth > 0 ? (
          <BarChart
            data={barData}
            width={plotWidth}
            height={150}
            barWidth={barWidth}
            spacing={barGap}
            initialSpacing={barGap / 2}
            endSpacing={barGap / 2}
            roundedTop
            roundedBottom
            // A zero line is load-bearing once bars can point down, so unlike
            // before the x-axis is drawn. The y-axis line stays off — its
            // labels plus the dashed rules already carry the scale.
            xAxisThickness={1}
            xAxisColor={C.border}
            yAxisThickness={0}
            rulesType="dashed"
            rulesColor={C.divider}
            noOfSections={sectionsAbove}
            maxValue={step * sectionsAbove}
            stepValue={step}
            negativeStepValue={step}
            noOfSectionsBelowXAxis={sectionsBelow}
            yAxisLabelWidth={Y_AXIS_WIDTH}
            formatYLabel={(label) => compact(Number(label))}
            xAxisLabelTextStyle={{ color: C.textSecondary, fontSize: 11 }}
            yAxisTextStyle={{ color: C.textSecondary, fontSize: 11 }}
          />
        ) : null}
      </View>

      {pieData.length > 0 ? (
        <View
          style={[
            styles.chartCard,
            { backgroundColor: C.surface, borderColor: C.border },
          ]}
        >
          <Text
            style={[text.kicker, { color: C.textSecondary, marginBottom: spacing.md }]}
          >
            Spending by category · last month
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
                  <Text style={[text.caption, { color: C.textMuted }]}>spent</Text>
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
        <EmptyState title="No spending last month to break down" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segmentTrack: {
    flexDirection: "row",
    borderRadius: radius.sheet,
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
  // The chart container carries a negative marginBottom of its own (the library
  // trims the slack it reserves above the x-axis labels), which pulls the card's
  // bottom edge up over the month labels. This pads that back out.
  barCard: { paddingBottom: spacing.xxl },
  donutWrap: { alignItems: "center", marginBottom: spacing.md },
  donutCenter: { alignItems: "center", gap: 1 },
  legend: { gap: spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
