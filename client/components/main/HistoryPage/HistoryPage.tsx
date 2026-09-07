import { useFetchData } from "@/hooks/useApi";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TTransactionHistory } from "@/types/Transaction.tyes";
import { useTheme, text, spacing, radius, fontFamily } from "@/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import SummaryPills from "../shared/SummaryPills";
import HistoryCardSkeleton from "./HistoryCardSkeleton";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type TData = {
  totalExpense: number;
  totalIncome: number;
  yearSummary: TTransactionHistory[];
};

const startYear = 2025;
const currentYear = new Date().getFullYear();

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

export default function HistoryPage() {
  const C = useTheme();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const {
    data: yearlyTransactions,
    isLoading,
    refetch,
    isRefetching,
  } = useFetchData<TData>(
    ["yearly-transaction", String(selectedYear)],
    `/transactions/yearly-transaction?targetYear=${selectedYear}`,
  );

  const yearSummary = useMemo(
    () => yearlyTransactions?.data?.yearSummary ?? [],
    [yearlyTransactions?.data?.yearSummary],
  );
  const maxAbs = useMemo(
    () => Math.max(...yearSummary.map((m) => Math.abs(m.income - m.expense)), 1),
    [yearSummary],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <FlatList
        data={yearSummary}
        keyExtractor={(m) => String(m.month)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.accent} />}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.yearNav}>
              <TouchableOpacity
                onPress={() => setSelectedYear((y) => y - 1)}
                disabled={selectedYear === startYear}
                style={[styles.navBtn, { backgroundColor: C.surface2, opacity: selectedYear === startYear ? 0.4 : 1 }]}
              >
                <MaterialCommunityIcons name="chevron-left" size={18} color={C.textSecondary} />
              </TouchableOpacity>
              <Text style={[text.h2, { color: C.text }]}>{selectedYear}</Text>
              <TouchableOpacity
                onPress={() => setSelectedYear((y) => y + 1)}
                disabled={selectedYear >= currentYear}
                style={[styles.navBtn, { backgroundColor: C.surface2, opacity: selectedYear >= currentYear ? 0.4 : 1 }]}
              >
                <MaterialCommunityIcons name="chevron-right" size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <SummaryPills
              pills={[
                { label: "INCOME", value: `৳${fmt(yearlyTransactions?.data?.totalIncome ?? 0)}`, color: C.income, bg: C.incomeBg },
                { label: "EXPENSE", value: `৳${fmt(yearlyTransactions?.data?.totalExpense ?? 0)}`, color: C.expense, bg: C.expenseBg },
                {
                  label: "NET",
                  value: `৳${fmt((yearlyTransactions?.data?.totalIncome ?? 0) - (yearlyTransactions?.data?.totalExpense ?? 0))}`,
                  color: C.accent,
                  bg: C.accentDim,
                },
              ]}
            />

            {(isLoading || isRefetching) &&
              Array.from({ length: 6 }).map((_, i) => <HistoryCardSkeleton key={i} />)}
          </View>
        }
        renderItem={({ item: m }) => {
          const net = m.income - m.expense;
          const isPositive = net >= 0;
          const barColor = isPositive ? C.income : C.expense;
          const barWidth = (Math.abs(net) / maxAbs) * 100;
          const isCurrent = m.month === new Date().getMonth() && selectedYear === currentYear;

          return (
            <View
              style={[
                styles.monthCard,
                { backgroundColor: isCurrent ? C.surface : "transparent", borderColor: isCurrent ? C.accentBorder : C.divider },
              ]}
            >
              {isCurrent ? (
                <>
                  <View style={styles.rowBetween}>
                    <Text style={[text.bodyMd, { color: C.text }]}>{MONTHS[m.month]}</Text>
                    <Text style={[text.amountXs, { color: barColor }]}>
                      {isPositive ? "+" : "−"}৳{fmt(net)}
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: C.divider }]}>
                    <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
                  </View>
                  <View style={[styles.rowBetween, { marginTop: 5, marginBottom: 0 }]}>
                    <Text style={[text.caption, { color: C.textSecondary }]}>In ৳{fmt(m.income)}</Text>
                    <Text style={[text.caption, { color: C.textSecondary }]}>Exp ৳{fmt(m.expense)}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.compactRow}>
                  <Text style={[{ fontSize: 14, fontFamily: fontFamily.medium, width: 80 }, { color: C.text }]}>
                    {MONTHS[m.month]}
                  </Text>
                  <View style={styles.compactBarWrap}>
                    <View style={[styles.barTrackSm, { backgroundColor: C.divider }]}>
                      <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor, opacity: 0.7 }]} />
                    </View>
                  </View>
                  <Text style={[text.amountXs, { color: barColor, width: 76, textAlign: "right" }]}>
                    {isPositive ? "+" : "−"}৳{fmt(net)}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  yearNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xl, marginBottom: spacing.base },
  navBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  monthCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  barTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  barTrackSm: { height: 3, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  compactRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  compactBarWrap: { flex: 1 },
});
