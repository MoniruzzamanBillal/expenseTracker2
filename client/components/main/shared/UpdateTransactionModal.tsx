import { usePatch } from "@/hooks/useApi";
import { TransactionTypeConst, TTransactionType } from "@/constants/TransactionType.constant";
import { useTheme, spacing, text } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import CategoryPicker from "./CategoryPicker";
import FormField from "./FormField";
import PrimaryButton from "./PrimaryButton";
import ReceiptImagePicker from "./ReceiptImagePicker";
import Sheet from "./Sheet";
import TypeToggle from "./TypeToggle";

const INVALIDATE_KEYS = [
  ["daily-transaction"],
  ["monthly-transaction"],
  ["weekly-transaction"],
  ["yearly-transaction"],
  ["budgets"],
];

type TPageProps = {
  open: boolean;
  setOpen: (val: boolean) => void;
  initialValue?: TTransaction;
};

export default function UpdateTransactionModal({
  open = false,
  setOpen,
  initialValue,
}: TPageProps) {
  const C = useTheme();

  const [type, setType] = useState<TTransactionType>(
    initialValue?.type || TransactionTypeConst.income,
  );

  const [amount, setAmount] = useState<string | null>(
    String(initialValue?.amount) || null,
  );
  const [title, setTitle] = useState<string | null>(
    initialValue?.title || null,
  );
  const [description, setDescription] = useState<string | null>(
    initialValue?.description || null,
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    initialValue?.categoryId ?? null,
  );

  const patchMutation = usePatch(INVALIDATE_KEYS);

  const accentColor = type === TransactionTypeConst.income ? C.income : C.expense;

  const handleTextChange = (text: string) => {
    const regex = /^\d+(\.\d{0,2})?$/;

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

  useEffect(() => {
    if (initialValue) {
      setAmount(String(initialValue?.amount));
      setTitle(initialValue?.title);
      setDescription(initialValue?.description ?? " ");
      setType(initialValue?.type || TransactionTypeConst.income);
      setCategoryId(initialValue?.categoryId ?? null);
    }
  }, [initialValue]);

  const hideModal = () => setOpen(false);

  const handleUpdateTransaction = async () => {
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
        categoryId,
      };

      const result = await patchMutation.mutateAsync({
        url: `/transactions/update-transaction/${initialValue?._id}`,
        payload,
      });

      if (result?.success) {
        const successMessage = result?.message;
        setTitle("");
        setDescription("");
        setAmount(null);
        setType(TransactionTypeConst.income);
        setCategoryId(null);

        Toast.show({
          type: "success",
          text1: successMessage,
          position: "top",
        });

        hideModal();
      }
    } catch (error) {
      console.log("error = ", error);
      Toast.show({
        type: "error",
        text1: "Something went wrong!!",
        position: "top",
      });
      hideModal();
    }
  };

  const handleDeleteTransaction = async () => {
    try {
      const result = await patchMutation.mutateAsync({
        url: `/transactions/delete-transaction/${initialValue?._id}`,
        payload: initialValue ?? {},
      });
      if (result?.success) {
        Toast.show({ type: "success", text1: result?.message, position: "top" });
        hideModal();
      }
    } catch (error) {
      console.log("error = ", error);
      Toast.show({ type: "error", text1: "Something went wrong!!", position: "top" });
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete transaction?", initialValue?.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: handleDeleteTransaction },
    ]);
  };

  return (
    <Sheet visible={open} onDismiss={hideModal}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        bottomOffset={20}
        extraKeyboardSpace={10}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headRow}>
          <Text style={[text.h3, { color: C.text }]}>Edit entry</Text>
          {initialValue?.createdAt ? (
            <Text style={[text.caption, { color: C.textMuted }]}>Today · {format(new Date(initialValue.createdAt), "HH:mm")}</Text>
          ) : null}
        </View>

        <TypeToggle value={type} onChange={setType} />

        <View style={{ marginTop: spacing.lg }}>
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <FormField
            label="Amount"
            value={amount || ""}
            onChangeText={handleTextChange}
            keyboardType="decimal-pad"
            placeholder="0.00"
            inSheet
            inputStyle={{ fontSize: 20, fontWeight: "500", color: accentColor }}
          />
          <FormField label="Title" value={title || ""} onChangeText={setTitle} placeholder="e.g. Groceries" inSheet />
          <FormField
            label="Description"
            value={description || ""}
            onChangeText={setDescription}
            placeholder="Add a note… (optional)"
            multiline
            inSheet
            inputStyle={{ height: 70, textAlignVertical: "top", paddingTop: 12 }}
          />
        </View>

        {initialValue?._id ? (
          <ReceiptImagePicker
            transactionId={initialValue._id}
            value={initialValue?.receiptFileUrl}
            fileName={initialValue?.receiptFileOriginalName}
            invalidateKeys={INVALIDATE_KEYS}
          />
        ) : null}

        <View style={styles.actionRow}>
          <PrimaryButton label="Delete" onPress={confirmDelete} variant="destructive" style={{ flex: 0, paddingHorizontal: spacing.base }} height={spacing.field} />
          <PrimaryButton
            label={patchMutation?.isPending ? "Saving…" : "Save changes"}
            onPress={handleUpdateTransaction}
            loading={patchMutation?.isPending}
            style={{ flex: 1 }}
            height={spacing.field}
          />
        </View>
      </KeyboardAwareScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
