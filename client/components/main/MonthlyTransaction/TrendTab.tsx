import EmptyState from "@/components/main/shared/EmptyState";
import TransactionCardSkeleton from "@/components/main/shared/TransactionCardSkeleton";
import { TransactionTypeConst } from "@/constants/TransactionType.constant";
import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import {
  TCategoryBreakdownEntry,
  TCategoryDetailEntry,
  TTransaction,
} from "@/types/Transaction.tyes";
import {
  formatCompact as compact,
  formatTotal as fmt,
} from "@/utils/formatAmount";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PieChart } from "react-native-gifted-charts";

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
  categoryBreakdown: TCategoryBreakdownEntry[];
};

const categoryKey = (c: TCategoryDetailEntry) =>
  c.categoryId ?? "uncategorized";

/** "2 Oct" — the day a transaction was logged, for the rows under a category. */
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "d MMM");
};

/** Sort key for an occurredAt that is a string here (it was a Date server-side). */
const atTime = (iso?: string) => {
  const t = new Date(iso ?? "").getTime();
  return Number.isNaN(t) ? 0 : t;
};

const monthChangeDirection = { prev: "prev", next: "next" } as const;

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();
const startMonth = 1;

export default function TrendTab() {
  const C = useTheme();

  // Spec 47: like Activity, every fetch is a `targetMonth` inside the current year —
  // `getMonthlyTransactions` derives the year from `new Date()` and takes no year
  // parameter. Cross-year browsing stays on Insights › Year. Forward paging stops at
  // the current month rather than December (Activity allows December): a future month
  // of this year is always empty, which is also how the Year chevron behaves.
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Spec 47: closed by default, keyed by category id. This used to hold the inverse
  // (`collapsed`, open-by-default), which rendered every category's whole transaction
  // list at once.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Carrying one month's open rows into another month's list — which may not even
  // contain those categories — is confusing, same reasoning as Activity resetting its
  // category filter on a month change (spec 13).
  useEffect(() => {
    setExpanded({});
  }, [selectedMonth]);

  const handleMonthChange = (direction: keyof typeof monthChangeDirection) => {
    if (direction === monthChangeDirection.prev && selectedMonth > startMonth) {
      setSelectedMonth(selectedMonth - 1);
    }
    if (
      direction === monthChangeDirection.next &&
      selectedMonth < currentMonth
    ) {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => setSelectedMonth(currentMonth);

  // date-fns rather than a third copy of the MONTHS array (MonthlyTransaction.tsx and
  // HistoryPage.tsx already each carry one).
  const monthLabel = format(
    new Date(currentYear, selectedMonth - 1, 1),
    "MMMM",
  );

  // Spec 47: the monthly endpoint, not `trend-transaction?months=1`. The trend window is
  // rolling and anchored to now (`start = Date.UTC(y, m - (months - 1), 1)`), so `months`
  // can only reach further back from today — it can never address a single past month.
  // This one is month-addressable and carries everything this tab draws. The key matches
  // Activity's character for character on purpose: that shares the cache with Activity
  // and Budgets, and brings the tab under the `["monthly-transaction"]` invalidation every
  // write already fires. Nothing invalidated `["trend-transaction"]`, so this view used to
  // go stale after an add or a delete.
  const { data, isPending } = useFetchData<TMonthlyData>(
    [
      "monthly-transaction",
      `monthly-transaction-${selectedMonth}`,
      String(selectedMonth),
    ],
    `/transactions/monthly-transaction?targetMonth=${selectedMonth}`,
  );

  const hasCached = !!data?.data;
  const monthly = data?.data;
  const dailyBuckets = useMemo(
    () => monthly?.transactionData ?? [],
    [monthly?.transactionData],
  );

  // The per-category detail the trend endpoint used to return pre-built. Ordering mirrors
  // its `buildCategoryDetail` so the view doesn't change under the user: transactions
  // newest first, buckets biggest spender first.
  const categoryDetail = useMemo<TCategoryDetailEntry[]>(() => {
    const buckets: Record<string, TCategoryDetailEntry> = {};

    for (const day of dailyBuckets) {
      for (const t of day?.transactions ?? []) {
        const key = t?.categoryId ?? "uncategorized";
        if (!buckets[key]) {
          buckets[key] = {
            categoryId: t?.categoryId ?? null,
            name: t?.category?.name ?? "Uncategorized",
            icon: t?.category?.icon ?? null,
            income: 0,
            expense: 0,
            transactions: [],
          };
        }

        if (t?.type === TransactionTypeConst.income) {
          buckets[key].income += t?.amount;
        } else if (t?.type === TransactionTypeConst.expense) {
          buckets[key].expense += t?.amount;
        }

        buckets[key].transactions.push({
          _id: t?._id ?? "",
          type: t?.type,
          title: t?.title,
          description: t?.description,
          amount: t?.amount,
          occurredAt: t?.occurredAt ?? t?.createdAt ?? "",
        });
      }
    }

    return Object.values(buckets)
      .map((b) => ({
        ...b,
        transactions: b.transactions.sort(
          (a, c) => atTime(c.occurredAt) - atTime(a.occurredAt),
        ),
      }))
      .sort((a, b) => b.expense - a.expense || b.income - a.income);
  }, [dailyBuckets]);

  // The donut's source stays the server's breakdown, but the monthly endpoint builds it
  // from *all* transactions where the trend endpoint built it from expense rows only — so
  // an income-only category would enter as a zero-value slice and a "৳0 (0.0%)" legend row.
  const categoryBreakdown = useMemo(
    () => (monthly?.categoryBreakdown ?? []).filter((c) => c?.expense > 0),
    [monthly?.categoryBreakdown],
  );

  const breakdownTotal = categoryBreakdown.reduce(
    (sum, c) => sum + c?.expense,
    0,
  );

  const pieData = categoryBreakdown.map((c, i) => ({
    value: c?.expense,
    text: c?.name,
    color: C.chartPalette[i % C.chartPalette.length],
  }));

  // Rendered above the content and outside the loading branch, so stepping to an uncached
  // month keeps the selector on screen while the skeleton shows underneath.
  const monthNav = (
    <View style={styles.monthNav}>
      <View style={styles.monthSelectorContainer}>
        <TouchableOpacity
          style={styles.navChevron}
          onPress={() => handleMonthChange(monthChangeDirection.prev)}
          disabled={selectedMonth === startMonth}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={selectedMonth === startMonth ? C.textMuted : C.text}
          />
        </TouchableOpacity>
        <Text style={[text.h3, { color: C.text }]}>
          {monthLabel} <Text style={{ color: C.textMuted }}>{currentYear}</Text>
        </Text>
        <TouchableOpacity
          style={styles.navChevron}
          onPress={() => handleMonthChange(monthChangeDirection.next)}
          disabled={selectedMonth >= currentMonth}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={selectedMonth >= currentMonth ? C.textMuted : C.text}
          />
        </TouchableOpacity>
      </View>

      {/* Only rendered once you have navigated away, so it reads as "you are somewhere
          else, here is the way back". Same treatment as Activity's pill (spec 31) —
          accent border + accentDim fill + accentText, 22pt with hitSlop covering the
          sub-44pt target — so the one accent affordance looks the same on both screens. */}
      {selectedMonth !== currentMonth ? (
        <TouchableOpacity
          onPress={goToCurrentMonth}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Jump to ${format(
            new Date(currentYear, currentMonth - 1, 1),
            "MMMM",
          )}`}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[
            styles.jumpPill,
            { borderColor: C.accent, backgroundColor: C.accentDim },
          ]}
        >
          <Ionicons name="today-outline" size={11} color={C.accentText} />
          <Text style={[text.captionMd, { color: C.accentText }]}>
            This month
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {monthNav}

      {isPending && !hasCached ? (
        <TransactionCardSkeleton />
      ) : (
        <>
          <Text
            style={[
              text.kicker,
              { color: C.textSecondary, marginBottom: spacing.sm },
            ]}
          >
            By category · {monthLabel}
          </Text>

          {categoryDetail.length === 0 ? (
            <EmptyState title={`No transactions in ${monthLabel}`} />
          ) : (
            categoryDetail.map((c) => {
              const key = categoryKey(c);
              const open = !!expanded[key];
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
                    onPress={() =>
                      setExpanded((p) => ({ ...p, [key]: !p[key] }))
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
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
                        const isIncome = t.type === TransactionTypeConst.income;
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
                              {dayLabel(t.occurredAt)}
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
                Spending by category · {monthLabel}
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
            <EmptyState title={`No spending in ${monthLabel} to break down`} />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The bottom margin sits on this wrapper, not the selector row, so the pill appearing
  // extends the block downward instead of being pushed clear of it.
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
  // Much smaller than CategoryPicker's 34pt chip: this is a secondary way back, and the
  // h3 above it should stay the anchor of the block. captionMd rather than caption
  // because medium weight is what still reads as a button at 12pt.
  jumpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
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
