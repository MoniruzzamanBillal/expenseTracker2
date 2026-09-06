import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, text, spacing, radius } from '../theme';
import type { Transaction } from '../lib/transactions';

interface Props {
  item: Transaction;
  onPress?: (item: Transaction) => void;
  onLongPress?: (item: Transaction) => void;
}

export function TransactionItem({ item, onPress, onLongPress }: Props) {
  const C = useTheme();
  const isIncome = item.type === 'income';
  const time = new Date(item.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return (
    <TouchableOpacity
      onPress={() => onPress?.(item)}
      onLongPress={() => onLongPress?.(item)}
      activeOpacity={0.7}
      style={[s.row, { borderBottomColor: C.divider }]}
    >
      <View style={[s.dot, { backgroundColor: isIncome ? C.incomeBg : C.expenseBg }]}>
        <Text style={{ fontSize: 16, color: isIncome ? C.income : C.expense }}>
          {isIncome ? '↑' : '↓'}
        </Text>
      </View>
      <View style={s.info}>
        <Text style={[text.bodyMd, { color: C.text }]} numberOfLines={1}>{item.title}</Text>
        {item.description ? (
          <Text style={[text.caption, { color: C.textSecondary, marginTop: 1 }]} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        <Text style={[text.caption, { color: C.textMuted, marginTop: 1 }]}>{time}</Text>
      </View>
      <Text style={[text.amountSm, { color: isIncome ? C.income : C.expense }]}>
        {isIncome ? '+' : '−'}৳{Number(item.amount).toLocaleString('en-IN')}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, borderBottomWidth: 1 },
  dot: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
});
