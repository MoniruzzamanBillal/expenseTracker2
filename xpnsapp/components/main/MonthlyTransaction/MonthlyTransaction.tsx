import React from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme, text, spacing } from '@/theme';
import { useFetchData } from '@/hooks/useApi';
import SummaryPills from '@/components/main/shared/SummaryPills';
import DaySection from '@/components/main/shared/DaySection';
import EmptyState from '@/components/main/shared/EmptyState';
import TransactionCardSkeleton from '@/components/main/shared/TransactionCardSkeleton';
import type { TDayBucket } from '@/types/Transaction.types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type TData = { income: number; expense: number; transactionData: TDayBucket[] };

const fmt = (n: number) => Math.abs(n).toLocaleString('en-IN');

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MonthlyTransactionPage() {
  const C = useTheme();
  const { year: yearP, month: monthP } = useLocalSearchParams<{ year?: string; month?: string }>();
  const month = Number(monthP) || new Date().getMonth() + 1;
  const year = Number(yearP) || new Date().getFullYear();

  const { data, isLoading, refetch, isRefetching } = useFetchData<TData>(
    ['monthly-transaction', String(month)],
    '/transactions/monthly-transaction',
    { targetMonth: month },
  );

  const balance = (data?.data?.income ?? 0) - (data?.data?.expense ?? 0);
  const buckets = data?.data?.transactionData ?? [];
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.accent} />}
      >
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: C.surface2 }]}>
            <Text style={{ color: C.textSecondary, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={[text.navTitle, { color: C.text }]}>{MONTHS[month - 1]} {year}</Text>
        </View>

        <SummaryPills
          pills={[
            { label: 'IN', value: `৳${fmt(data?.data?.income ?? 0)}`, color: C.income, bg: C.incomeBg },
            { label: 'EXP', value: `৳${fmt(data?.data?.expense ?? 0)}`, color: C.expense, bg: C.expenseBg },
            { label: 'BAL', value: `${balance >= 0 ? '+' : '−'}৳${fmt(balance)}`, color: balance >= 0 ? C.income : C.expense, bg: balance >= 0 ? C.incomeBg : C.expenseBg },
          ]}
        />

        {isLoading ? (
          <TransactionCardSkeleton />
        ) : buckets.length > 0 ? (
          buckets.map((bucket) => (
            <DaySection
              key={bucket.date}
              label={formatDayLabel(bucket.date)}
              variant="day"
              badge={bucket.date === todayStr ? 'Today' : undefined}
              transactions={bucket.transactions}
              compact
            />
          ))
        ) : (
          <EmptyState title="No transactions this month" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
