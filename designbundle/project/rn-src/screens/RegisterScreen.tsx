import React, { useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView,
  Platform, SafeAreaView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme, text, spacing, radius } from '../theme';
import { register } from '../lib/auth';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';

export function RegisterScreen() {
  const C = useTheme();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())         e.name     = 'Name is required';
    if (!email.trim())        e.email    = 'Email is required';
    if (password.length < 8)  e.password = 'Min. 8 characters';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/(app)');
    } catch (e: any) {
      setErrors({ general: e?.response?.data?.message ?? 'Registration failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[s.content, { paddingHorizontal: spacing.screenPad }]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} style={[s.back, { backgroundColor: C.surface2 }]}>
            <Text style={{ color: C.textSecondary, fontSize: 18 }}>←</Text>
          </TouchableOpacity>

          <Text style={[text.h1, { color: C.text, marginBottom: spacing.xs }]}>Join xpns</Text>
          <Text style={[text.body, { color: C.textSecondary, marginBottom: spacing.xxl }]}>
            Start tracking in seconds
          </Text>

          {errors.general ? (
            <View style={[s.errBanner, { backgroundColor: C.expenseBg, borderColor: C.expense }]}>
              <Text style={[text.caption, { color: C.expenseText }]}>{errors.general}</Text>
            </View>
          ) : null}

          <FormField label="Full Name" value={name} onChangeText={setName} error={errors.name} placeholder="Alex Rahman" autoCapitalize="words" />
          <FormField label="Email" value={email} onChangeText={setEmail} error={errors.email} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <FormField label="Password" value={password} onChangeText={setPassword} error={errors.password} placeholder="min. 8 characters" secureTextEntry passwordToggle />

          <PrimaryButton label="Create Account" onPress={handleRegister} loading={loading} disabled={!name || !email || !password} />

          <View style={s.footer}>
            <Text style={[text.bodySm, { color: C.textSecondary }]}>Already signed up? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[text.bodySm, { color: C.accent }]}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1 },
  content:  { flexGrow: 1, paddingTop: 24, paddingBottom: 40 },
  back:     { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  errBanner:{ borderWidth: 1, borderRadius: 8, padding: spacing.md, marginBottom: spacing.lg },
  footer:   { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
});
