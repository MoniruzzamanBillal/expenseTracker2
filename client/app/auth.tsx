import { useUserContext } from "@/context/user.context";
import { usePost } from "@/hooks/useApi";
import { COLORS } from "@/utils/colors";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import Toast from "react-native-toast-message";

export default function AuthScreen() {
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
      const payload = { email, password };

      const result = await loginMutation.mutateAsync({
        url: "/auth/login",
        payload,
      });

      // console.log("result = ", result);

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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ paddingVertical: 250 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        <View style={authStyles.wrapperContainer}>
          <Text
            style={{
              fontWeight: "600",
              fontSize: 30,
              color: COLORS.text,
              textAlign: "center",
              paddingVertical: 10,
            }}
          >
            Welcome Back
          </Text>

          {/* login form  */}
          <View style={authStyles.loginForm}>
            <TextInput
              placeholder="Enter Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setEmail}
              value={email || ""}
              textColor={COLORS.text}
              style={{
                borderWidth: 0,
                backgroundColor: "transparent",
                padding: 0,
              }}
            />
            <TextInput
              placeholder="Enter Password"
              secureTextEntry={true}
              onChangeText={setPassword}
              value={password || ""}
              textColor={COLORS.text}
              style={{
                borderWidth: 0,
                backgroundColor: "transparent",
                padding: 0,
              }}
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              disabled={loginMutation?.isPending}
              labelStyle={{ color: COLORS.text }}
            >
              {loginMutation?.isPending ? "Loggin in..." : "Login"}
            </Button>

            <View style={{ flexDirection: "row", marginTop: 10 }}>
              <Text style={{ color: COLORS.text }}>
                {" "}
                {"Don't Have any account ?"}{" "}
              </Text>

              <Pressable onPress={() => router.replace("/register")}>
                <Text
                  style={{ color: "blue", textDecorationLine: "underline" }}
                >
                  Sign Up{" "}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const authStyles = StyleSheet.create({
  wrapperContainer: {
    width: "90%",
    alignSelf: "center",
    backgroundColor: "#f3f4f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 8,
  },

  loginForm: {
    marginTop: 20,
    flexDirection: "column",
    rowGap: 12,
  },

  //
});
