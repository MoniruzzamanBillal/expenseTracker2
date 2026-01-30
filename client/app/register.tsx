import { useRouter } from "expo-router";
import { useState } from "react";

import { usePost } from "@/hooks/useApi";
import { COLORS } from "@/utils/colors";
import { Image } from "expo-image";
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

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  const registerMutation = usePost([["register"]]);

  const handleRegistration = async () => {
    if (!email?.trim() || !password?.trim() || !name?.trim()) {
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView style={registerStyles.mainContainer}>
          <ScrollView style={registerStyles.wrapperContainer}>
            {/* image  */}
            <Image
              source={require("@/assets/images/revenue-i1.png")}
              style={registerStyles.imageStyle}
            />

            <Text
              style={{
                fontWeight: "600",
                fontSize: 30,
                color: COLORS.text,
                textAlign: "center",
                paddingVertical: 10,
              }}
            >
              Create Account
            </Text>

            {/* login form  */}
            <View style={registerStyles.registerForm}>
              <TextInput
                placeholder="Enter Name"
                autoCorrect={false}
                onChangeText={setName}
                value={name || ""}
              />

              <TextInput
                placeholder="Enter Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setEmail}
                value={email || ""}
              />
              <TextInput
                placeholder="Enter Password"
                secureTextEntry={true}
                onChangeText={setPassword}
                value={password || ""}
              />
              <Button
                mode="contained"
                onPress={handleRegistration}
                disabled={registerMutation?.isPending}
              >
                {registerMutation?.isPending ? "Registering..." : "Register"}
              </Button>

              <View style={{ flexDirection: "row", marginTop: 10 }}>
                <Text>Already have any account ? </Text>

                <Pressable onPress={() => router.replace("/auth")}>
                  <Text
                    style={{ color: "blue", textDecorationLine: "underline" }}
                  >
                    Log in
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

//
const registerStyles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    justifyContent: "center",
  },

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

  imageStyle: {
    height: 300,
    width: 300,
    marginVertical: 5,
  },

  registerForm: {
    marginTop: 20,
    flexDirection: "column",
    rowGap: 12,
  },

  //
});
