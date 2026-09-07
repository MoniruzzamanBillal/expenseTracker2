import { usePost } from "@/hooks/useApi";
import { useEnqueuePendingTransactions } from "@/hooks/usePendingTransactions";
import { TransactionTypeConst, TTransactionType } from "@/constants/TransactionType.constant";
import { useTheme, text, spacing } from "@/theme";
import TypeToggle from "@/components/main/shared/TypeToggle";
import FormField from "@/components/main/shared/FormField";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

export default function AddTransactionPage() {
  const C = useTheme();
  const router = useRouter();

  const [type, setType] = useState<TTransactionType>(TransactionTypeConst.income);
  const [amount, setAmount] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accentColor = type === TransactionTypeConst.income ? C.income : C.expense;

  const addTransactionMutation = usePost([
    ["daily-transaction"],
    ["monthly-transaction"],
    ["weekly-transaction"],
    ["yearly-transaction"],
  ]);

  const enqueuePendingTransactions = useEnqueuePendingTransactions();

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
      });
      setAmount("");
      return;
    }
  };

  // ! for adding new transaction
  const handleAddTransaction = async () => {
    Keyboard.dismiss();

    const e: Record<string, string> = {};
    if (!title?.trim()) e.title = "Title is required";
    if (!amount?.trim()) e.amount = "Enter a valid amount";
    setErrors(e);
    if (Object.keys(e).length) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please fill in the required fields",
      });
      return;
    }

    try {
      const payload = {
        type,
        amount: parseFloat(amount!),
        title: title!,
        description: description?.trim() || " ",
      };

      const result = await addTransactionMutation.mutateAsync({
        url: "/transactions/new-transaction",
        payload,
      });

      if (result?.success) {
        const successMessage = result?.message;
        setTitle("");
        setDescription("");
        setAmount(null);
        setType(TransactionTypeConst.income);

        Toast.show({
          type: "success",
          text1: successMessage,
          position: "top",
        });

        setTimeout(() => {
          router.push("/");
        }, 100);
      } else {
        // The save didn't reach the server (offline or a server-side failure —
        // both resolve here rather than throwing, see known-issues.md#FETCH-1).
        // Queue it locally instead of losing it.
        await enqueuePendingTransactions([{ payload, origin: "manual" }]);

        setTitle("");
        setDescription("");
        setAmount(null);
        setType(TransactionTypeConst.income);

        Toast.show({
          type: "success",
          text1: "Saved locally",
          text2: "It will sync when you're back online",
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
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        bottomOffset={30}
        extraKeyboardSpace={10}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.nav}>
          <Text style={[text.navTitle, { color: C.text }]}>Add Transaction</Text>
          <TouchableOpacity
            onPress={() => router.push("/smart-add")}
            style={[styles.smartAddBtn, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}
          >
            <MaterialCommunityIcons name="creation" size={13} color={C.accent} />
            <Text style={[text.label, { color: C.accent }]}>Smart Add</Text>
          </TouchableOpacity>
        </View>

        <TypeToggle value={type} onChange={setType} />

        <View style={[styles.amountBlock, { borderBottomColor: accentColor }]}>
          <Text style={[text.label, { color: C.textSecondary, textAlign: "center", marginBottom: spacing.md }]}>
            AMOUNT (BDT)
          </Text>
          <FormField
            label=""
            value={amount || ""}
            onChangeText={handleTextChange}
            keyboardType="decimal-pad"
            placeholder="0.00"
            error={errors.amount}
            inputStyle={{ fontSize: 40, textAlign: "center", color: accentColor, height: 64 }}
          />
        </View>

        <FormField label="Title" value={title || ""} onChangeText={setTitle} error={errors.title} placeholder="e.g. Groceries" />
        <FormField
          label="Description"
          value={description || ""}
          onChangeText={setDescription}
          placeholder="Add a note… (optional)"
          multiline
          inputStyle={{ height: 80, textAlignVertical: "top", paddingTop: 12 }}
        />

        <PrimaryButton
          label={addTransactionMutation?.isPending ? "Saving Transaction..." : "Save Transaction"}
          onPress={handleAddTransaction}
          loading={addTransactionMutation?.isPending}
          disabled={!title || !amount}
          color={accentColor}
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: spacing.lg, paddingBottom: 40 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xl },
  smartAddBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  amountBlock: { borderBottomWidth: 2, marginBottom: spacing.xl, paddingBottom: spacing.md },
});
