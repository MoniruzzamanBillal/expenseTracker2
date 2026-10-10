import { useFetchData } from "@/hooks/useApi";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { TTransactionHistory } from "@/types/Transaction.tyes";
import { ApiReadError } from "@/utils/api";
import { formatCompact, formatTotal as fmt } from "@/utils/formatAmount";
import { Ionicons } from "@expo/vector-icons";
import TrendTab from "../MonthlyTransaction/TrendTab";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import OfflineNotice from "../shared/OfflineNotice";
import HistoryCardSkeleton from "./HistoryCardSkeleton";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type TData = {
  totalExpense: number;
  totalIncome: number;
  yearSummary: TTransactionHistory[];
};

/** Plot height for the year chart; every bar is scaled into this. */
const CHART_H = 64;
/** Fractions of the peak to draw a rule and a y-axis tick at. */
const YEAR_TICKS = [0, 0.5, 1] as const;
const Y_AXIS_W = 34;

/**
 * A gross figure scaled into CHART_H. Clamped at both ends: a value can never
 * draw past the plot, and any non-zero amount keeps a 2pt stub so a month with
 * a tiny entry doesn't read as an empty one.
 */
const barHeight = (value: number, peak: number) => {
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  return Math.max(2, Math.min(CHART_H, (v / peak) * CHART_H));
};

const startYear = 2025;
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

type TSegment = "year" | "trend";

export default function HistoryPage() {
  const C = useTheme();
  const dark = C.statusBarStyle === "light";
  const router = useRouter();
  const [segment, setSegment] = useState<TSegment>("year");
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const {
    data: yearlyTransactions,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
    dataUpdatedAt,
  } = useFetchData<TData>(
    ["yearly-transaction", String(selectedYear)],
    `/transactions/yearly-transaction?targetYear=${selectedYear}`,
    {
      enabled: segment === "year",
    },
  );

  // Spec 37: a failed read only blocks the screen when there is no cached year to show. The
  // Trend segment returns early below, so everything keyed off these is the Year view's.
  const hasCached = !!yearlyTransactions?.data;
  const showErrorCard = isError && !hasCached;

  const yearSummary = useMemo(
    () => yearlyTransactions?.data?.yearSummary ?? [],
    [yearlyTransactions?.data?.yearSummary],
  );
  const income = yearlyTransactions?.data?.totalIncome ?? 0;
  const expense = yearlyTransactions?.data?.totalExpense ?? 0;
  const net = income - expense;

  // The chart plots income and expense side by side, so the scale has to come
  // from the largest *gross* figure in the year. It used to divide by the
  // largest |income − expense| — a net — which for a year of months that roughly
  // break even is a tiny denominator, and sent bars thousands of points past a
  // 54pt container. Hoisted out of the render loop too; it was being recomputed
  // for all 12 months inside the map.
  const yearPeak = useMemo(() => {
    const gross = yearSummary.flatMap((m) => [m?.income ?? 0, m?.expense ?? 0]);
    return Math.max(...gross, 1);
  }, [yearSummary]);

  // A year can come back with rows that are all zero, which would draw an empty
  // plot whose ticks are derived from the peak's `1` fallback ("0 1 1").
  const hasYearActivity = useMemo(
    () => yearSummary.some((m) => (m?.income ?? 0) > 0 || (m?.expense ?? 0) > 0),
    [yearSummary],
  );

  // Free only for the current year: the monthly endpoint can't take a year,
  // so past years get no drill-in chevron.
  const canDrillIn = selectedYear === currentYear;

  const recentMonths = useMemo(
    () =>
      [...yearSummary]
        .filter(
          (m) => m?.income > 0 || m?.expense > 0 || m?.transactionCount > 0,
        )
        .reverse(),
    [yearSummary],
  );

  const segmentControl = (
    <View
      style={[
        styles.segmentTrack,
        { backgroundColor: C.surface2, borderColor: C.border },
      ]}
    >
      {(["year", "trend"] as TSegment[]).map((s) => {
        const active = segment === s;
        return (
          <TouchableOpacity
            key={s}
            onPress={() => setSegment(s)}
            activeOpacity={0.8}
            style={[
              styles.segmentOpt,
              {
                borderColor: active ? C.border : "transparent",
                backgroundColor: active ? C.surface : "transparent",
              },
            ]}
          >
            <Text
              style={[
                text.bodyMd,
                { color: active ? C.text : C.textSecondary },
              ]}
            >
              {s === "year" ? "Year" : "Trend"}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (segment === "trend") {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: C.background }]}
        edges={["top"]}
      >
        <View
          style={{
            paddingHorizontal: spacing.screenPad,
            paddingTop: spacing.xs,
          }}
        >
          <Text
            style={[text.h2, { color: C.text, marginBottom: spacing.base }]}
          >
            Insights
          </Text>
          {segmentControl}
        </View>
        <View style={{ flex: 1, paddingHorizontal: spacing.screenPad }}>
          <TrendTab />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: C.background }]}
      edges={["top"]}
    >
      <FlatList
        data={showErrorCard ? [] : yearSummary.length ? recentMonths.slice(0, 5) : []}
        keyExtractor={(m) => String(m?.month)}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.accent}
          />
        }
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.screenPad },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text
              style={[text.h2, { color: C.text, marginBottom: spacing.base }]}
            >
              Insights
            </Text>
            {segmentControl}

            <View style={styles.yearNav}>
              <TouchableOpacity
                onPress={() => setSelectedYear((y) => y - 1)}
                disabled={selectedYear === startYear}
                style={styles.navChevron}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={selectedYear === startYear ? C.textMuted : C.text}
                />
              </TouchableOpacity>
              <Text style={[text.h3, { color: C.text }]}>{selectedYear}</Text>
              <TouchableOpacity
                onPress={() => setSelectedYear((y) => y + 1)}
                disabled={selectedYear >= currentYear}
                style={styles.navChevron}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={selectedYear >= currentYear ? C.textMuted : C.text}
                />
              </TouchableOpacity>
            </View>

            {isError && hasCached ? (
              <OfflineNotice
                offline={(error as ApiReadError)?.offline === true}
                onRetry={() => refetch()}
                updatedAt={dataUpdatedAt || undefined}
              />
            ) : null}

            {showErrorCard ? (
              <ErrorState
                title={`Couldn't load ${selectedYear}`}
                message={(error as any)?.message ?? "Network Error"}
                onRetry={refetch}
              />
            ) : isPending && !hasCached ? (
              <>
                <HistoryCardSkeleton />
                <HistoryCardSkeleton />
                <HistoryCardSkeleton />
              </>
            ) : (
              <View
                style={[
                  styles.netCard,
                  { backgroundColor: C.surface },
                  elevation(C, dark).glow,
                ]}
              >
                {/* One step up the hierarchy from the usual kicker colour, the
                    same way NetTodayCard's header does it, so the card's label
                    reads rather than recedes. Token, not a literal white — light
                    mode steps to its own near-black instead of going pale. */}
                <Text style={[text.kicker, { color: C.text }]}>
                  Net · {selectedYear}
                  {selectedYear === currentYear ? " so far" : ""}
                </Text>
                <View style={styles.netAmountRow}>
                  <Text
                    style={[
                      styles.netSign,
                      { color: net >= 0 ? C.income : C.expense },
                    ]}
                  >
                    {net >= 0 ? "+" : "−"}
                  </Text>
                  <Text
                    style={[
                      styles.netCurrency,
                      { color: net >= 0 ? C.income : C.expense },
                    ]}
                  >
                    ৳
                  </Text>
                  <Text
                    style={[
                      text.amountLg,
                      styles.netAmount,
                      { color: net >= 0 ? C.income : C.expense },
                    ]}
                  >
                    {fmt(net)}
                  </Text>
                </View>
                <View style={styles.inOutRow}>
                  <Text style={[text.caption, { color: C.income }]}>
                    In +৳{fmt(income)}
                  </Text>
                  <Text style={[text.caption, { color: C.expense }]}>
                    Expense −৳{fmt(expense)}
                  </Text>
                </View>
              </View>
            )}

            {!isPending && !showErrorCard && hasYearActivity ? (
              <View
                style={[
                  styles.yearChartCard,
                  { backgroundColor: C.surface, borderColor: C.border },
                ]}
              >
                <View style={styles.yearChartHead}>
                  <Text style={[text.kicker, { color: C.textSecondary }]}>
                    Income vs expense
                  </Text>
                  <View style={styles.chartLegend}>
                    <View
                      style={[styles.legendDot, { backgroundColor: C.income }]}
                    />
                    <Text style={[text.caption, { color: C.textSecondary }]}>
                      In
                    </Text>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: C.expense, marginLeft: spacing.sm },
                      ]}
                    />
                    <Text style={[text.caption, { color: C.textSecondary }]}>
                      Out
                    </Text>
                  </View>
                </View>

                <View style={styles.yearPlotRow}>
                  {/* Ticks are positioned off `bottom` and lifted half a line so
                      each sits centred on its own rule. Laying them out in flow
                      would space their boxes evenly, not their baselines. */}
                  <View style={styles.yearAxis}>
                    {YEAR_TICKS.map((f) => (
                      <Text
                        key={f}
                        numberOfLines={1}
                        style={[
                          text.caption,
                          styles.yearAxisTick,
                          { bottom: CHART_H * f - 8, color: C.textMuted },
                        ]}
                      >
                        {formatCompact(yearPeak * f)}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.yearPlotCol}>
                    <View style={styles.yearPlot}>
                      {YEAR_TICKS.map((f) => (
                        <View
                          key={f}
                          style={[
                            styles.yearRule,
                            { bottom: CHART_H * f, backgroundColor: C.divider },
                          ]}
                        />
                      ))}
                      <View style={styles.yearBarRow}>
                        {yearSummary.map((m) => {
                          const isFuture =
                            selectedYear === currentYear &&
                            m?.month > currentMonth;
                          return (
                            <View key={m?.month} style={styles.yearBarCol}>
                              <View style={styles.yearBarPair}>
                                <View
                                  style={{
                                    width: 5,
                                    height: isFuture
                                      ? 2
                                      : barHeight(m?.income, yearPeak),
                                    backgroundColor: C.income,
                                    borderRadius: 1,
                                  }}
                                />
                                <View
                                  style={{
                                    width: 5,
                                    height: isFuture
                                      ? 2
                                      : barHeight(m?.expense, yearPeak),
                                    backgroundColor: C.expense,
                                    borderRadius: 1,
                                  }}
                                />
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    {/* Month initials get their own row sharing the same flex:1
                        columns, so they stay under their bars without the
                        gridlines running across them. */}
                    <View style={styles.yearLabelRow}>
                      {yearSummary.map((m) => (
                        <View key={m?.month} style={styles.yearBarCol}>
                          <Text
                            style={[
                              text.caption,
                              styles.yearMonthLabel,
                              {
                                color:
                                  selectedYear === currentYear &&
                                  m?.month === currentMonth
                                    ? C.accentText
                                    : C.textMuted,
                              },
                            ]}
                          >
                            {MONTHS[m?.month][0]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {!isPending && !showErrorCard && yearSummary.length === 0 ? (
              <EmptyState
                title={`Nothing logged in ${selectedYear}`}
                subtitle="Totals appear here once a year has entries. Step forward to this year."
                icon="stats-chart-outline"
              />
            ) : null}
          </View>
        }
        renderItem={({ item: m }) => {
          const mNet = m?.income - m?.expense;
          const isPositive = mNet >= 0;
          const barColor = isPositive ? C.income : C.expense;

          return (
            <TouchableOpacity
              disabled={!canDrillIn}
              onPress={() =>
                canDrillIn && router.push({ pathname: "/monthlyTransactions" })
              }
              activeOpacity={canDrillIn ? 0.7 : 1}
              style={styles.monthRow}
            >
              <Text style={[text.bodyMd, { color: C.text, width: 40 }]}>
                {MONTHS[m?.month].slice(0, 3)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[text.caption, { color: C.textSecondary }]}>
                  {m?.transactionCount} entries
                </Text>
                <Text style={[text.caption, { color: C.textSecondary }]}>
                  <Text style={{ color: C.income }}>+{fmt(m?.income)}</Text>{" "}
                  <Text style={{ color: C.expense }}>−{fmt(m?.expense)}</Text>
                </Text>
              </View>
              <Text style={[text.bodyMd, { color: barColor }]}>
                {isPositive ? "+" : "−"}৳{fmt(mNet)}
              </Text>
              {canDrillIn ? (
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={C.textMuted}
                  style={{ marginLeft: spacing.sm }}
                />
              ) : null}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={[styles.divider, { backgroundColor: C.divider }]} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  segmentTrack: {
    flexDirection: "row",
    height: 36,
    padding: 3,
    borderRadius: radius.card - 1,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  segmentOpt: {
    flex: 1,
    borderRadius: radius.sm + 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  yearNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    marginBottom: spacing.base,
  },
  navChevron: { padding: 4 },
  netCard: {
    borderRadius: radius.card,
    padding: spacing.md,
    paddingBottom: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  netAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  // The scale jumps 40 (amountLg) straight to 18 (amountMd), so the headline
  // overrides amountLg's metrics rather than reaching for another token —
  // fontFamily.medium and tabular-nums still come from it, only size, leading
  // and tracking change, scaled together so the figure keeps its proportions.
  // Same treatment and same size as NetTodayCard's headline on Today.
  netAmount: { fontSize: 32, lineHeight: 36, letterSpacing: -0.64 },
  // Half the amount's size, tracking it rather than the type scale.
  netSign: { fontSize: 16 },
  netCurrency: { fontSize: 16 },
  inOutRow: { flexDirection: "row", gap: spacing.xl },
  yearChartCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.base,
    gap: spacing.md,
  },
  yearChartHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartLegend: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 2 },
  yearPlotRow: { flexDirection: "row" },
  yearAxis: { width: Y_AXIS_W, height: CHART_H },
  // Right-aligned against the plot so the ticks read as a column of numbers
  // ending at the gridlines, whatever their width.
  yearAxisTick: {
    position: "absolute",
    right: spacing.xs,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "right",
  },
  yearPlotCol: { flex: 1 },
  yearPlot: { height: CHART_H, justifyContent: "flex-end" },
  yearRule: { position: "absolute", left: 0, right: 0, height: 1 },
  // flex:1 columns rather than space-between: the bars and the month initials
  // below them are two separate rows, and only equal columns keep a letter
  // under its own pair.
  yearBarRow: { flexDirection: "row", alignItems: "flex-end", height: CHART_H },
  yearLabelRow: { flexDirection: "row" },
  yearBarCol: { flex: 1, alignItems: "center" },
  yearBarPair: { flexDirection: "row", alignItems: "flex-end", gap: 1 },
  yearMonthLabel: { fontSize: 9, lineHeight: 14, marginTop: 3 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  divider: { height: 1, marginLeft: 60 },
});
