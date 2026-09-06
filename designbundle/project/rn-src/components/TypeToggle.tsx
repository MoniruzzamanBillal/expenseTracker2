import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, text, spacing, radius } from '../theme';

interface Props {
  value: 'income' | 'expense';
  onChange: (v: 'income' | 'expense') => void;
}

export function TypeToggle({ value, onChange }: Props) {
  const C = useTheme();
  return (
    <View style={[s.track, { backgroundColor: C.surface2, borderColor: C.border }]}>
      {(['income', 'expense'] as const).map((type) => {
        const active      = value === type;
        const activeColor = type === 'income' ? C.income  : C.expense;
        const activeBg    = type === 'income' ? C.incomeBg : C.expenseBg;
        return (
          <TouchableOpacity
            key={type}
            onPress={() => onChange(type)}
            activeOpacity={0.8}
            style={[
              s.opt,
              { borderColor: active ? activeColor : 'transparent',
                backgroundColor: active ? activeBg : 'transparent' },
            ]}
          >
            <Text style={[text.bodyMd, { color: active ? activeColor : C.textSecondary }]}>
              {type === 'income' ? '↑ Income' : '↓ Expense'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  opt: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
});
