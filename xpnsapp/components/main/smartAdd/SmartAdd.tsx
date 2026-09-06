import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme, text, spacing, radius } from '@/theme';
import { usePost } from '@/hooks/useApi';
import PrimaryButton from '@/components/main/shared/PrimaryButton';
import type { TDraftTransaction } from '@/types/Transaction.types';

const INVALIDATE_KEYS = [
  ['daily-transaction'],
  ['monthly-transaction'],
  ['weekly-transaction'],
  ['yearly-transaction'],
];

export default function SmartAddPage() {
  const C = useTheme();

  const [prompt, setPrompt] = useState('');
  const [drafts, setDrafts] = useState<TDraftTransaction[] | null>(null);

  const parseMutation = usePost();
  const saveMutation = usePost(INVALIDATE_KEYS);

  const handleParse = async () => {
    if (!prompt.trim()) return;
    try {
      const result = await parseMutation.mutateAsync({
        url: '/transactions/manage-money',
        payload: { prompt },
      });
      if (result?.success) setDrafts(result.data ?? []);
    } catch {
      // Surfaced via the axios interceptor's Toast.
    }
  };

  const updateDraft = (i: number, key: keyof TDraftTransaction, value: string | number) => {
    setDrafts((prev) => (prev ? prev.map((d, idx) => (idx === i ? { ...d, [key]: value } : d)) : prev));
  };

  const removeDraft = (i: number) => {
    setDrafts((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const handleSaveAll = async () => {
    if (!drafts?.length) return;
    try {
      const result = await saveMutation.mutateAsync({
        url: '/transactions/many-transaction',
        payload: drafts.map((d) => ({ type: d.type, title: d.title, amount: d.amount, description: d.description ?? undefined })),
      });
      if (result?.success) {
        setPrompt('');
        setDrafts(null);
        router.back();
      }
    } catch {
      // Surfaced via the axios interceptor's Toast.
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <Text style={[text.navTitle, { color: C.text }]}>Smart Add</Text>
          <View style={[styles.aiBadge, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}>
            <Text style={[text.label, { color: C.accent }]}>AI</Text>
          </View>
        </View>
        <Text style={[text.bodySm, { color: C.textSecondary, marginBottom: spacing.lg }]}>
          Describe transactions in plain text
        </Text>

        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          multiline
          style={[styles.textarea, { backgroundColor: C.inputBg, borderColor: C.accentBorder, color: C.text }, text.body]}
          placeholder="bought groceries for 850 taka and got 5000 taka salary"
          placeholderTextColor={C.placeholder}
        />

        <PrimaryButton
          label="✦ Parse with AI"
          onPress={handleParse}
          loading={parseMutation.isPending}
          disabled={!prompt.trim()}
          style={{ marginBottom: spacing.xl }}
        />

        {drafts !== null && (
          <View>
            <View style={styles.resultsHeader}>
              <Text style={[text.label, { color: C.textSecondary }]}>PARSED RESULTS</Text>
              <View style={[styles.countBadge, { backgroundColor: C.accentDim }]}>
                <Text style={[text.label, { color: C.accent }]}>{drafts.length} found</Text>
              </View>
            </View>

            {drafts.length === 0 && (
              <Text style={[text.body, { color: C.textSecondary, textAlign: 'center', marginBottom: spacing.xl }]}>
                Couldn't parse any transactions — try rephrasing.
              </Text>
            )}

            {drafts.map((draft, i) => {
              const isIncome = draft.type === 'income';
              const typeColor = isIncome ? C.income : C.expense;
              const typeBorder = isIncome ? 'rgba(82,212,138,0.2)' : 'rgba(240,114,114,0.2)';
              return (
                <View key={i} style={[styles.draftCard, { backgroundColor: C.surface, borderColor: typeBorder }]}>
                  <View style={styles.draftTypeRow}>
                    <View style={styles.draftTypeLeft}>
                      <View style={[styles.dot, { backgroundColor: typeColor }]} />
                      <TouchableOpacity onPress={() => updateDraft(i, 'type', isIncome ? 'expense' : 'income')}>
                        <Text style={[text.label, { color: typeColor }]}>{isIncome ? 'INCOME' : 'EXPENSE'}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeDraft(i)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <Text style={{ color: C.textMuted, fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={draft.title}
                    onChangeText={(v) => updateDraft(i, 'title', v)}
                    style={[styles.draftInput, text.bodyMd, { color: C.text, borderBottomColor: C.divider }]}
                  />
                  <View style={styles.draftAmountRow}>
                    <Text style={[text.caption, { color: C.textSecondary }]}>৳</Text>
                    <TextInput
                      value={String(draft.amount)}
                      onChangeText={(v) => updateDraft(i, 'amount', parseFloat(v.replace(/[^0-9.]/g, '')) || 0)}
                      keyboardType="decimal-pad"
                      style={[text.h3, { color: typeColor, flex: 1 }]}
                    />
                  </View>
                  <TextInput
                    value={draft.description ?? ''}
                    onChangeText={(v) => updateDraft(i, 'description', v)}
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
                onPress={handleSaveAll}
                loading={saveMutation.isPending}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: spacing.lg, paddingBottom: 40 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  aiBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  textarea: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.base, minHeight: 96, marginBottom: spacing.md, textAlignVertical: 'top' },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  countBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  draftCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.sm, gap: 10 },
  draftTypeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  draftTypeLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 999 },
  draftInput: { borderBottomWidth: 1, paddingVertical: 6, fontSize: 15 },
  draftAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
});
