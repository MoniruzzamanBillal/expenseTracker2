import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, text, spacing, radius, shadows } from '../theme';

interface Props {
  balance: number;
  income: number;
  expenses: number;
  label?: string;
}

export function BalanceCard({ balance, income, expenses, label = "Today's Balance" }: Props) {
  const C = useTheme();
  const isPositive = balance >= 0;

  return (
    <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, shadows.md]}>
      <Text style={[text.label, { color: C.textSecondary, marginBottom: spacing.sm }]}>
        {label.toUpperCase()}
      </Text>
      <Text style={[text.balance, { color: isPositive ? C.text : C.expense, marginBottom: spacing.lg }]}>
        ৳{Math.abs(balance).toLocaleString('en-IN')}
      </Text>
      <View style={s.pills}>
        <View style={[s.pill, { backgroundColor: C.incomeBg }]}>
          <Text style={[text.label, { color: C.income, marginBottom: spacing.xs }]}>↑ INCOME</Text>
          <Text style={[text.amountSm, { color: C.text }]}>৳{income.toLocaleString('en-IN')}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: C.expenseBg }]}>
          <Text style={[text.label, { color: C.expense, marginBottom: spacing.xs }]}>↓ EXPENSES</Text>
          <Text style={[text.amountSm, { color: C.text }]}>৳{expenses.toLocaleString('en-IN')}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  pills: { flexDirection: 'row', gap: spacing.md },
  pill:  { flex: 1, borderRadius: radius.md, padding: spacing.md },
});
