import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, text, spacing } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
}

export function EmptyState({ title, subtitle }: Props) {
  const C = useTheme();
  return (
    <View style={s.wrap}>
      <View style={[s.icon, { borderColor: C.border }]}>
        <Text style={{ fontSize: 28, color: C.textMuted }}>◎</Text>
      </View>
      <Text style={[text.bodyMd, { color: C.textSecondary, marginBottom: spacing.xs }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[text.caption, { color: C.textMuted, textAlign: 'center' }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  icon: {
    width: 56, height: 56,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.base,
  },
});
