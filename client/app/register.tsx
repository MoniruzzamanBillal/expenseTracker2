import { useRouter } from "expo-router";
import { useState } from "react";

import { usePost } from "@/hooks/useApi";
import FormField from "@/components/main/shared/FormField";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import { useTheme, text, spacing } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function RegisterScreen() {
  const C = useTheme();
  const router = useRouter();

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const registerMutation = usePost([["register"]]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name?.trim()) e.name = "Name is required";
    if (!email?.trim()) e.email = "Email is required";
    if (!password?.trim()) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegistration = async () => {
    setErrorMessage(null);
    if (!validate()) return;

    try {
      const payload = { name, email, password };

      const result = await registerMutation.mutateAsync({
        url: "/auth/register",
        payload,
      });
      if (result?.success) {
        Toast.show({ type: "success", text1: result?.message, position: "top" });
        router.replace("/auth");
      } else {
        setErrorMessage(result?.message ?? "Something went wrong. Please try again.");
      }
    } catch (error) {
      console.log("error from register = ", error);
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        bottomOffset={30}
        extraKeyboardSpace={10}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wordmark}>
          <View style={[styles.tick, { backgroundColor: C.accent }]} />
          <Text style={[text.kicker, { color: C.textSecondary }]}>ExpenseTracker</Text>
        </View>

        <Text style={[text.h1, { color: C.text, marginBottom: spacing.xxl }]}>Create account</Text>

        <FormField
          label="Name"
          value={name || ""}
          onChangeText={setName}
          error={errors.name}
          placeholder="Your name"
          autoCapitalize="words"
        />
        <FormField
          label="Email"
          value={email || ""}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormField
          label="Password"
          value={password || ""}
          onChangeText={setPassword}
          error={errors.password}
          placeholder="••••••••"
          secureTextEntry
          passwordToggle
          invalid={!!errorMessage}
        />

        {errorMessage ? (
          <View style={[styles.errorBanner, { backgroundColor: C.expenseBg }]}>
            <Ionicons name="alert-circle-outline" size={17} color={C.expense} />
            <Text style={[text.bodySm, { color: C.text, flex: 1 }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label={registerMutation?.isPending ? "Creating account…" : "Create account"}
          onPress={handleRegistration}
          loading={registerMutation?.isPending}
          disabled={!name || !email || !password}
          height={spacing.cta}
          style={{ marginTop: spacing.md }}
        />

        <View style={styles.footer}>
          <Text style={[text.bodySm, { color: C.textSecondary }]}>Have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/auth")}>
            <Text style={[text.bodySm, { color: C.accent }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: spacing.xxl, paddingBottom: 40 },
  wordmark: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  tick: { width: 18, height: 2, borderRadius: 1 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: 10, padding: spacing.md, marginTop: spacing.md },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
});
