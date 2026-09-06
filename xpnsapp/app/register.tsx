import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme, text, spacing } from '@/theme';
import { usePost } from '@/hooks/useApi';
import { useUserContext } from '@/context/user.context';
import FormField from '@/components/main/shared/FormField';
import PrimaryButton from '@/components/main/shared/PrimaryButton';

export default function RegisterScreen() {
  const C = useTheme();
  const { handleSetUser, handleSetToken } = useUserContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const registerMutation = usePost();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    if (password.length < 8) e.password = 'Min. 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    try {
      const result = await registerMutation.mutateAsync({
        url: '/auth/register',
        payload: { name: name.trim(), email: email.trim(), password },
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
          <TouchableOpacity onPress={() => router.back()} style={[styles.back, { backgroundColor: C.surface2 }]}>
            <Text style={{ color: C.textSecondary, fontSize: 18 }}>←</Text>
          </TouchableOpacity>

          <Text style={[text.h1, { color: C.text, marginBottom: spacing.xs }]}>Join xpns</Text>
          <Text style={[text.body, { color: C.textSecondary, marginBottom: spacing.xxl }]}>
            Start tracking in seconds
          </Text>

          <FormField label="Full Name" value={name} onChangeText={setName} error={errors.name} placeholder="Alex Rahman" autoCapitalize="words" />
          <FormField label="Email" value={email} onChangeText={setEmail} error={errors.email} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <FormField label="Password" value={password} onChangeText={setPassword} error={errors.password} placeholder="min. 8 characters" secureTextEntry passwordToggle />

          <PrimaryButton label="Create Account" onPress={handleRegister} loading={registerMutation.isPending} disabled={!name || !email || !password} />

          <View style={styles.footer}>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 24, paddingBottom: 40 },
  back: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
});
