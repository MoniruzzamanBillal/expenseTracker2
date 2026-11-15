import { useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { ApiReadError } from "@/utils/api";
import { formatTotal as fmt } from "@/utils/formatAmount";
import { Ionicons } from "@expo/vector-icons";
import { getDaysInMonth } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import CategoryBreakdown, {
  TBreakdownEntry,
} from "../shared/CategoryBreakdown";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import OfflineNotice from "../shared/OfflineNotice";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";
import MonthYearPickerSheet from "./MonthYearPickerSheet";
import NetSummaryCard from "./NetSummaryCard";
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

const startMonth = 1;
const endMonth = 12;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function MonthlyTransactionPage() {
  const C = useTheme();
  const [view, setView] = useState<TView>("monthly");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(
    null,
  );

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isCurrentMonth =
    selectedMonth === currentMonth && selectedYear === currentYear;

  const router = useRouter();
  const { targetMonth } = useLocalSearchParams<{ targetMonth?: string }>();

  useEffect(() => {
    if (!targetMonth) return;
    const month = Number(targetMonth);
    if (Number.isInteger(month) && month >= startMonth && month <= endMonth) {
      setSelectedMonth(month);
      // The deep-link param is month-only and always within the current year.
      setSelectedYear(new Date().getFullYear());
      // Landing on Weekly would hide the month that was just asked for.
      setView("monthly");
    }
    router.setParams({ targetMonth: "" });
  }, [targetMonth, router]);

  // A stale filter silently hiding data after navigating is worse than always
  // resetting it (spec 13).
  useEffect(() => {
    setSelectedCategoryKey(null);
  }, [view, selectedMonth, selectedYear]);

  const {
    data: monthlyTransaction,
    isPending: isMonthlyPending,
    isError: isMonthlyError,
    error: monthlyError,
    dataUpdatedAt: monthlyUpdatedAt,
    refetch: refetchMonthly,
  } = useFetchData<TMonthlyData>(
    [
      "monthly-transaction",
      `monthly-transaction-${selectedYear}-${selectedMonth}`,
      String(selectedYear),
      String(selectedMonth),
    ],
    `/transactions/monthly-transaction?targetMonth=${selectedMonth}&targetYear=${selectedYear}`,
    { enabled: view === "monthly" },
  );

  const {
    data: weeklyTransaction,
    isPending: isWeeklyPending,
    isError: isWeeklyError,
    error: weeklyError,
    dataUpdatedAt: weeklyUpdatedAt,
    refetch: refetchWeekly,
  } = useFetchData<TWeeklyData>(
    ["weekly-transaction"],
    `/transactions/weekly-transaction`,
    {
      enabled: view === "weekly",
    },
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    if (view === "monthly") await refetchMonthly();
    else await refetchWeekly();
    setRefreshing(false);
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);
  };

  const handlePick = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  const handleMonthChange = (direction: keyof typeof monthChangeDirection) => {
    if (direction === monthChangeDirection.prev && selectedMonth > startMonth) {
      setSelectedMonth(selectedMonth - 1);
    }
    if (direction === monthChangeDirection.next && selectedMonth < endMonth) {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const daysInSelectedMonth = isCurrentMonth
    ? new Date().getDate()
    : getDaysInMonth(new Date(selectedYear, selectedMonth - 1));

  const monthlyAverageExpense =
    daysInSelectedMonth > 0
      ? (monthlyTransaction?.data?.expense ?? 0) / daysInSelectedMonth
      : 0;

  const monthlyIncome = monthlyTransaction?.data?.income ?? 0;
  const monthlyExpense = monthlyTransaction?.data?.expense ?? 0;
  const monthlyBuckets = useMemo(
    () => monthlyTransaction?.data?.transactionData ?? [],
    [monthlyTransaction?.data?.transactionData],
  );
  const monthlyCategoryBreakdown =
    monthlyTransaction?.data?.categoryBreakdown ?? [];

  const filteredMonthlyBuckets = useMemo(() => {
    if (!selectedCategoryKey) return monthlyBuckets;
    return monthlyBuckets.map((day) => ({
      ...day,
      transactions: day?.transactions.filter(
        (t) => (t?.categoryId ?? "uncategorized") === selectedCategoryKey,
      ),
    }));
  }, [monthlyBuckets, selectedCategoryKey]);

  const weeklyBuckets = useMemo(
    () => weeklyTransaction?.data?.transactionData ?? [],
    [weeklyTransaction?.data?.transactionData],
  );
  const weeklyCategoryBreakdown =
    weeklyTransaction?.data?.categoryBreakdown ?? [];
  const weeklyIncome = weeklyTransaction?.data?.income ?? 0;
  const weeklyExpense = weeklyTransaction?.data?.expense ?? 0;

  const filteredWeeklyBuckets = useMemo(() => {
    if (!selectedCategoryKey) return weeklyBuckets;
    return weeklyBuckets.map((day) => ({
      ...day,
      transactions: day?.transactions.filter(
        (t) => (t?.categoryId ?? "uncategorized") === selectedCategoryKey,
      ),
    }));
  }, [weeklyBuckets, selectedCategoryKey]);

  // Spec 37: a failed read only blocks the screen when the active view has nothing cached to
  // show. isPending (not isLoading) so the skeleton also covers the persisted-cache restore.
  const isPending = view === "monthly" ? isMonthlyPending : isWeeklyPending;
  const isError = view === "monthly" ? isMonthlyError : isWeeklyError;
  const error = view === "monthly" ? monthlyError : weeklyError;
  const hasCached =
    view === "monthly" ? !!monthlyTransaction?.data : !!weeklyTransaction?.data;
  const showErrorCard = isError && !hasCached;
  const updatedAt =
    (view === "monthly" ? monthlyUpdatedAt : weeklyUpdatedAt) || undefined;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: C.background }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.screenPad },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.accent}
          />
        }
      >
        <Text style={[text.h2, { color: C.text, marginBottom: spacing.base }]}>
          Activity
        </Text>

        <View
          style={[
            styles.segmentTrack,
            { backgroundColor: C.surface2, borderColor: C.border },
          ]}
        >
          {(["monthly", "weekly"] as TView[])?.map((v) => {
            const active = view === v;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => setView(v)}
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
                  {v === "monthly" ? "Month" : "Week"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {view === "monthly" ? (
          <>
            <View style={styles.monthNav}>
              <View style={styles.monthSelectorContainer}>
                <TouchableOpacity
                  style={styles.navChevron}
                  onPress={() => handleMonthChange(monthChangeDirection.prev)}
                  disabled={selectedMonth === startMonth}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={selectedMonth === startMonth ? C.textMuted : C.text}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPickerOpen(true)}
                  activeOpacity={0.7}
                  style={styles.monthNameBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Select month and year"
                >
                  <Text style={[text.h3, { color: C.text }]}>
                    {MONTHS[selectedMonth - 1]}{" "}
                    <Text style={{ color: C.textMuted }}>{selectedYear}</Text>
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={C.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navChevron}
                  onPress={() => handleMonthChange(monthChangeDirection.next)}
                  disabled={selectedMonth === endMonth}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={selectedMonth === endMonth ? C.textMuted : C.text}
                  />
                </TouchableOpacity>
              </View>

              {!isCurrentMonth ? (
                <TouchableOpacity
                  onPress={goToCurrentMonth}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Jump to ${MONTHS[currentMonth - 1]}`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[
                    styles.jumpPill,
                    { borderColor: C.accent, backgroundColor: C.accentDim },
                  ]}
                >
                  <Ionicons
                    name="today-outline"
                    size={11}
                    color={C.accentText}
                  />
                  <Text style={[text.captionMd, { color: C.accentText }]}>
                    This month
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <MonthYearPickerSheet
              visible={pickerOpen}
              onDismiss={() => setPickerOpen(false)}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              currentMonth={currentMonth}
              currentYear={currentYear}
              onSelect={handlePick}
            />

            {isError && hasCached ? (
              <OfflineNotice
                offline={(error as ApiReadError)?.offline === true}
                onRetry={() => refetchMonthly()}
                updatedAt={updatedAt}
              />
            ) : null}

            {showErrorCard ? (
              <ErrorState
                title={`Couldn't load ${MONTHS[selectedMonth - 1]}`}
                message={(error as any)?.message ?? "Network Error"}
                onRetry={refetchMonthly}
              />
            ) : isPending && !hasCached ? (
              <TransactionCardSkeleton />
            ) : (
              <>
                <NetSummaryCard
                  label={`Net · ${MONTHS[selectedMonth - 1]}`}
                  caption={`avg expense ৳${fmt(monthlyAverageExpense)}/day`}
                  income={monthlyIncome}
                  expense={monthlyExpense}
                  showSplitBar
                />

                <CategoryBreakdown
                  data={monthlyCategoryBreakdown}
                  selected={selectedCategoryKey}
                  onSelect={setSelectedCategoryKey}
                />

                {monthlyBuckets.length > 0 ? (
                  <TransactionAccordion dailyData={filteredMonthlyBuckets} />
                ) : (
                  <EmptyState
                    title="No entries this month"
                    subtitle="Step back to an earlier month, or add an entry for today."
                    icon="calendar-outline"
                  />
                )}
              </>
            )}
          </>
        ) : (
          <>
            {weeklyTransaction?.data?.weekStart &&
            weeklyTransaction?.data?.weekEnd ? (
              <View style={styles.weekHeader}>
                <Text style={[text.h3, { color: C.text }]}>This week</Text>
                <Text style={[text.caption, { color: C.textMuted }]}>
                  {fmtDate(weeklyTransaction.data.weekStart)} –{" "}
                  {fmtDate(weeklyTransaction.data.weekEnd)}
                </Text>
              </View>
            ) : null}

            {isError && hasCached ? (
              <OfflineNotice
                offline={(error as ApiReadError)?.offline === true}
                onRetry={() => refetchWeekly()}
                updatedAt={updatedAt}
              />
            ) : null}

            {showErrorCard ? (
              <ErrorState
                title="Couldn't load this week"
                message={(error as any)?.message ?? "Network Error"}
                onRetry={refetchWeekly}
              />
            ) : isPending && !hasCached ? (
              <TransactionCardSkeleton />
            ) : (
              <>
                <NetSummaryCard
                  label="Net this week"
                  income={weeklyIncome}
                  expense={weeklyExpense}
                />

                <CategoryBreakdown
                  data={weeklyCategoryBreakdown}
                  selected={selectedCategoryKey}
                  onSelect={setSelectedCategoryKey}
                />

                {weeklyBuckets.length > 0 ? (
                  <TransactionAccordion dailyData={filteredWeeklyBuckets} />
                ) : (
                  <EmptyState
                    title="No entries this week"
                    subtitle="Add one with the + button"
                    icon="calendar-outline"
                  />
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
  monthNav: {
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  monthSelectorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  navChevron: { padding: 4 },
  // Tappable month/year label; row so the chevron-down sits beside the text.
  monthNameBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  // Much smaller than CategoryPicker's 34pt chip: this is a secondary way back,
  // and the h3 above it should stay the anchor of the block. captionMd rather
  // than caption because medium weight is what still reads as a button at 12pt.
  jumpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  weekHeader: { marginBottom: spacing.base, gap: 3, alignItems: "center" },
});
