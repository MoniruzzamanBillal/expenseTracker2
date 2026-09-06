import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme, text, spacing, radius, fontFamily } from '@/theme';
import { usePatch } from '@/hooks/useApi';
import type { TTransaction } from '@/types/Transaction.types';

const INVALIDATE_KEYS = [
  ['daily-transaction'],
  ['monthly-transaction'],
  ['weekly-transaction'],
  ['yearly-transaction'],
];

type TProps = {
  transaction: TTransaction;
  /** Denser row used by Monthly (smaller icon/title, time-only meta). */
  compact?: boolean;
  /** Omit the bottom divider — pass true for the last row in a list/section. */
  isLast?: boolean;
};

export default function TransactionCard({ transaction, compact = false, isLast = false }: TProps) {
  const C = useTheme();
  const isIncome = transaction.type === 'income';

  const deleteMutation = usePatch(INVALIDATE_KEYS);

  const time = new Date(transaction.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const meta = compact ? time : transaction.description ? `${transaction.description} · ${time}` : time;

  const handleDelete = () => {
    Alert.alert('Delete transaction?', transaction.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteMutation.mutate({ url: `/transactions/delete-transaction/${transaction._id}` }),
      },
    ]);
  };

  const iconSize = compact ? 38 : 40;

  return (
    <TouchableOpacity
      onLongPress={handleDelete}
      activeOpacity={0.7}
      style={[
        styles.row,
        { paddingVertical: compact ? 12 : 13, borderBottomColor: C.divider, borderBottomWidth: isLast ? 0 : 1 },
      ]}
    >
      <View
        style={[
          styles.icon,
          { width: iconSize, height: iconSize, backgroundColor: isIncome ? C.incomeBg : C.expenseBg },
        ]}
      >
        <Text style={{ fontSize: compact ? 15 : 16, fontFamily: fontFamily.medium, color: isIncome ? C.income : C.expense }}>
          {isIncome ? '↑' : '↓'}
        </Text>
      </View>
      <View style={styles.info}>
        <Text
          style={[compact ? { fontSize: 14, fontFamily: fontFamily.medium } : text.bodyMd, { color: C.text }]}
          numberOfLines={1}
        >
          {transaction.title}
        </Text>
        <Text style={[text.caption, { color: C.textSecondary, marginTop: compact ? 1 : 2 }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text style={[compact ? text.amountXs : text.amountSm, { color: isIncome ? C.income : C.expense }]}>
        {isIncome ? '+' : '−'}৳{Number(transaction.amount).toLocaleString('en-IN')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
});
