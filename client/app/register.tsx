import { useRouter } from "expo-router";
import { useState } from "react";

import { usePost } from "@/hooks/useApi";
import FormField from "@/components/main/shared/FormField";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import { useTheme, text, spacing } from "@/theme";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

export default function RegisterScreen() {
  const C = useTheme();
  const router = useRouter();

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (!validate()) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        position: "top",
      });
      return;
    }

    try {
      const payload = { name, email, password };

      const result = await registerMutation.mutateAsync({
        url: "/auth/register",
        payload,
      });
      if (result?.success) {
        const successMessage = result?.message;

        Toast.show({
          type: "success",
          text1: successMessage,
          position: "top",
        });

        router.replace("/auth");
      }
    } catch (error) {
      console.log("error from register = ", error);
      Toast.show({
        type: "error",
        text1: "Something went wrong!!",
        position: "top",
      });
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
        <TouchableOpacity onPress={() => router.back()} style={[styles.back, { backgroundColor: C.surface2 }]}>
          <MaterialCommunityIcons name="arrow-left" size={18} color={C.textSecondary} />
        </TouchableOpacity>

        <Text style={[text.h1, { color: C.text, marginBottom: spacing.xs }]}>Create Account</Text>
        <Text style={[text.body, { color: C.textSecondary, marginBottom: spacing.xxl }]}>
          Start tracking in seconds
        </Text>

        <FormField
          label="Full Name"
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
        />

        <PrimaryButton
          label={registerMutation?.isPending ? "Registering..." : "Create Account"}
          onPress={handleRegistration}
          loading={registerMutation?.isPending}
          disabled={!name || !email || !password}
        />

        <View style={styles.footer}>
          <Text style={[text.bodySm, { color: C.textSecondary }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/auth")}>
            <Text style={[text.bodySm, { color: C.accent }]}>Log in</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 24, paddingBottom: 40 },
  back: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: spacing.xxl },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
});
