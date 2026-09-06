import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, SafeAreaView, StyleSheet,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme, text, spacing, radius } from '../theme';
import { fetchWeekly, deleteTransaction } from '../lib/transactions';
import { DayBucketSection } from '../components/DayBucketSection';
import { EmptyState } from '../components/EmptyState';
import type { Transaction } from '../lib/transactions';

export function WeeklyScreen() {
  const C  = useTheme();
  const qc = useQueryClient();

  // API owns week boundaries (Friday–Thursday) — just fetch
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', 'weekly'],
    queryFn:  fetchWeekly,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['transactions', 'weekly'] }),
  });

  const handleLongPress = (item: Transaction) => {
    Alert.alert('Delete transaction?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item._id) },
    ]);
  };

  const avgDaily = useMemo(() => {
    if (!data) return 0;
    return Math.round(data.expense / 7);
  }, [data]);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingHorizontal: spacing.screenPad }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.accent} />}
      >
        {/* Week header (read-only — server controls the window) */}
        {data && (
          <View style={s.weekHeader}>
            <Text style={[text.h3, { color: C.text }]}>
              {fmt(data.weekStart)} – {fmt(data.weekEnd)}
            </Text>
            <Text style={[text.caption, { color: C.textSecondary }]}>Fri – Thu</Text>
          </View>
        )}
        {/* Stats */}
        <View style={s.stats}>
          <View style={[s.stat, { backgroundColor: C.expenseBg }]}>
            <Text style={[text.label, { color: C.expense, marginBottom: 3 }]}>WEEK EXP</Text>
            <Text style={[text.amountSm, { color: C.text }]}>৳{(data?.expense ?? 0).toLocaleString('en-IN')}</Text>
          </View>
          <View style={[s.stat, { backgroundColor: C.surface2 }]}>
            <Text style={[text.label, { color: C.textSecondary, marginBottom: 3 }]}>DAILY AVG</Text>
            <Text style={[text.amountSm, { color: C.text }]}>৳{avgDaily.toLocaleString('en-IN')}</Text>
          </View>
          <View style={[s.stat, { backgroundColor: C.incomeBg }]}>
            <Text style={[text.label, { color: C.income, marginBottom: 3 }]}>WEEK IN</Text>
            <Text style={[text.amountSm, { color: C.text }]}>৳{(data?.income ?? 0).toLocaleString('en-IN')}</Text>
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
          <EmptyState title="No transactions this week" subtitle="Add one with the + button" />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1 },
  content:    { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  weekHeader: { marginBottom: spacing.lg, gap: 3 },
  stats:      { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  stat:       { flex: 1, borderRadius: radius.md, padding: spacing.md },
});
