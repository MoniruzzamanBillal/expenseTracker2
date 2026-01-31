import { usePost } from "@/hooks/useApi";
import { TTransaction } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import Toast from "react-native-toast-message";

export default function SmartAddPage() {
  const router = useRouter();

  const [prompt, setPrompt] = useState<string | null>();
  const [chatResponseData, setChatResponseData] = useState([]);

  const addPromptMutation = usePost([[""]]);

  const addTransactionMutation = usePost([
    ["daily-transaction"],
    ["monthly-transaction"],
    ["monthly-transaction-legacy"],
    ["yearly-transaction"],
  ]);

  //   ! for giving prompt
  const handleAddPrompt = async () => {
    setChatResponseData([]);

    if (!prompt?.trim()) {
      Toast.show({
        type: "error",
        text1: "Give a valid prompt!!!",
        position: "top",
      });

      return;
    }

    try {
      const result = await addPromptMutation.mutateAsync({
        url: "/transactions/manage-money",
        payload: { prompt },
      });

      //   console.log(result);

      if (result?.success) {
        const successMessage = result?.message;
        Toast.show({
          type: "success",
          text1: successMessage,
          position: "top",
        });

        setPrompt(null);

        if (result?.data) {
          setChatResponseData(result?.data);
        }
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

  //   ! for adding prompt data
  const handleAddPromptData = async () => {
    if (!chatResponseData?.length) {
      Toast.show({
        type: "error",
        text1: "No response data available",
        position: "top",
      });
    }

    try {
      const result = await addTransactionMutation.mutateAsync({
        url: "/transactions/many-transaction",
        payload: chatResponseData,
      });

      if (result?.success) {
        const successMessage = result?.message;

        setChatResponseData([]);
        setPrompt(null);

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

  //   console.log(chatResponseData);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      {/* top input fields  */}
      <View style={styles.topInputContent}>
        <TextInput
          placeholder="Enter Detailed prompt..."
          value={prompt || ""}
          onChangeText={setPrompt}
          numberOfLines={6}
          multiline
          textColor={COLORS.text}
          style={{
            borderWidth: 0,
            backgroundColor: "transparent",
            fontSize: 18,
            minHeight: 90,
            maxHeight: 110,
          }}
        />

        <Button
          disabled={
            addPromptMutation?.isPending || addTransactionMutation?.isPending
          }
          mode="contained"
          onPress={handleAddPrompt}
          style={{ marginTop: 20, backgroundColor: COLORS.primary }}
          labelStyle={{ color: COLORS.background }}
        >
          {addPromptMutation?.isPending ? "Sending Prompt..." : " Add Prompt"}
        </Button>
      </View>

      {chatResponseData?.length && (
        <View
          style={{
            height: 1,
            width: "100%",
            backgroundColor: COLORS.border,
            marginVertical: 20,
          }}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {/* chat respond data   */}
        {chatResponseData &&
          chatResponseData?.map((item: TTransaction, idx: number) => (
            <View key={idx} style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <Text
                  style={[
                    styles.transactionType,
                    item.type === "income"
                      ? styles.incomeText
                      : styles.expenseText,
                  ]}
                >
                  {item.type.toUpperCase()}
                </Text>

                <Text
                  style={[
                    styles.transactionAmount,
                    item.type === "income"
                      ? styles.incomeText
                      : styles.expenseText,
                  ]}
                >
                  ৳ {item.amount}
                </Text>
              </View>

              <Text style={styles.transactionTitle}>{item.title}</Text>

              {!!item.description && (
                <Text style={styles.transactionDescription}>
                  {item.description}
                </Text>
              )}
            </View>
          ))}

        {chatResponseData?.length && (
          <Button
            disabled={
              addPromptMutation?.isPending || addTransactionMutation?.isPending
            }
            mode="contained"
            onPress={handleAddPromptData}
            style={{ marginTop: 8, backgroundColor: COLORS.primary }}
            labelStyle={{ color: COLORS.background }}
          >
            {addTransactionMutation?.isPending
              ? "Saving Transaction..."
              : " Save Transaction"}
          </Button>
        )}

        {/*  */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

//
const styles = StyleSheet.create({
  topInputContent: {
    width: "90%",
    margin: "auto",
  },

  scrollContent: {
    width: "90%",
    margin: "auto",
    paddingBottom: 12,
  },

  //

  incomeText: {
    color: "green",
    fontWeight: "600",
  },

  expenseText: {
    color: "red",
    fontWeight: "600",
  },

  balanceText: {
    color: COLORS.text,
    fontWeight: "700",
  },

  transactionCard: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
  },

  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  transactionType: {
    fontSize: 15,
    fontWeight: "900",
  },

  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },

  transactionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },

  transactionDescription: {
    fontSize: 12,
    color: COLORS.text,
    opacity: 0.8,
  },

  //
});
