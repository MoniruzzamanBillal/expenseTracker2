/**
 * Two-level section: date header with income/expense subtotals,
 * then the transactions nested under it.
 * Used by Home, Monthly, and Weekly screens.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, text, spacing, radius } from '../theme';
import { TransactionItem } from './TransactionItem';
import type { DayBucket } from '../lib/transactions';
import type { Transaction } from '../lib/transactions';

interface Props {
  bucket: DayBucket;
  /** Label to show instead of the date string (e.g. "Today") */
  overrideLabel?: string;
  onPressItem?: (item: Transaction) => void;
  onLongPressItem?: (item: Transaction) => void;
}

export function DayBucketSection({ bucket, overrideLabel, onPressItem, onLongPressItem }: Props) {
  const C = useTheme();
  const label = overrideLabel ?? formatDate(bucket.date);
  const net = bucket.income - bucket.expense;

  return (
    <View style={s.section}>
      {/* Bucket header */}
      <View style={[s.header, { backgroundColor: C.surface2, borderColor: C.border }]}>
        <Text style={[text.label, { color: C.textSecondary, flex: 1 }]}>
          {label.toUpperCase()}
        </Text>
        <View style={s.subtotals}>
          {bucket.income > 0 && (
            <Text style={[text.caption, { color: C.income }]}>
              +৳{Number(bucket.income).toLocaleString('en-IN')}
            </Text>
          )}
          {bucket.expense > 0 && (
            <Text style={[text.caption, { color: C.expense }]}>
              −৳{Number(bucket.expense).toLocaleString('en-IN')}
            </Text>
          )}
          {net !== 0 && (
            <Text style={[text.caption, { color: net > 0 ? C.income : C.expense, fontWeight: '600' }]}>
              {net > 0 ? '+' : '−'}৳{Math.abs(net).toLocaleString('en-IN')}
            </Text>
          )}
        </View>
      </View>
      {/* Nested transactions */}
      <View style={[s.transactions, { backgroundColor: C.surface, borderColor: C.border }]}>
        {bucket.transactions.map((t, i) => (
          <TransactionItem
            key={t._id}
            item={t}
            onPress={onPressItem}
            onLongPress={onLongPressItem}
          />
        ))}
      </View>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const s = StyleSheet.create({
  section:      { marginBottom: 8 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 2 },
  subtotals:    { flexDirection: 'row', gap: 10 },
  transactions: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, overflow: 'hidden' },
});
