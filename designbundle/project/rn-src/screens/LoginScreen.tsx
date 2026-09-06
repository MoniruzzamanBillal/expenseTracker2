import React, { useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView,
  Platform, SafeAreaView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme, text, spacing, radius } from '../theme';
import { login } from '../lib/auth';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';

export function LoginScreen() {
  const C = useTheme();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      router.replace('/(app)');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Login failed. Check your credentials.');
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
          <View style={s.wordmark}>
            <View style={[s.logo, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}>
              <Text style={[text.h3, { color: C.accent }]}>₹</Text>
            </View>
            <Text style={[text.h2, { color: C.text }]}>xpns</Text>
          </View>

          <Text style={[text.h1, { color: C.text, marginBottom: spacing.xs }]}>Welcome back</Text>
          <Text style={[text.body, { color: C.textSecondary, marginBottom: spacing.xxl }]}>
            Sign in to continue tracking
          </Text>

          {error ? (
            <View style={[s.errBanner, { backgroundColor: C.expenseBg, borderColor: C.expense }]}>
              <Text style={[text.caption, { color: C.expenseText }]}>{error}</Text>
            </View>
          ) : null}

          <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="you@example.com" />
          <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry passwordToggle placeholder="••••••••" />

          <PrimaryButton label="Sign In" onPress={handleLogin} loading={loading} disabled={!email || !password} style={{ marginBottom: spacing.lg }} />

          <View style={s.footer}>
            <Text style={[text.bodySm, { color: C.textSecondary }]}>No account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={[text.bodySm, { color: C.accent }]}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1 },
  content:  { flexGrow: 1, paddingTop: 60, paddingBottom: 40 },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 48 },
  logo:     { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  errBanner:{ borderWidth: 1, borderRadius: 8, padding: spacing.md, marginBottom: spacing.lg },
  footer:   { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
});
