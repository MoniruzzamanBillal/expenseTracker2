import CategoryPicker from "@/components/main/shared/CategoryPicker";
import FormField from "@/components/main/shared/FormField";
import Keypad from "@/components/main/shared/Keypad";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import TypeToggle from "@/components/main/shared/TypeToggle";
import { TransactionTypeConst, TTransactionType } from "@/constants/TransactionType.constant";
import { usePost } from "@/hooks/useApi";
import { useEnqueuePendingTransactions } from "@/hooks/usePendingTransactions";
import { radius, spacing, text, useTheme } from "@/theme";
import AuthGuard from "@/utils/AuthGuard";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const fmt = (n: string) => {
  if (!n) return "0";
  const [whole, dec] = n.split(".");
  const withCommas = Number(whole || 0).toLocaleString("en-IN");
  return dec !== undefined ? `${withCommas}.${dec}` : withCommas;
};

// Deep-link target for the home-screen widget's "+ Expense"/"+ Income"
// buttons (client://quick-add?type=expense|income) — see
// widgets/QuickAddWidget.tsx. Outside the (tabs) group, so it needs its own
// AuthGuard (the tabs layout's guard doesn't apply here). A sheet over a
// scrim, not a screen: no tab bar, no header, one job.
function QuickAddSheet() {
  const C = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type?: string }>();

  const [txType, setTxType] = useState<TTransactionType>(type === TransactionTypeConst.expense ? TransactionTypeConst.expense : TransactionTypeConst.income);
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const addTransactionMutation = usePost([
    ["daily-transaction"],
    ["monthly-transaction"],
    ["weekly-transaction"],
    ["yearly-transaction"],
    ["budgets"],
  ]);
  const enqueuePendingTransactions = useEnqueuePendingTransactions();

  const close = () => router.back();

  const handleSave = async () => {
    if (!amount) return;

    const basePayload = {
      type: txType,
      amount: parseFloat(amount),
      title: title.trim() || (txType === TransactionTypeConst.income ? "Income" : "Expense"),
      description: " ",
    };

    try {
      const result = await addTransactionMutation.mutateAsync({
        url: "/transactions/new-transaction",
        payload: { ...basePayload, categoryId },
      });

      if (result?.success) {
        Toast.show({ type: "success", text1: result?.message, position: "top" });
        close();
      } else {
        await enqueuePendingTransactions([{ payload: basePayload, origin: "manual" }]);
        Toast.show({ type: "success", text1: "Saved offline", text2: "It will sync when you're back online", position: "top" });
        close();
      }
    } catch (error) {
      console.log("error = ", error);
      Toast.show({ type: "error", text1: "Something went wrong!!", position: "top" });
    }
  };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: C.scrim }]} onPress={close} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: C.surface, borderColor: C.border, paddingBottom: spacing.lg + insets.bottom },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: C.border }]} />

        <View style={styles.headerRow}>
          <View style={{ width: 190 }}>
            <TypeToggle value={txType} onChange={setTxType} />
          </View>
          <TouchableOpacity onPress={close} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.amountRow}>
          <Text style={[styles.currencySymbol, { color: C.textSecondary }]}>৳</Text>
          <Text style={[text.amountInput, { color: amount ? C.text : C.textMuted }]}>{fmt(amount) || "0"}</Text>
        </View>

        <FormField
          label=""
          value={title}
          onChangeText={setTitle}
          placeholder="Title (defaults to category)"
          inputStyle={{ height: 46 }}
        />

        <CategoryPicker value={categoryId} onChange={setCategoryId} />

        <Keypad value={amount} onChange={setAmount} />

        <PrimaryButton
          label={addTransactionMutation.isPending ? "Saving…" : `Save ${txType === TransactionTypeConst.income ? "income" : "expense"}`}
          onPress={handleSave}
          loading={addTransactionMutation.isPending}
          disabled={!amount}
          color={txType === TransactionTypeConst.income ? C.income : C.expense}
          height={spacing.cta}
        />
      </View>
    </View>
  );
}

export default function QuickAdd() {
  return (
    <AuthGuard>
      <QuickAddSheet />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: -8 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 4, height: 58 },
  currencySymbol: { fontSize: 28 },
});
