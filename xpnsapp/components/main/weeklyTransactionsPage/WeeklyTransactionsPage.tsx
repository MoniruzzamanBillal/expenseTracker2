import React, { useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, RefreshControl } from 'react-native';
import { useTheme, text, spacing } from '@/theme';
import { useFetchData } from '@/hooks/useApi';
import SummaryPills from '@/components/main/shared/SummaryPills';
import WeekDayRow from '@/components/main/shared/WeekDayRow';
import EmptyState from '@/components/main/shared/EmptyState';
import type { TDayBucket } from '@/types/Transaction.types';

type TData = { weekStart: string; weekEnd: string; income: number; expense: number; transactionData: TDayBucket[] };

const fmt = (n: number) => Math.abs(n).toLocaleString('en-IN');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDay = (dateStr: string) => new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function WeeklyTransactionsPage() {
  const C = useTheme();

  const { data, isLoading, refetch, isRefetching } = useFetchData<TData>(['weekly-transaction'], '/transactions/weekly-transaction');

  const buckets = data?.data?.transactionData ?? [];
  const todayStr = new Date().toISOString().slice(0, 10);

  const avgDaily = useMemo(() => (data ? (data.data.expense ?? 0) / 7 : 0), [data]);
  const maxAbs = useMemo(
    () => Math.max(...buckets.map((b) => Math.abs(b.income - b.expense)), 1),
    [buckets],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.accent} />}
      >
        {data?.data && (
          <View style={styles.weekHeader}>
            <Text style={[text.navTitle, { color: C.text }]}>
              {fmtDate(data.data.weekStart)} – {fmtDate(data.data.weekEnd)}
            </Text>
            <Text style={[text.caption, { color: C.textSecondary }]}>Fri – Thu</Text>
          </View>
        )}

        <SummaryPills
          pills={[
            { label: 'WEEK EXP', value: `৳${fmt(data?.data?.expense ?? 0)}`, color: C.expense, bg: C.expenseBg },
            { label: 'DAILY AVG', value: `৳${fmt(avgDaily)}`, color: C.textSecondary, bg: C.surface2 },
            { label: 'WEEK IN', value: `৳${fmt(data?.data?.income ?? 0)}`, color: C.income, bg: C.incomeBg },
          ]}
        />

        {!isLoading && buckets.length === 0 ? (
          <EmptyState title="No transactions this week" subtitle="Add one with the + button" />
        ) : (
          buckets.map((bucket) => (
            <WeekDayRow
              key={bucket.date}
              bucket={bucket}
              dayLabel={fmtDay(bucket.date)}
              isToday={bucket.date === todayStr}
              maxAbs={maxAbs}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  weekHeader: { marginBottom: spacing.base, gap: 3, alignItems: 'center' },
});
