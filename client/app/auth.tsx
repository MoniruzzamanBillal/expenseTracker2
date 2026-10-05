import { useUserContext } from "@/context/user.context";
import { usePost } from "@/hooks/useApi";
import { useTheme, text, spacing } from "@/theme";
import FormField from "@/components/main/shared/FormField";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function AuthScreen() {
  const C = useTheme();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const router = useRouter();

  const { handleSetUser, handleSetToken } = useUserContext();

  const loginMutation = usePost([["login"]]);

  const handleLogin = async () => {
    if (!email?.trim() || !password?.trim()) return;

    setErrorMessage(null);
    Keyboard.dismiss();

    try {
      const payload = { email, password };

      const result = await loginMutation?.mutateAsync({
        url: "/auth/login",
        payload,
      });

      if (result?.success) {
        const userData = result?.data;
        const token = result?.token;

        const userPayload = {
          _id: userData?._id,
          name: userData?.name,
          email: userData?.email,
          // Login is the only place this is available — loginFromDb returns the whole row,
          // while /auth/me's select omits userRole. Dropping it here is what made the admin
          // check impossible on the client before spec 36.
          userRole: userData?.userRole,
        };

        handleSetToken(token);
        handleSetUser(userPayload);

        Toast.show({ type: "success", text1: result?.message, position: "top" });
        router?.replace("/");
      } else {
        // Server error strings are shown verbatim, no rewording — see the
        // Auth build notes ("worth tidying those strings server-side").
        setErrorMessage(result?.message ?? "Something went wrong. Please try again.");
      }
    } catch (error) {
      console.log("error = ", error);
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C?.background }]}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        bottomOffset={30}
        extraKeyboardSpace={10}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wordmark}>
          <View style={[styles.tick, { backgroundColor: C?.accent }]} />
          <Text style={[text.kicker, { color: C?.textSecondary }]}>ExpenseTracker</Text>
        </View>

        <Text style={[text.h1, { color: C?.text, marginBottom: spacing.xxl }]}>Sign in</Text>

        <FormField
          label="Email"
          value={email || ""}
          onChangeText={(v) => {
            setEmail(v);
            setErrorMessage(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
        />
        <FormField
          label="Password"
          value={password || ""}
          onChangeText={(v) => {
            setPassword(v);
            setErrorMessage(null);
          }}
          secureTextEntry
          passwordToggle
          placeholder="••••••••"
          invalid={!!errorMessage}
        />

        {errorMessage ? (
          <View style={[styles.errorBanner, { backgroundColor: C?.expenseBg }]}>
            <Ionicons name="alert-circle-outline" size={17} color={C?.expense} />
            <Text style={[text.bodySm, { color: C?.text, flex: 1 }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label={loginMutation?.isPending ? "Signing in…" : "Sign in"}
          onPress={handleLogin}
          loading={loginMutation?.isPending}
          disabled={!email || !password}
          height={spacing.cta}
          style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        />

        <View style={styles.footer}>
          <Text style={[text.bodySm, { color: C?.textSecondary }]}>New here? </Text>
          <TouchableOpacity onPress={() => router?.push("/register")}>
            <Text style={[text.bodySm, { color: C?.accent }]}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 40, justifyContent: "flex-end" },
  wordmark: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  tick: { width: 18, height: 2, borderRadius: 1 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: 10, padding: spacing.md, marginTop: spacing.md },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
});
