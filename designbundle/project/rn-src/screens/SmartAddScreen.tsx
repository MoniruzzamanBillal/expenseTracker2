import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, SafeAreaView,
  StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme, text, spacing, radius } from '../theme';
import { parseTransactions, saveManyTransactions } from '../lib/transactions';
import { PrimaryButton } from '../components/PrimaryButton';
import type { Transaction } from '../lib/transactions';

type Draft = Omit<Transaction, '_id' | 'createdAt' | 'updatedAt' | 'userId'>;

export function SmartAddScreen() {
  const C  = useTheme();
  const qc = useQueryClient();

  const [prompt,  setPrompt]  = useState('');
  const [drafts,  setDrafts]  = useState<Draft[] | null>(null);

  const parseMutation = useMutation({
    mutationFn: parseTransactions,
    onSuccess:  data => setDrafts(data),
    onError:    (e: any) => Alert.alert('Parse failed', e?.response?.data?.message ?? 'Try rephrasing'),
  });

  const saveMutation = useMutation({
    mutationFn: saveManyTransactions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      setPrompt('');
      setDrafts(null);
    },
    onError: (e: any) => Alert.alert('Save failed', e?.response?.data?.message),
  });

  const updateDraft = (i: number, key: keyof Draft, value: string | number) => {
    setDrafts(prev => prev ? prev.map((d, idx) => idx === i ? { ...d, [key]: value } : d) : prev);
  };

  const removeDraft = (i: number) => {
    setDrafts(prev => prev ? prev.filter((_, idx) => idx !== i) : prev);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingHorizontal: spacing.screenPad }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.heading}>
          <Text style={[text.h3, { color: C.text }]}>Smart Add</Text>
          <View style={[s.aiBadge, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}>
            <Text style={[text.label, { color: C.accent }]}>AI</Text>
          </View>
        </View>
        <Text style={[text.body, { color: C.textSecondary, marginBottom: spacing.xl }]}>
          Describe one or more transactions in plain language
        </Text>

        {/* Prompt input */}
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          multiline
          style={[s.textarea, { backgroundColor: C.inputBg, borderColor: C.accentBorder, color: C.text }, text.body]}
          placeholder='"bought groceries for 850 taka and got 5000 taka salary"'
          placeholderTextColor={C.placeholder}
        />

        <PrimaryButton
          label="Parse with AI"
          onPress={() => prompt.trim() && parseMutation.mutate(prompt)}
          loading={parseMutation.isPending}
          disabled={!prompt.trim()}
          style={{ marginBottom: spacing.xl }}
        />

        {/* Editable parsed results */}
        {drafts !== null && (
          <View>
            <View style={s.resultsHeader}>
              <Text style={[text.label, { color: C.textSecondary }]}>PARSED RESULTS</Text>
              <View style={[s.countBadge, { backgroundColor: C.accentDim }]}>
                <Text style={[text.label, { color: C.accent }]}>{drafts.length} found</Text>
              </View>
            </View>

            {drafts.length === 0 && (
              <Text style={[text.body, { color: C.textSecondary, textAlign: 'center', marginBottom: spacing.xl }]}>
                Couldn't parse any transactions — try rephrasing.
              </Text>
            )}

            {drafts.map((draft, i) => {
              const isIncome   = draft.type === 'income';
              const typeColor  = isIncome ? C.income  : C.expense;
              const typeBorder = isIncome ? 'rgba(82,212,138,0.2)' : 'rgba(240,114,114,0.2)';
              return (
                <View key={i} style={[s.draftCard, { backgroundColor: C.surface, borderColor: typeBorder }]}>
                  {/* Type row */}
                  <View style={s.draftTypeRow}>
                    <TouchableOpacity
                      onPress={() => updateDraft(i, 'type', isIncome ? 'expense' : 'income')}
                      style={[s.typeChip, { backgroundColor: isIncome ? C.incomeBg : C.expenseBg, borderColor: typeColor }]}
                    >
                      <Text style={[text.label, { color: typeColor }]}>
                        {isIncome ? '↑ INCOME' : '↓ EXPENSE'} (tap to flip)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeDraft(i)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <Text style={{ color: C.textMuted, fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Editable title */}
                  <TextInput
                    value={draft.title}
                    onChangeText={v => updateDraft(i, 'title', v)}
                    style={[s.draftInput, text.bodyMd, { color: C.text, borderBottomColor: C.divider }]}
                  />
                  {/* Editable amount */}
                  <View style={s.draftAmountRow}>
                    <Text style={[text.caption, { color: C.textSecondary }]}>৳</Text>
                    <TextInput
                      value={String(draft.amount)}
                      onChangeText={v => updateDraft(i, 'amount', parseFloat(v.replace(/[^0-9.]/g, '')) || 0)}
                      keyboardType="decimal-pad"
                      style={[text.h3, { color: typeColor, flex: 1 }]}
                    />
                  </View>
                  {/* Optional description */}
                  <TextInput
                    value={draft.description ?? ''}
                    onChangeText={v => updateDraft(i, 'description', v)}
                    placeholder="Add note…"
                    placeholderTextColor={C.placeholder}
                    style={[text.caption, { color: C.textSecondary, marginTop: 4 }]}
                  />
                </View>
              );
            })}

            {drafts.length > 0 && (
              <PrimaryButton
                label={`Save ${drafts.length} Transaction${drafts.length > 1 ? 's' : ''}`}
                onPress={() => saveMutation.mutate(drafts.map(d => ({
                  type:        d.type,
                  title:       d.title,
                  amount:      d.amount,
                  description: d.description ?? undefined,
                })))}
                loading={saveMutation.isPending}
                style={{ marginTop: spacing.md }}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1 },
  content:       { flexGrow: 1, paddingTop: spacing.lg, paddingBottom: 40 },
  heading:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  aiBadge:       { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  textarea:      { borderWidth: 1, borderRadius: radius.lg, padding: spacing.base, minHeight: 100, marginBottom: spacing.lg, textAlignVertical: 'top' },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  countBadge:    { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  draftCard:     { borderWidth: 1, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.sm, gap: 10 },
  draftTypeRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeChip:      { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  draftInput:    { borderBottomWidth: 1, paddingVertical: 6, fontSize: 15 },
  draftAmountRow:{ flexDirection: 'row', alignItems: 'baseline', gap: 4 },
});
