import { useUserContext } from "@/context/user.context";
import { usePost } from "@/hooks/useApi";
import { useTheme, text, spacing, radius } from "@/theme";
import FormField from "@/components/main/shared/FormField";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function AuthScreen() {
  const C = useTheme();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  const router = useRouter();

  const { handleSetUser, handleSetToken } = useUserContext();

  const loginMutation = usePost([["login"]]);

  const handleLogin = async () => {
    if (!email?.trim() || !password?.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please enter both email and password",
        position: "top",
      });
      return;
    }

    try {
      Keyboard.dismiss();
      const payload = { email, password };

      const result = await loginMutation.mutateAsync({
        url: "/auth/login",
        payload,
      });

      if (result?.success) {
        const successMessage = result?.message;

        const userData = result?.data;
        const token = result?.token;

        const userPayload = {
          _id: userData?._id,
          name: userData?.name,
          email: userData?.email,
        };

        handleSetToken(token);
        handleSetUser(userPayload);

        Toast.show({
          type: "success",
          text1: successMessage,
          position: "top",
        });
        router.replace("/");
      }
    } catch (error) {
      console.log("error = ", error);
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
        <View style={styles.wordmark}>
          <View style={[styles.logo, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}>
            <Text style={[text.h3, { color: C.accent }]}>৳</Text>
          </View>
          <Text style={[text.h2, { color: C.text }]}>ExpenseTracker</Text>
        </View>

        <Text style={[text.h1, { color: C.text, marginBottom: spacing.xs }]}>Welcome back</Text>
        <Text style={[text.body, { color: C.textSecondary, marginBottom: spacing.xxl }]}>
          Sign in to continue tracking
        </Text>

        <FormField
          label="Email"
          value={email || ""}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
        />
        <FormField
          label="Password"
          value={password || ""}
          onChangeText={setPassword}
          secureTextEntry
          passwordToggle
          placeholder="••••••••"
        />

        <Text style={[text.bodySm, { color: C.accentText, textAlign: "right", marginBottom: spacing.xl }]}>
          Forgot password?
        </Text>

        <PrimaryButton
          label={loginMutation?.isPending ? "Logging in..." : "Sign In"}
          onPress={handleLogin}
          loading={loginMutation?.isPending}
          disabled={!email || !password}
          style={{ marginBottom: spacing.lg }}
        />

        <View style={styles.footer}>
          <Text style={[text.bodySm, { color: C.textSecondary }]}>No account? </Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={[text.bodySm, { color: C.accent }]}>Create one</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 40, justifyContent: "center" },
  wordmark: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: 48 },
  logo: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
});
