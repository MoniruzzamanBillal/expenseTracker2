import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, SafeAreaView, StyleSheet,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme, text, spacing, radius } from '../theme';
import { fetchMonthly, deleteTransaction } from '../lib/transactions';
import { DayBucketSection } from '../components/DayBucketSection';
import { EmptyState } from '../components/EmptyState';
import type { Transaction } from '../lib/transactions';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

export function MonthlyScreen() {
  const C  = useTheme();
  const qc = useQueryClient();
  const { year: yearP, month: monthP } = useLocalSearchParams<{ year: string; month: string }>();
  // month here is 1-indexed from the History screen
  const month = Number(monthP) || (new Date().getMonth() + 1);
  const year  = Number(yearP)  || new Date().getFullYear();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', 'monthly', year, month],
    queryFn:  () => fetchMonthly(month),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['transactions', 'monthly', year, month] }),
  });

  const handleLongPress = (item: Transaction) => {
    Alert.alert('Delete transaction?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item._id) },
    ]);
  };

  const balance = (data?.income ?? 0) - (data?.expense ?? 0);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingHorizontal: spacing.screenPad }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.accent} />}
      >
        {/* Nav */}
        <View style={s.nav}>
          <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: C.surface2 }]}>
            <Text style={{ color: C.textSecondary, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={[text.h3, { color: C.text }]}>{MONTHS[month - 1]} {year}</Text>
        </View>
        {/* Summary */}
        <View style={s.summary}>
          <View style={[s.pill, { backgroundColor: C.incomeBg }]}>
            <Text style={[text.label, { color: C.income, marginBottom: 3 }]}>IN</Text>
            <Text style={[text.amountSm, { color: C.text }]}>৳{(data?.income ?? 0).toLocaleString('en-IN')}</Text>
          </View>
          <View style={[s.pill, { backgroundColor: C.expenseBg }]}>
            <Text style={[text.label, { color: C.expense, marginBottom: 3 }]}>EXP</Text>
            <Text style={[text.amountSm, { color: C.text }]}>৳{(data?.expense ?? 0).toLocaleString('en-IN')}</Text>
          </View>
          <View style={[s.pill, { backgroundColor: balance >= 0 ? C.incomeBg : C.expenseBg }]}>
            <Text style={[text.label, { color: balance >= 0 ? C.income : C.expense, marginBottom: 3 }]}>BAL</Text>
            <Text style={[text.amountSm, { color: C.text }]}>
              {balance >= 0 ? '+' : '−'}৳{Math.abs(balance).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
        {/* Two-level day buckets */}
        {(data?.transactionData ?? []).length > 0 ? (
          (data?.transactionData ?? []).map(bucket => (
            <DayBucketSection
              key={bucket.date}
              bucket={bucket}
              onPressItem={t => router.push({ pathname: '/(app)/transaction/[id]', params: { id: t._id } })}
              onLongPressItem={handleLongPress}
            />
          ))
        ) : !isLoading ? (
          <EmptyState title="No transactions this month" />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  nav:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  pill:    { flex: 1, borderRadius: radius.md, padding: spacing.md },
});
