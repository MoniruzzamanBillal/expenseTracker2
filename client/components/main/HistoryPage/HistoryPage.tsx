import { useFetchData } from "@/hooks/useApi";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { TTransactionHistory } from "@/types/Transaction.tyes";
import { useTheme, text, spacing, radius, elevation } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import TrendTab from "../MonthlyTransaction/TrendTab";
import HistoryCardSkeleton from "./HistoryCardSkeleton";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type TData = {
  totalExpense: number;
  totalIncome: number;
  yearSummary: TTransactionHistory[];
};

const startYear = 2025;
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

type TSegment = "year" | "trend";

export default function HistoryPage() {
  const C = useTheme();
  const dark = C.statusBarStyle === "light";
  const router = useRouter();
  const [segment, setSegment] = useState<TSegment>("year");
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const {
    data: yearlyTransactions,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useFetchData<TData>(["yearly-transaction", String(selectedYear)], `/transactions/yearly-transaction?targetYear=${selectedYear}`, {
    enabled: segment === "year",
  });

  const yearSummary = useMemo(() => yearlyTransactions?.data?.yearSummary ?? [], [yearlyTransactions?.data?.yearSummary]);
  const income = yearlyTransactions?.data?.totalIncome ?? 0;
  const expense = yearlyTransactions?.data?.totalExpense ?? 0;
  const net = income - expense;

  // Free only for the current year: the monthly endpoint can't take a year,
  // so past years get no drill-in chevron.
  const canDrillIn = selectedYear === currentYear;

  const recentMonths = useMemo(() => [...yearSummary].filter((m) => m?.income > 0 || m?.expense > 0 || m?.transactionCount > 0).reverse(), [yearSummary]);

  const segmentControl = (
    <View style={[styles.segmentTrack, { backgroundColor: C.surface2, borderColor: C.border }]}>
      {(["year", "trend"] as TSegment[]).map((s) => {
        const active = segment === s;
        return (
          <TouchableOpacity
            key={s}
            onPress={() => setSegment(s)}
            activeOpacity={0.8}
            style={[styles.segmentOpt, { borderColor: active ? C.border : "transparent", backgroundColor: active ? C.surface : "transparent" }]}
          >
            <Text style={[text.bodyMd, { color: active ? C.text : C.textSecondary }]}>{s === "year" ? "Year" : "Trend"}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (segment === "trend") {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={["top"]}>
        <View style={{ paddingHorizontal: spacing.screenPad, paddingTop: spacing.xs }}>
          <Text style={[text.h2, { color: C.text, marginBottom: spacing.base }]}>Insights</Text>
          {segmentControl}
        </View>
        <View style={{ flex: 1, paddingHorizontal: spacing.screenPad }}>
          <TrendTab />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={["top"]}>
      <FlatList
        data={isError ? [] : yearSummary.length ? recentMonths.slice(0, 5) : []}
        keyExtractor={(m) => String(m?.month)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.accent} />}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={[text.h2, { color: C.text, marginBottom: spacing.base }]}>Insights</Text>
            {segmentControl}

            <View style={styles.yearNav}>
              <TouchableOpacity
                onPress={() => setSelectedYear((y) => y - 1)}
                disabled={selectedYear === startYear}
                style={styles.navChevron}
              >
                <Ionicons name="chevron-back" size={18} color={selectedYear === startYear ? C.textMuted : C.text} />
              </TouchableOpacity>
              <Text style={[text.h3, { color: C.text }]}>{selectedYear}</Text>
              <TouchableOpacity
                onPress={() => setSelectedYear((y) => y + 1)}
                disabled={selectedYear >= currentYear}
                style={styles.navChevron}
              >
                <Ionicons name="chevron-forward" size={18} color={selectedYear >= currentYear ? C.textMuted : C.text} />
              </TouchableOpacity>
            </View>

            {isError ? (
              <ErrorState title={`Couldn't load ${selectedYear}`} message={(error as any)?.message ?? "Network Error"} onRetry={refetch} />
            ) : isLoading ? (
              <>
                <HistoryCardSkeleton />
                <HistoryCardSkeleton />
                <HistoryCardSkeleton />
              </>
            ) : (
              <View style={[styles.netCard, { backgroundColor: C.surface }, elevation(C, dark).glow]}>
                <Text style={[text.kicker, { color: C.textSecondary }]}>Net · {selectedYear}{selectedYear === currentYear ? " so far" : ""}</Text>
                <View style={styles.netAmountRow}>
                  <Text style={[styles.netSign, { color: net >= 0 ? C.income : C.expense }]}>{net >= 0 ? "+" : "−"}</Text>
                  <Text style={[styles.netCurrency, { color: net >= 0 ? C.income : C.expense }]}>৳</Text>
                  <Text style={[text.amountLg, { color: net >= 0 ? C.income : C.expense }]}>{fmt(net)}</Text>
                </View>
                <View style={styles.inOutRow}>
                  <Text style={[text.bodySm, { color: C.income }]}>In +৳{fmt(income)}</Text>
                  <Text style={[text.bodySm, { color: C.expense }]}>Expense −৳{fmt(expense)}</Text>
                </View>
              </View>
            )}

            {!isLoading && !isError && yearSummary.length > 0 ? (
              <View style={[styles.yearBarRow, { backgroundColor: C.surface, borderColor: C.border }]}>
                {yearSummary.map((m) => {
                  const maxAbs = Math.max(...yearSummary.map((x) => Math.abs(x?.income - x?.expense)), 1);
                  const isFuture = selectedYear === currentYear && m?.month > currentMonth;
                  const isCurrentMonth = selectedYear === currentYear && m?.month === currentMonth;
                  return (
                    <View key={m?.month} style={styles.yearBarCol}>
                      <View style={styles.yearBarPair}>
                        <View style={{ width: 5, height: isFuture ? 2 : Math.max((m?.income / (maxAbs || 1)) * 54, m?.income > 0 ? 2 : 0), backgroundColor: C.income, borderRadius: 1 }} />
                        <View style={{ width: 5, height: isFuture ? 2 : Math.max((m?.expense / (maxAbs || 1)) * 54, m?.expense > 0 ? 2 : 0), backgroundColor: C.expense, borderRadius: 1 }} />
                      </View>
                      <Text style={[text.caption, { color: isCurrentMonth ? C.accentText : C.textMuted, fontSize: 9 }]}>{MONTHS[m?.month][0]}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {!isLoading && !isError && yearSummary.length === 0 ? (
              <EmptyState title={`Nothing logged in ${selectedYear}`} subtitle="Totals appear here once a year has entries. Step forward to this year." icon="stats-chart-outline" />
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
              onPress={() => canDrillIn && router.push({ pathname: "/monthlyTransactions" })}
              activeOpacity={canDrillIn ? 0.7 : 1}
              style={styles.monthRow}
            >
              <Text style={[text.bodyMd, { color: C.text, width: 40 }]}>{MONTHS[m?.month].slice(0, 3)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[text.caption, { color: C.textSecondary }]}>{m?.transactionCount} entries</Text>
                <Text style={[text.caption, { color: C.textSecondary }]}>
                  <Text style={{ color: C.income }}>+{fmt(m?.income)}</Text> <Text style={{ color: C.expense }}>−{fmt(m?.expense)}</Text>
                </Text>
              </View>
              <Text style={[text.bodyMd, { color: barColor }]}>
                {isPositive ? "+" : "−"}৳{fmt(mNet)}
              </Text>
              {canDrillIn ? <Ionicons name="chevron-forward" size={16} color={C.textMuted} style={{ marginLeft: spacing.sm }} /> : null}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: C.divider }]} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  segmentTrack: { flexDirection: "row", height: 36, padding: 3, borderRadius: radius.card - 1, borderWidth: 1, marginBottom: spacing.base },
  segmentOpt: { flex: 1, borderRadius: radius.sm + 1, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  yearNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg, marginBottom: spacing.base },
  navChevron: { padding: 4 },
  netCard: { borderRadius: radius.card, padding: spacing.base, paddingBottom: spacing.lg, gap: spacing.md, marginBottom: spacing.base },
  netAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  netSign: { fontSize: 22 },
  netCurrency: { fontSize: 22 },
  inOutRow: { flexDirection: "row", gap: spacing.xl },
  yearBarRow: { flexDirection: "row", justifyContent: "space-between", borderRadius: radius.card, borderWidth: 1, padding: spacing.md, marginBottom: spacing.base },
  yearBarCol: { alignItems: "center", gap: 4 },
  yearBarPair: { flexDirection: "row", alignItems: "flex-end", gap: 1, height: 54 },
  monthRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  divider: { height: 1, marginLeft: 60 },
});
