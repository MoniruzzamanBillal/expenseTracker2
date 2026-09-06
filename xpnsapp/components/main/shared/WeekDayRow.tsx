import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, text, spacing, radius, fontFamily } from '@/theme';
import type { TDayBucket } from '@/types/Transaction.types';

type TProps = {
  bucket: TDayBucket;
  dayLabel: string; // e.g. "Tue, Sep 3"
  isToday: boolean;
  maxAbs: number;
};

const fmt = (n: number) => Math.abs(n).toLocaleString('en-IN');

export default function WeekDayRow({ bucket, dayLabel, isToday, maxAbs }: TProps) {
  const C = useTheme();
  const net = bucket.income - bucket.expense;
  const hasData = bucket.transactions.length > 0;
  const isPositive = net >= 0;
  const barColor = isPositive ? C.income : C.expense;
  const barWidth = hasData ? Math.max((Math.abs(net) / maxAbs) * 100, 6) : 0;

  const summary = bucket.transactions
    .slice(0, 2)
    .map((t) => `${t.title} ${t.type === 'income' ? '' : '−'}৳${fmt(t.amount)}`)
    .join(' · ');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isToday ? C.surface : hasData ? 'transparent' : 'transparent',
          borderColor: isToday ? C.accentBorder : C.divider,
          opacity: hasData || isToday ? 1 : 0.5,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[{ fontSize: 14, fontFamily: fontFamily.medium }, { color: hasData || isToday ? C.text : C.textMuted }]}>
          {dayLabel}
        </Text>
        {isToday ? (
          <View style={[styles.pill, { backgroundColor: C.accentDim }]}>
            <Text style={[text.caption, { color: C.accent }]}>Today</Text>
          </View>
        ) : hasData ? (
          <Text style={[text.amountXs, { color: barColor }]}>
            {isPositive ? '+' : '−'}৳{fmt(net)}
          </Text>
        ) : (
          <Text style={[text.caption, { color: C.textMuted }]}>—</Text>
        )}
      </View>

      {(hasData || isToday) && (
        <View style={styles.barRow}>
          <View style={[styles.barTrack, { backgroundColor: C.divider }]}>
            <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor, opacity: isToday ? 1 : 0.7 }]} />
          </View>
          {isToday && (
            <Text style={[text.amountXs, { color: barColor, width: 64, textAlign: 'right' }]}>
              {isPositive ? '+' : '−'}৳{fmt(net)}
            </Text>
          )}
        </View>
      )}

      {isToday && summary ? (
        <Text style={[text.caption, { color: C.textSecondary, marginTop: 4 }]} numberOfLines={1}>
          {summary}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, paddingHorizontal: 14, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
});
