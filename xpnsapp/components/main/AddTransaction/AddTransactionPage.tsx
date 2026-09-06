import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme, text, spacing, radius } from '@/theme';
import { usePost } from '@/hooks/useApi';
import { TransactionTypeConst, TTransactionType } from '@/constants/TransactionType.constant';
import TypeToggle from '@/components/main/shared/TypeToggle';
import FormField from '@/components/main/shared/FormField';
import PrimaryButton from '@/components/main/shared/PrimaryButton';

const INVALIDATE_KEYS = [
  ['daily-transaction'],
  ['monthly-transaction'],
  ['weekly-transaction'],
  ['yearly-transaction'],
];

export default function AddTransactionPage() {
  const C = useTheme();

  const [type, setType] = useState<TTransactionType>(TransactionTypeConst.expense);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accentColor = type === 'income' ? C.income : C.expense;
  const addTransactionMutation = usePost(INVALIDATE_KEYS);

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!amount || isNaN(+amount) || +amount <= 0) e.amount = 'Enter a valid amount';
    setErrors(e);
    if (Object.keys(e).length) return;

    try {
      const result = await addTransactionMutation.mutateAsync({
        url: '/transactions/new-transaction',
        payload: { type, title: title.trim(), amount: parseFloat(amount), description: description.trim() || undefined },
      });
      if (result?.success) router.back();
    } catch {
      // Surfaced via the axios interceptor's Toast.
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.nav}>
            <Text style={[text.navTitle, { color: C.text }]}>Add Transaction</Text>
            <TouchableOpacity onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: C.surface2 }]}>
              <Text style={{ color: C.textSecondary, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <TypeToggle value={type} onChange={setType} />

          <View style={[styles.amountBlock, { borderBottomColor: accentColor }]}>
            <Text style={[text.label, { color: C.textSecondary, textAlign: 'center', marginBottom: spacing.md }]}>
              AMOUNT (BDT)
            </Text>
            <FormField
              label=""
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              error={errors.amount}
              inputStyle={{ fontSize: 40, textAlign: 'center', color: accentColor, fontWeight: '600', height: 64 }}
            />
          </View>

          <FormField label="Title" value={title} onChangeText={setTitle} error={errors.title} placeholder="e.g. Groceries" />
          <FormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Add a note… (optional)"
            multiline
            inputStyle={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
          />

          <PrimaryButton
            label="Save Transaction"
            onPress={handleSave}
            loading={addTransactionMutation.isPending}
            disabled={!title || !amount}
            color={accentColor}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: spacing.lg, paddingBottom: 40 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  closeBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  amountBlock: { borderBottomWidth: 2, marginBottom: spacing.xl, paddingBottom: spacing.md },
});
