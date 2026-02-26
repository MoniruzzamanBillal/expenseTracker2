import { usePost } from "@/hooks/useApi";
import { COLORS } from "@/utils/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button, Text, TextInput } from "react-native-paper";
import Toast from "react-native-toast-message";

export const transactionConstants = {
  income: "income",
  expense: "expense",
} as const;

export type TTransactionType = "income" | "expense";

export default function AddTransactionScreen() {
  const router = useRouter();

  const [type, setType] = useState<TTransactionType>(
    transactionConstants?.income,
  );

  const [amount, setAmount] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  const addTransactionMutation = usePost([
    ["daily-transaction"],
    ["monthly-transaction"],
    ["monthly-transaction-legacy"],
    ["yearly-transaction"],
  ]);

  // * for handling the number input
  const handleTextChange = (text: string) => {
    const regex = /^\d+(\.\d{0,2})?$/; // Accepts integer or up to 2 decimal places

    if (text === "" || regex.test(text)) {
      setAmount(text);
    } else {
      Toast.show({
        type: "error",
        text1: "Invalid Amount",
        text2: "Only numeric values are allowed (e.g. 100 or 50.25)",
        position: "bottom",
      });
      setAmount("");
      return;
    }
  };

  // ! for adding new transaction
  const handleAddTransaction = async () => {
    Keyboard.dismiss();

    if (!title?.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please title ",
        position: "bottom",
      });

      return;
    }
    if (!amount?.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Field",
        text2: "Please enter valid amount",
        position: "bottom",
      });

      return;
    }

    try {
      const payload = {
        type,
        amount: parseFloat(amount!),
        title,
        description: description ?? " ",
      };

      // transactions/new-transaction

      const result = await addTransactionMutation.mutateAsync({
        url: "/transactions/new-transaction",
        payload,
      });

      // console.log(result);

      if (result?.success) {
        const successMessage = result?.message;
        setTitle("");
        setDescription("");
        setAmount(null);
        setType(transactionConstants?.income);

        Toast.show({
          type: "success",
          text1: successMessage,
          position: "top",
        });

        setTimeout(() => {
          router.push("/");
        }, 100);
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
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
      }}
      bottomOffset={30}
      extraKeyboardSpace={10}
      showsVerticalScrollIndicator={false}
    >
      <View style={addTransactionStyles.pageWrapper}>
        {/* income , expense button view  */}
        <View
          style={{
            flexDirection: "row",
            columnGap: 10,
            justifyContent: "center",
          }}
        >
          {/* income button  */}
          <TouchableOpacity
            style={[
              addTransactionStyles.typeButton,
              type === transactionConstants?.income &&
                addTransactionStyles.typeButtonActive,
            ]}
            onPress={() => setType(transactionConstants?.income)}
          >
            <MaterialCommunityIcons
              name="arrow-up"
              size={18}
              color={
                type === transactionConstants?.income ? COLORS.white : "green"
              }
            />
            <Text
              style={[
                addTransactionStyles.typeButtonText,
                type === transactionConstants?.income &&
                  addTransactionStyles.typeButtonTextActive,
              ]}
            >
              Income{" "}
            </Text>
          </TouchableOpacity>

          {/* expense button  */}
          <TouchableOpacity
            style={[
              addTransactionStyles.typeButton,
              type === transactionConstants?.expense &&
                addTransactionStyles.typeButtonActive,
            ]}
            onPress={() => setType(transactionConstants?.expense)}
          >
            <MaterialCommunityIcons
              name="arrow-down"
              size={18}
              color={
                type === transactionConstants?.expense ? COLORS.white : "red"
              }
            />
            <Text
              style={[
                addTransactionStyles.typeButtonText,
                type === transactionConstants?.expense &&
                  addTransactionStyles.typeButtonTextActive,
              ]}
            >
              Expense
            </Text>
          </TouchableOpacity>

          {/*  */}
        </View>

        {/* horizontal line  */}
        <View
          style={{
            height: 1,
            width: "100%",
            backgroundColor: COLORS.border,
            margin: 15,
          }}
        />

        {/* money input field  */}
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}
        >
          <TextInput
            placeholder="+৳ 00.0"
            keyboardType="numeric"
            value={amount || ""}
            onChangeText={handleTextChange}
            textColor={COLORS.text}
            style={{
              borderWidth: 0,
              backgroundColor: "transparent",
              padding: 0,
              fontSize: 22,
            }}
          />
        </View>

        {/* title input field  */}
        <View
          style={{
            width: "100%",
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}
        >
          <TextInput
            placeholder="Transaction Title "
            value={title || ""}
            onChangeText={setTitle}
            underlineColorAndroid="transparent"
            textColor={COLORS.text}
            style={{
              borderWidth: 0,
              backgroundColor: "transparent",
              padding: 0,
              fontSize: 20,
            }}
          />
        </View>

        {/* transaction details input field  */}
        <View
          style={{
            width: "100%",
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}
        >
          <TextInput
            placeholder="Transaction Description "
            value={description || ""}
            onChangeText={setDescription}
            textColor={COLORS.text}
            style={{
              borderWidth: 0,
              backgroundColor: "transparent",
              padding: 0,
              fontSize: 20,
            }}
          />
        </View>

        <Button
          disabled={addTransactionMutation?.isPending}
          mode="contained"
          onPress={handleAddTransaction}
          style={{ marginTop: 20, backgroundColor: COLORS.primary }}
          labelStyle={{ color: COLORS.background }}
        >
          {addTransactionMutation?.isPending
            ? "Saving Transaction..."
            : " Save Transaction"}
        </Button>
      </View>
    </KeyboardAwareScrollView>
  );
}

const addTransactionStyles = StyleSheet.create({
  pageWrapper: {
    width: "90%",
    margin: "auto",

    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },

  typeButton: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    columnGap: 3,
    padding: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  typeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  typeButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },

  typeButtonTextActive: {
    color: COLORS.white,
  },

  //
});
