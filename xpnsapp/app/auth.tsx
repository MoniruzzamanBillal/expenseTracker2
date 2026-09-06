import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme, text, spacing, radius } from '@/theme';
import { usePost } from '@/hooks/useApi';
import { useUserContext } from '@/context/user.context';
import FormField from '@/components/main/shared/FormField';
import PrimaryButton from '@/components/main/shared/PrimaryButton';

export default function AuthScreen() {
  const C = useTheme();
  const { handleSetUser, handleSetToken } = useUserContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = usePost();

  const handleLogin = async () => {
    try {
      const result = await loginMutation.mutateAsync({
        url: '/auth/login',
        payload: { email: email.trim(), password },
      });
      if (result?.success) {
        await handleSetToken(result.token ?? null);
        await handleSetUser(result.data);
        router.replace('/');
      }
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
          <View style={styles.wordmark}>
            <View style={[styles.logo, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}>
              <Text style={[text.h3, { color: C.accent }]}>৳</Text>
            </View>
            <Text style={[text.h2, { color: C.text }]}>xpns</Text>
          </View>

          <Text style={[text.h1, { color: C.text, marginBottom: spacing.xs }]}>Welcome back</Text>
          <Text style={[text.body, { color: C.textSecondary, marginBottom: spacing.xxl }]}>
            Sign in to continue tracking
          </Text>

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            passwordToggle
            placeholder="••••••••"
          />

          <Text style={[text.bodySm, { color: C.accentText, textAlign: 'right', marginBottom: spacing.xl }]}>
            Forgot password?
          </Text>

          <PrimaryButton
            label="Sign In"
            onPress={handleLogin}
            loading={loginMutation.isPending}
            disabled={!email || !password}
            style={{ marginBottom: spacing.lg }}
          />

          <View style={styles.footer}>
            <Text style={[text.bodySm, { color: C.textSecondary }]}>No account? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={[text.bodySm, { color: C.accent }]}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 60, paddingBottom: 40 },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 48 },
  logo: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
});
