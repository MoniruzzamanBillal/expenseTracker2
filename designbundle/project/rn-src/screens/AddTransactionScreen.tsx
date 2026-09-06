import React, { useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView,
  Platform, SafeAreaView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme, text, spacing, radius } from '../theme';
import { createTransaction } from '../lib/transactions';
import { TypeToggle } from '../components/TypeToggle';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';

export function AddTransactionScreen() {
  const C   = useTheme();
  const qc  = useQueryClient();

  const [type,        setType]        = useState<'income' | 'expense'>('expense');
  const [title,       setTitle]       = useState('');
  const [amount,      setAmount]      = useState('');
  const [description, setDescription] = useState('');
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const accentColor = type === 'income' ? C.income : C.expense;

  const { mutate, isPending } = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      router.back();
    },
    onError: (e: any) => setErrors({ general: e?.response?.data?.message ?? 'Failed to save' }),
  });

  const handleSave = () => {
    const e: Record<string, string> = {};
    if (!title.trim())                    e.title  = 'Title is required';
    if (!amount || isNaN(+amount) || +amount <= 0) e.amount = 'Enter a valid amount';
    setErrors(e);
    if (Object.keys(e).length) return;
    mutate({ type, title: title.trim(), amount: parseFloat(amount), description: description.trim() || undefined });
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[s.content, { paddingHorizontal: spacing.screenPad }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.nav}>
            <Text style={[text.h3, { color: C.text }]}>Add Transaction</Text>
            <TouchableOpacity onPress={() => router.back()} style={[s.closeBtn, { backgroundColor: C.surface2 }]}>
              <Text style={{ color: C.textSecondary, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <TypeToggle value={type} onChange={setType} />

          {/* Big amount field */}
          <View style={[s.amountBlock, { borderBottomColor: accentColor }]}>
            <Text style={[text.label, { color: C.textSecondary, textAlign: 'center', marginBottom: spacing.md }]}>
              AMOUNT (BDT)
            </Text>
            <FormField
              label=""
              value={amount}
              onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              error={errors.amount}
              inputStyle={{ fontSize: 40, textAlign: 'center', color: accentColor, fontWeight: '600', height: 64 }}
            />
          </View>

          {errors.general ? (
            <View style={[s.errBanner, { backgroundColor: C.expenseBg, borderColor: C.expense }]}>
              <Text style={[text.caption, { color: C.expenseText }]}>{errors.general}</Text>
            </View>
          ) : null}

          <FormField label="Title" value={title} onChangeText={setTitle} error={errors.title} placeholder="e.g. Groceries" />
          <FormField label="Description" value={description} onChangeText={setDescription} placeholder="Optional note…" multiline inputStyle={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }} />

          <PrimaryButton label="Save Transaction" onPress={handleSave} loading={isPending} disabled={!title || !amount} color={accentColor} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1 },
  content:      { flexGrow: 1, paddingTop: spacing.lg, paddingBottom: 40 },
  nav:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  closeBtn:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  amountBlock:  { borderBottomWidth: 2, marginBottom: spacing.xl, paddingBottom: spacing.md },
  errBanner:    { borderWidth: 1, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md },
});
