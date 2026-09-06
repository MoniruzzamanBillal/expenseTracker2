import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, SafeAreaView, StyleSheet,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme, text, spacing, radius, shadows } from '../theme';
import { fetchDaily, deleteTransaction } from '../lib/transactions';
import { DayBucketSection } from '../components/DayBucketSection';
import { EmptyState } from '../components/EmptyState';
import type { Transaction } from '../lib/transactions';

export function HomeScreen() {
  const C  = useTheme();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', 'daily'],
    queryFn:  fetchDaily,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['transactions', 'daily'] }),
  });

  const balance   = (data?.income ?? 0) - (data?.expense ?? 0);

  // Wrap the flat list into a single DayBucket for today
  const todayBucket = useMemo(() => {
    if (!data) return null;
    const today = new Date().toISOString().slice(0, 10);
    return { date: today, income: data.income, expense: data.expense, transactions: data.transactions };
  }, [data]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const handleLongPress = (item: Transaction) => {
    Alert.alert('Delete transaction?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item._id) },
    ]);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingHorizontal: spacing.screenPad }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.accent} />}
      >
        {/* Greeting */}
        <View style={s.header}>
          <View>
            <Text style={[text.caption, { color: C.textSecondary, marginBottom: 2 }]}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[text.h3, { color: C.text }]}>{greeting} 👋</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/profile')}
            style={[s.avatar, { backgroundColor: C.accentDim }]}
          >
            <Text style={[text.h3, { color: C.accent }]}>A</Text>
          </TouchableOpacity>
        </View>

        {/* Balance card */}
        <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, shadows.md]}>
          <Text style={[text.label, { color: C.textSecondary, marginBottom: spacing.sm }]}>TODAY'S BALANCE</Text>
          <Text style={[text.balance, { color: balance >= 0 ? C.text : C.expense, marginBottom: spacing.lg }]}>
            ৳{Math.abs(balance).toLocaleString('en-IN')}
          </Text>
          <View style={s.pills}>
            <View style={[s.pill, { backgroundColor: C.incomeBg }]}>
              <Text style={[text.label, { color: C.income, marginBottom: spacing.xs }]}>↑ INCOME</Text>
              <Text style={[text.amountSm, { color: C.text }]}>৳{(data?.income ?? 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={[s.pill, { backgroundColor: C.expenseBg }]}>
              <Text style={[text.label, { color: C.expense, marginBottom: spacing.xs }]}>↓ EXPENSES</Text>
              <Text style={[text.amountSm, { color: C.text }]}>৳{(data?.expense ?? 0).toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        {/* Transactions bucket */}
        {todayBucket && todayBucket.transactions.length > 0 ? (
          <DayBucketSection
            bucket={todayBucket}
            overrideLabel="Today"
            onPressItem={t => router.push({ pathname: '/(app)/transaction/[id]', params: { id: t._id } })}
            onLongPressItem={handleLongPress}
          />
        ) : !isLoading ? (
          <EmptyState title="No transactions today" subtitle="Tap + to add your first one" />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1 },
  content:{ paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  avatar: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  card:   { borderRadius: radius.xl, borderWidth: 1, padding: spacing.xl, marginBottom: spacing.xl },
  pills:  { flexDirection: 'row', gap: spacing.md },
  pill:   { flex: 1, borderRadius: radius.md, padding: spacing.md },
});
