import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, SafeAreaView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTheme, text, spacing, radius, fontFamily } from '@/theme';
import { useFetchData } from '@/hooks/useApi';
import SummaryPills from '@/components/main/shared/SummaryPills';
import type { TMonthSummary } from '@/types/Transaction.types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type TData = { totalIncome: number; totalExpense: number; yearSummary: TMonthSummary[] };

const fmt = (n: number) => Math.abs(n).toLocaleString('en-IN');

export default function HistoryPage() {
  const C = useTheme();
  const [year, setYear] = useState(new Date().getFullYear());
  const now = new Date();

  const { data, isLoading, refetch, isRefetching } = useFetchData<TData>(
    ['yearly-transaction', String(year)],
    '/transactions/yearly-transaction',
    { targetYear: year },
  );

  const yearSummary = data?.data?.yearSummary ?? [];
  const maxAbs = useMemo(() => Math.max(...yearSummary.map((m) => Math.abs(m.income - m.expense)), 1), [yearSummary]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <FlatList
        data={yearSummary}
        keyExtractor={(m) => String(m.month)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.accent} />}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        ListHeaderComponent={
          <View>
            <View style={styles.yearNav}>
              <TouchableOpacity onPress={() => setYear((y) => y - 1)} style={[styles.navBtn, { backgroundColor: C.surface2 }]}>
                <Text style={{ color: C.textSecondary, fontSize: 18 }}>‹</Text>
              </TouchableOpacity>
              <Text style={[text.h2, { color: C.text }]}>{year}</Text>
              <TouchableOpacity
                onPress={() => setYear((y) => y + 1)}
                disabled={year >= now.getFullYear()}
                style={[styles.navBtn, { backgroundColor: C.surface2, opacity: year >= now.getFullYear() ? 0.35 : 1 }]}
              >
                <Text style={{ color: C.textSecondary, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            </View>

            <SummaryPills
              pills={[
                { label: 'INCOME', value: `৳${fmt(data?.data?.totalIncome ?? 0)}`, color: C.income, bg: C.incomeBg },
                { label: 'EXPENSE', value: `৳${fmt(data?.data?.totalExpense ?? 0)}`, color: C.expense, bg: C.expenseBg },
                {
                  label: 'NET',
                  value: `৳${fmt((data?.data?.totalIncome ?? 0) - (data?.data?.totalExpense ?? 0))}`,
                  color: C.accent,
                  bg: C.accentDim,
                },
              ]}
            />
          </View>
        }
        renderItem={({ item: m }) => {
          const net = m.income - m.expense;
          const isPositive = net >= 0;
          const barColor = isPositive ? C.income : C.expense;
          const barWidth = (Math.abs(net) / maxAbs) * 100;
          const isCurrent = m.month === now.getMonth() && year === now.getFullYear();

          return (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/monthlyTransactions', params: { year, month: m.month + 1 } })}
              activeOpacity={0.7}
              style={[
                styles.monthCard,
                { backgroundColor: isCurrent ? C.surface : 'transparent', borderColor: isCurrent ? C.accentBorder : C.divider },
              ]}
            >
              {isCurrent ? (
                <>
                  <View style={styles.rowBetween}>
                    <Text style={[text.bodyMd, { color: C.text }]}>{MONTHS[m.month]}</Text>
                    <Text style={[text.amountXs, { color: barColor }]}>
                      {isPositive ? '+' : '−'}৳{fmt(net)}
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: C.divider }]}>
                    <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
                  </View>
                  <View style={[styles.rowBetween, { marginTop: 5 }]}>
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
                  <Text style={[text.amountXs, { color: barColor, width: 76, textAlign: 'right' }]}>
                    {isPositive ? '+' : '−'}৳{fmt(net)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.base },
  navBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  monthCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  barTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  barTrackSm: { height: 3, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  compactBarWrap: { flex: 1 },
});
