import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, text, spacing, fontFamily } from '@/theme';
import TransactionCard from './TransactionCard';
import type { TTransaction } from '@/types/Transaction.types';

type TProps = {
  label: string;
  /** 'section' = Home's uppercase "TODAY" label. 'day' = Monthly's plain per-day label ("Sep 3"). */
  variant?: 'section' | 'day';
  /** Small accent pill next to the label — used for "Today" in Monthly. */
  badge?: string;
  transactions: TTransaction[];
  compact?: boolean;
};

/** A day/section header (plain text, no box) followed by a flat, divider-separated
 * list of transactions — the visual pattern used by Home and Monthly. */
export default function DaySection({ label, variant = 'day', badge, transactions, compact = false }: TProps) {
  const C = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        {variant === 'section' ? (
          <Text style={[text.label, { color: C.textSecondary }]}>{label.toUpperCase()}</Text>
        ) : (
          <Text style={{ fontSize: 12, fontFamily: fontFamily.medium, color: C.textSecondary }}>{label}</Text>
        )}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: C.accentDim }]}>
            <Text style={{ fontSize: 10, fontFamily: fontFamily.medium, color: C.accent, letterSpacing: 0.3 }}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <View>
        {transactions.map((t, i) => (
          <TransactionCard key={t._id} transaction={t} compact={compact} isLast={i === transactions.length - 1} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.base },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  badge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
});
