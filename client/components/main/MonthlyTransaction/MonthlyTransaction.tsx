import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFetchData } from "@/hooks/useApi";
import { TTransaction } from "@/types/Transaction.tyes";
import { useTheme, text, spacing, radius } from "@/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getDaysInMonth } from "date-fns";
import EmptyState from "../shared/EmptyState";
import SummaryPills from "../shared/SummaryPills";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";
import TransactionAccordion from "./TransactionAccordion";

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
};

type TWeeklyData = {
  weekStart?: string;
  weekEnd?: string;
  expense: number;
  income: number;
  transactionData: TDailyData[];
};

const monthChangeDirection = { prev: "prev", next: "next" } as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const startMonth = 1;
const endMonth = 12;

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function MonthlyTransactionPage() {
  const C = useTheme();
  const [view, setView] = useState<TView>("monthly");
  const [refreshing, setRefreshing] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const {
    data: monthlyTransaction,
    isLoading: isMonthlyLoading,
    refetch: refetchMonthly,
  } = useFetchData<TMonthlyData>(
    ["monthly-transaction", `monthly-transaction-${selectedMonth}`, String(selectedMonth)],
    `/transactions/monthly-transaction?targetMonth=${selectedMonth}`,
    { enabled: view === "monthly" },
  );

  const {
    data: weeklyTransaction,
    isLoading: isWeeklyLoading,
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

  const handleMonthChange = (direction: keyof typeof monthChangeDirection) => {
    if (direction === monthChangeDirection.prev && selectedMonth > startMonth) {
      setSelectedMonth(selectedMonth - 1);
    }
    if (direction === monthChangeDirection.next && selectedMonth < endMonth) {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => setSelectedMonth(currentMonth);

  const daysInSelectedMonth =
    selectedMonth === currentMonth
      ? new Date().getDate()
      : getDaysInMonth(new Date(currentYear, selectedMonth - 1));

  const monthlyAverageExpense =
    daysInSelectedMonth > 0 ? (monthlyTransaction?.data?.expense ?? 0) / daysInSelectedMonth : 0;

  const monthlyBalance = (monthlyTransaction?.data?.income ?? 0) - (monthlyTransaction?.data?.expense ?? 0);
  const monthlyBuckets = monthlyTransaction?.data?.transactionData ?? [];

  const weeklyBuckets = useMemo(
    () => weeklyTransaction?.data?.transactionData ?? [],
    [weeklyTransaction?.data?.transactionData],
  );
  const daysWithExpense = weeklyBuckets.filter((d) => d.expense > 0).length;
  const weeklyAverageExpense =
    daysWithExpense > 0 ? (weeklyTransaction?.data?.expense ?? 0) / daysWithExpense : 0;
  const weeklyMaxAbs = useMemo(
    () => Math.max(...weeklyBuckets.map((b) => Math.abs(b.income - b.expense)), 1),
    [weeklyBuckets],
  );

  const isLoading = view === "monthly" ? isMonthlyLoading : isWeeklyLoading;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
      >
        <Text style={[text.navTitle, { color: C.text, marginBottom: spacing.base }]}>Overview</Text>

        <View style={[styles.segmentTrack, { backgroundColor: C.surface2, borderColor: C.border }]}>
          {(["monthly", "weekly"] as TView[]).map((v) => {
            const active = view === v;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => setView(v)}
                activeOpacity={0.8}
                style={[
                  styles.segmentOpt,
                  { borderColor: active ? C.accent : "transparent", backgroundColor: active ? C.accentDim : "transparent" },
                ]}
              >
                <Text style={[text.bodyMd, { color: active ? C.accent : C.textSecondary }]}>
                  {v === "monthly" ? "Monthly" : "Weekly"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {view === "monthly" ? (
          <>
            <View style={styles.monthSelectorContainer}>
              <View style={styles.monthContainer}>
                <View style={[styles.monthContainerWrapper, { borderColor: C.border, backgroundColor: C.surface }]}>
                  <TouchableOpacity
                    style={styles.navChevron}
                    onPress={() => handleMonthChange(monthChangeDirection.prev)}
                    disabled={selectedMonth === startMonth}
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={18}
                      color={selectedMonth === startMonth ? C.textMuted : C.text}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={goToCurrentMonth}>
                    <Text style={[text.bodyMd, { color: C.text }]}>{MONTHS[selectedMonth - 1]}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.navChevron}
                    onPress={() => handleMonthChange(monthChangeDirection.next)}
                    disabled={selectedMonth === endMonth}
                  >
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color={selectedMonth === endMonth ? C.textMuted : C.text}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {selectedMonth !== currentMonth && (
                <TouchableOpacity
                  style={[styles.currentMonthButton, { borderColor: C.accentBorder, backgroundColor: C.accentDim }]}
                  onPress={goToCurrentMonth}
                >
                  <MaterialCommunityIcons name="calendar-today" size={12} color={C.accent} />
                  <Text style={[text.caption, { color: C.accent }]}>Current Month</Text>
                </TouchableOpacity>
              )}
            </View>

            <SummaryPills
              pills={[
                { label: "IN", value: `৳${fmt(monthlyTransaction?.data?.income ?? 0)}`, color: C.income, bg: C.incomeBg },
                { label: "EXP", value: `৳${fmt(monthlyTransaction?.data?.expense ?? 0)}`, color: C.expense, bg: C.expenseBg },
                {
                  label: "BAL",
                  value: `${monthlyBalance >= 0 ? "+" : "−"}৳${fmt(monthlyBalance)}`,
                  color: monthlyBalance >= 0 ? C.income : C.expense,
                  bg: monthlyBalance >= 0 ? C.incomeBg : C.expenseBg,
                },
                { label: "AVG", value: `৳${fmt(monthlyAverageExpense)}`, color: C.textSecondary, bg: C.surface2 },
              ]}
            />

            {isLoading ? (
              <TransactionCardSkeleton />
            ) : monthlyBuckets.length > 0 ? (
              <TransactionAccordion dailyData={monthlyBuckets} />
            ) : (
              <EmptyState title="No transactions this month" />
            )}
          </>
        ) : (
          <>
            {weeklyTransaction?.data?.weekStart && weeklyTransaction?.data?.weekEnd ? (
              <View style={styles.weekHeader}>
                <Text style={[text.navTitle, { color: C.text }]}>
                  {fmtDate(weeklyTransaction.data.weekStart)} – {fmtDate(weeklyTransaction.data.weekEnd)}
                </Text>
                <Text style={[text.caption, { color: C.textSecondary }]}>Fri – Thu</Text>
              </View>
            ) : null}

            <SummaryPills
              pills={[
                { label: "WEEK EXP", value: `৳${fmt(weeklyTransaction?.data?.expense ?? 0)}`, color: C.expense, bg: C.expenseBg },
                { label: "DAILY AVG", value: `৳${fmt(weeklyAverageExpense)}`, color: C.textSecondary, bg: C.surface2 },
                { label: "WEEK IN", value: `৳${fmt(weeklyTransaction?.data?.income ?? 0)}`, color: C.income, bg: C.incomeBg },
              ]}
            />

            {isLoading ? (
              <TransactionCardSkeleton />
            ) : weeklyBuckets.length > 0 ? (
              <TransactionAccordion dailyData={weeklyBuckets} showBar maxAbs={weeklyMaxAbs} />
            ) : (
              <EmptyState title="No transactions this week" subtitle="Add one with the + button" />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  segmentTrack: { flexDirection: "row", borderRadius: radius.lg, borderWidth: 1, padding: 4, gap: 4, marginBottom: spacing.lg },
  segmentOpt: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: "center", borderWidth: 1 },
  monthSelectorContainer: { marginBottom: spacing.base, alignItems: "center" },
  monthContainer: { justifyContent: "center", alignItems: "center" },
  monthContainerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 999,
  },
  navChevron: { padding: 4 },
  currentMonthButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: 999,
  },
  weekHeader: { marginBottom: spacing.base, gap: 3, alignItems: "center" },
});
