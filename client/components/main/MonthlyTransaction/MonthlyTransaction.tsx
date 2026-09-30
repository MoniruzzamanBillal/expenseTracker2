import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFetchData } from "@/hooks/useApi";
import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { Ionicons } from "@expo/vector-icons";
import { getDaysInMonth } from "date-fns";
import CategoryBreakdown, { TBreakdownEntry } from "../shared/CategoryBreakdown";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";
import TransactionAccordion from "./TransactionAccordion";
import { formatTotal as fmt } from "@/utils/formatAmount";

type TView = "monthly" | "weekly";

type TDailyData = {
  date: string;
  expense: number;
  income: number;
  transactions: TTransaction[];
};

type TMonthlyData = {
  expense: number;
  income: number;
  transactionData: TDailyData[];
  categoryBreakdown: TBreakdownEntry[];
};

type TWeeklyData = {
  weekStart?: string;
  weekEnd?: string;
  expense: number;
  income: number;
  transactionData: TDailyData[];
  categoryBreakdown: TBreakdownEntry[];
};

const monthChangeDirection = { prev: "prev", next: "next" } as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const startMonth = 1;
const endMonth = 12;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function MonthlyTransactionPage() {
  const C = useTheme();
  const dark = C.statusBarStyle === "light";
  const [view, setView] = useState<TView>("monthly");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // A stale filter silently hiding data after navigating is worse than always
  // resetting it (spec 13).
  useEffect(() => {
    setSelectedCategoryKey(null);
  }, [view, selectedMonth]);

  const {
    data: monthlyTransaction,
    isLoading: isMonthlyLoading,
    isError: isMonthlyError,
    error: monthlyError,
    refetch: refetchMonthly,
  } = useFetchData<TMonthlyData>(
    ["monthly-transaction", `monthly-transaction-${selectedMonth}`, String(selectedMonth)],
    `/transactions/monthly-transaction?targetMonth=${selectedMonth}`,
    { enabled: view === "monthly" },
  );

  const {
    data: weeklyTransaction,
    isLoading: isWeeklyLoading,
    isError: isWeeklyError,
    error: weeklyError,
    refetch: refetchWeekly,
  } = useFetchData<TWeeklyData>(["weekly-transaction"], `/transactions/weekly-transaction`, {
    enabled: view === "weekly",
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    if (view === "monthly") await refetchMonthly();
    else await refetchWeekly();
    setRefreshing(false);
  };

  const goToCurrentMonth = () => setSelectedMonth(currentMonth);

  const handleMonthChange = (direction: keyof typeof monthChangeDirection) => {
    if (direction === monthChangeDirection.prev && selectedMonth > startMonth) {
      setSelectedMonth(selectedMonth - 1);
    }
    if (direction === monthChangeDirection.next && selectedMonth < endMonth) {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const daysInSelectedMonth = selectedMonth === currentMonth ? new Date().getDate() : getDaysInMonth(new Date(currentYear, selectedMonth - 1));

  const monthlyAverageExpense = daysInSelectedMonth > 0 ? (monthlyTransaction?.data?.expense ?? 0) / daysInSelectedMonth : 0;

  const monthlyIncome = monthlyTransaction?.data?.income ?? 0;
  const monthlyExpense = monthlyTransaction?.data?.expense ?? 0;
  const monthlyNet = monthlyIncome - monthlyExpense;
  const monthlyBuckets = useMemo(() => monthlyTransaction?.data?.transactionData ?? [], [monthlyTransaction?.data?.transactionData]);
  const monthlyCategoryBreakdown = monthlyTransaction?.data?.categoryBreakdown ?? [];

  const filteredMonthlyBuckets = useMemo(() => {
    if (!selectedCategoryKey) return monthlyBuckets;
    return monthlyBuckets.map((day) => ({
      ...day,
      transactions: day?.transactions.filter((t) => (t?.categoryId ?? "uncategorized") === selectedCategoryKey),
    }));
  }, [monthlyBuckets, selectedCategoryKey]);

  const weeklyBuckets = useMemo(() => weeklyTransaction?.data?.transactionData ?? [], [weeklyTransaction?.data?.transactionData]);
  const weeklyCategoryBreakdown = weeklyTransaction?.data?.categoryBreakdown ?? [];
  const weeklyIncome = weeklyTransaction?.data?.income ?? 0;
  const weeklyExpense = weeklyTransaction?.data?.expense ?? 0;
  const weeklyNet = weeklyIncome - weeklyExpense;

  const filteredWeeklyBuckets = useMemo(() => {
    if (!selectedCategoryKey) return weeklyBuckets;
    return weeklyBuckets.map((day) => ({
      ...day,
      transactions: day?.transactions.filter((t) => (t?.categoryId ?? "uncategorized") === selectedCategoryKey),
    }));
  }, [weeklyBuckets, selectedCategoryKey]);

  const isLoading = view === "monthly" ? isMonthlyLoading : isWeeklyLoading;
  const isError = view === "monthly" ? isMonthlyError : isWeeklyError;
  const error = view === "monthly" ? monthlyError : weeklyError;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
      >
        <Text style={[text.h2, { color: C.text, marginBottom: spacing.base }]}>Activity</Text>

        <View style={[styles.segmentTrack, { backgroundColor: C.surface2, borderColor: C.border }]}>
          {(["monthly", "weekly"] as TView[]).map((v) => {
            const active = view === v;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => setView(v)}
                activeOpacity={0.8}
                style={[styles.segmentOpt, { borderColor: active ? C.border : "transparent", backgroundColor: active ? C.surface : "transparent" }]}
              >
                <Text style={[text.bodyMd, { color: active ? C.text : C.textSecondary }]}>{v === "monthly" ? "Month" : "Week"}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {view === "monthly" ? (
          <>
            <View style={styles.monthNav}>
              <View style={styles.monthSelectorContainer}>
                <TouchableOpacity style={styles.navChevron} onPress={() => handleMonthChange(monthChangeDirection.prev)} disabled={selectedMonth === startMonth}>
                  <Ionicons name="chevron-back" size={18} color={selectedMonth === startMonth ? C.textMuted : C.text} />
                </TouchableOpacity>
                <Text style={[text.h3, { color: C.text }]}>
                  {MONTHS[selectedMonth - 1]} <Text style={{ color: C.textMuted }}>{currentYear}</Text>
                </Text>
                <TouchableOpacity style={styles.navChevron} onPress={() => handleMonthChange(monthChangeDirection.next)} disabled={selectedMonth === endMonth}>
                  <Ionicons name="chevron-forward" size={18} color={selectedMonth === endMonth ? C.textMuted : C.text} />
                </TouchableOpacity>
              </View>

              {/* Only rendered once you have navigated away, so it reads as "you are
                  somewhere else, here is the way back" rather than as a permanent
                  control. Borrows CategoryPicker's active-chip treatment (accent
                  border + accentDim fill + accentText) so the screen's one accent
                  affordance looks the same everywhere. Comparing months alone is
                  correct: there is no year navigation — every fetch is a
                  `targetMonth` inside currentYear. */}
              {selectedMonth !== currentMonth ? (
                <TouchableOpacity
                  onPress={goToCurrentMonth}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Jump to ${MONTHS[currentMonth - 1]}`}
                  // The pill is 22pt tall, well under spacing.hitTarget — hitSlop
                  // buys back the touch area without inflating the visual.
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.jumpPill, { borderColor: C.accent, backgroundColor: C.accentDim }]}
                >
                  <Ionicons name="today-outline" size={11} color={C.accentText} />
                  <Text style={[text.captionMd, { color: C.accentText }]}>This month</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {isError ? (
              <ErrorState title={`Couldn't load ${MONTHS[selectedMonth - 1]}`} message={(error as any)?.message ?? "Network Error"} onRetry={refetchMonthly} />
            ) : isLoading ? (
              <TransactionCardSkeleton />
            ) : (
              <>
                <View style={[styles.netCard, { backgroundColor: C.surface }, elevation(C, dark).glow]}>
                  <View style={styles.rowBetween}>
                    <Text style={[text.kicker, { color: C.textSecondary }]}>Net · {MONTHS[selectedMonth - 1]}</Text>
                    <Text style={[text.caption, { color: C.textMuted }]}>avg expense ৳{fmt(monthlyAverageExpense)}/day</Text>
                  </View>
                  <View style={styles.netAmountRow}>
                    <Text style={[styles.netSign, { color: monthlyNet >= 0 ? C.income : C.expense }]}>{monthlyNet >= 0 ? "+" : "−"}</Text>
                    <Text style={[styles.netCurrency, { color: monthlyNet >= 0 ? C.income : C.expense }]}>৳</Text>
                    <Text style={[text.amountLg, { color: monthlyNet >= 0 ? C.income : C.expense }]}>{fmt(monthlyNet)}</Text>
                  </View>
                  <View style={styles.splitBar}>
                    <View style={{ flex: monthlyIncome || 0.001, borderRadius: 3, backgroundColor: C.income }} />
                    <View style={{ flex: monthlyExpense || 0.001, borderRadius: 3, backgroundColor: C.expense }} />
                  </View>
                  <View style={styles.inOutRow}>
                    <Text style={[text.bodySm, { color: C.income }]}>In +৳{fmt(monthlyIncome)}</Text>
                    <Text style={[text.bodySm, { color: C.expense }]}>Expense −৳{fmt(monthlyExpense)}</Text>
                  </View>
                </View>

                <CategoryBreakdown data={monthlyCategoryBreakdown} selected={selectedCategoryKey} onSelect={setSelectedCategoryKey} />

                {monthlyBuckets.length > 0 ? (
                  <TransactionAccordion dailyData={filteredMonthlyBuckets} />
                ) : (
                  <EmptyState title="No entries this month" subtitle="Step back to an earlier month, or add an entry for today." icon="calendar-outline" />
                )}
              </>
            )}
          </>
        ) : (
          <>
            {weeklyTransaction?.data?.weekStart && weeklyTransaction?.data?.weekEnd ? (
              <View style={styles.weekHeader}>
                <Text style={[text.h3, { color: C.text }]}>This week</Text>
                <Text style={[text.caption, { color: C.textMuted }]}>
                  {fmtDate(weeklyTransaction.data.weekStart)} – {fmtDate(weeklyTransaction.data.weekEnd)}
                </Text>
              </View>
            ) : null}

            {isError ? (
              <ErrorState title="Couldn't load this week" message={(error as any)?.message ?? "Network Error"} onRetry={refetchWeekly} />
            ) : isLoading ? (
              <TransactionCardSkeleton />
            ) : (
              <>
                <View style={[styles.netCard, { backgroundColor: C.surface }, elevation(C, dark).glow]}>
                  <Text style={[text.kicker, { color: C.textSecondary }]}>Net this week</Text>
                  <View style={styles.netAmountRow}>
                    <Text style={[styles.netSign, { color: weeklyNet >= 0 ? C.income : C.expense }]}>{weeklyNet >= 0 ? "+" : "−"}</Text>
                    <Text style={[styles.netCurrency, { color: weeklyNet >= 0 ? C.income : C.expense }]}>৳</Text>
                    <Text style={[text.amountLg, { color: weeklyNet >= 0 ? C.income : C.expense }]}>{fmt(weeklyNet)}</Text>
                  </View>
                  <View style={styles.inOutRow}>
                    <Text style={[text.bodySm, { color: C.income }]}>In +৳{fmt(weeklyIncome)}</Text>
                    <Text style={[text.bodySm, { color: C.expense }]}>Expense −৳{fmt(weeklyExpense)}</Text>
                  </View>
                </View>

                <CategoryBreakdown data={weeklyCategoryBreakdown} selected={selectedCategoryKey} onSelect={setSelectedCategoryKey} />

                {weeklyBuckets.length > 0 ? (
                  <TransactionAccordion dailyData={filteredWeeklyBuckets} />
                ) : (
                  <EmptyState title="No entries this week" subtitle="Add one with the + button" icon="calendar-outline" />
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.xs, paddingBottom: spacing.lg },
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
  // The bottom margin moved off the selector row onto this wrapper, so the pill
  // appearing extends the block downward instead of being pushed clear of it.
  monthNav: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.base },
  monthSelectorContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  navChevron: { padding: 4 },
  // Much smaller than CategoryPicker's 34pt chip: this is a secondary way back,
  // and the h3 above it should stay the anchor of the block. captionMd rather
  // than caption because medium weight is what still reads as a button at 12pt.
  jumpPill: { flexDirection: "row", alignItems: "center", gap: 4, height: 22, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1 },
  netCard: { borderRadius: radius.card, padding: spacing.base, paddingBottom: spacing.lg, gap: spacing.md, marginBottom: spacing.base },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  netAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  netSign: { fontSize: 22 },
  netCurrency: { fontSize: 22 },
  splitBar: { flexDirection: "row", gap: 3, height: 6 },
  inOutRow: { flexDirection: "row", gap: spacing.xl },
  weekHeader: { marginBottom: spacing.base, gap: 3, alignItems: "center" },
});
