import React, { useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, text, spacing } from '@/theme';
import { useFetchData } from '@/hooks/useApi';
import { useUserContext } from '@/context/user.context';
import TotalBalanceCard from '@/components/main/shared/TotalBalanceCard';
import DaySection from '@/components/main/shared/DaySection';
import TransactionCardSkeleton from '@/components/main/shared/TransactionCardSkeleton';
import EmptyState from '@/components/main/shared/EmptyState';
import type { TTransaction } from '@/types/Transaction.types';

type TData = { income: number; expense: number; transactions: TTransaction[] };

export default function HomePage() {
  const C = useTheme();
  const { user, logoutFunction } = useUserContext();

  const { data, isLoading, refetch, isRefetching } = useFetchData<TData>(
    ['daily-transaction'],
    '/transactions/daily-transaction',
  );

  const transactions = data?.data?.transactions ?? [];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const initial = (user?.name?.trim()?.[0] ?? '?').toUpperCase();

  const handleAvatarPress = () => {
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logoutFunction },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.accent} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[text.caption, { color: C.textSecondary, marginBottom: 2 }]}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[text.h3, { color: C.text }]}>
              {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
            <LinearGradient colors={['#9184d9', '#5d4fc7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Text style={[text.h3, { color: '#fff' }]}>{initial}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TotalBalanceCard income={data?.data?.income ?? 0} expense={data?.data?.expense ?? 0} label="Today's Balance" />

        {isLoading ? (
          <TransactionCardSkeleton />
        ) : transactions.length > 0 ? (
          <DaySection label="Today" variant="section" transactions={transactions} />
        ) : (
          <EmptyState title="No transactions today" subtitle="Tap + to add your first one" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  avatar: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
