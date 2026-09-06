import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, SafeAreaView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme, text, spacing, radius } from '../theme';
import { fetchYearly } from '../lib/transactions';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function HistoryScreen() {
  const C = useTheme();
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', 'yearly', year],
    queryFn:  () => fetchYearly(year),
  });

  const yearSummary = data?.yearSummary ?? [];
  const maxAbs = useMemo(
    () => Math.max(...yearSummary.map(m => Math.abs(m.income - m.expense)), 1),
    [yearSummary]
  );

  const now = new Date();

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.background }]}>
      <FlatList
        data={yearSummary}
        keyExtractor={m => String(m.month)}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.accent} />}
        contentContainerStyle={[s.content, { paddingHorizontal: spacing.screenPad }]}
        ListHeaderComponent={
          <View>
            {/* Year nav */}
            <View style={s.yearNav}>
              <TouchableOpacity onPress={() => setYear(y => y - 1)} style={[s.navBtn, { backgroundColor: C.surface2 }]}>
                <Text style={{ color: C.textSecondary, fontSize: 20 }}>‹</Text>
              </TouchableOpacity>
              <Text style={[text.h2, { color: C.text }]}>{year}</Text>
              <TouchableOpacity
                onPress={() => setYear(y => y + 1)}
                disabled={year >= now.getFullYear()}
                style={[s.navBtn, { backgroundColor: C.surface2, opacity: year >= now.getFullYear() ? 0.35 : 1 }]}
              >
                <Text style={{ color: C.textSecondary, fontSize: 20 }}>›</Text>
              </TouchableOpacity>
            </View>
            {/* Year totals */}
            <View style={s.totals}>
              <View style={[s.totalPill, { backgroundColor: C.incomeBg }]}>
                <Text style={[text.label, { color: C.income, marginBottom: 3 }]}>INCOME</Text>
                <Text style={[text.amountSm, { color: C.text }]}>৳{(data?.totalIncome ?? 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={[s.totalPill, { backgroundColor: C.expenseBg }]}>
                <Text style={[text.label, { color: C.expense, marginBottom: 3 }]}>EXPENSE</Text>
                <Text style={[text.amountSm, { color: C.text }]}>৳{(data?.totalExpense ?? 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={[s.totalPill, { backgroundColor: C.accentDim }]}>
                <Text style={[text.label, { color: C.accent, marginBottom: 3 }]}>NET</Text>
                <Text style={[text.amountSm, { color: C.text }]}>
                  ৳{((data?.totalIncome ?? 0) - (data?.totalExpense ?? 0)).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item: m }) => {
          const net        = m.income - m.expense;
          const isPositive = net >= 0;
          const barWidth   = Math.abs(net) / maxAbs;
          // m.month is 0-indexed
          const isCurrent  = m.month === now.getMonth() && year === now.getFullYear();

          return (
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/(app)/history/monthly',
                // API uses targetMonth as 1-indexed based on the example "?targetMonth=8"
                params: { year, month: m.month + 1 },
              })}
              activeOpacity={0.7}
              style={[s.monthRow, {
                backgroundColor: isCurrent ? C.surface : 'rgba(255,255,255,0.02)',
                borderColor:     isCurrent ? C.accentBorder : C.border,
              }]}
            >
              <Text style={[text.bodyMd, { color: C.text, width: 36 }]}>{MONTHS[m.month]}</Text>
              <View style={s.barWrap}>
                <View style={{ height: 3, backgroundColor: C.divider, borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${barWidth * 100}%`, backgroundColor: isPositive ? C.income : C.expense, borderRadius: 2 }} />
                </View>
                <Text style={[text.caption, { color: C.textSecondary, marginTop: 3 }]}>
                  {m.transactionCount} tx
                </Text>
              </View>
              <Text style={[text.amountSm, { color: isPositive ? C.income : C.expense, width: 80, textAlign: 'right' }]}>
                {isPositive ? '+' : '−'}৳{Math.abs(net).toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1 },
  content:   { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  yearNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  navBtn:    { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  totals:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  totalPill: { flex: 1, borderRadius: radius.md, padding: spacing.md },
  monthRow:  { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.xs, gap: spacing.sm },
  barWrap:   { flex: 1 },
});
