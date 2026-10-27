import { usePatch } from "@/hooks/useApi";
import { TransactionTypeConst, TTransactionType } from "@/constants/TransactionType.constant";
import { useTheme, spacing, text } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { parseOccurredAt, toOccurredAtISO } from "@/utils/occurredAt";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import CategorySelectField from "./CategorySelectField";
import ConfirmModal from "./ConfirmModal";
import DateField from "./DateField";
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
  const [date, setDate] = useState<Date>(
    parseOccurredAt(initialValue?.occurredAt, initialValue?.createdAt),
  );

  const patchMutation = usePatch(INVALIDATE_KEYS);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const accentColor = type === TransactionTypeConst.income ? C?.income : C?.expense;

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
      setDate(parseOccurredAt(initialValue?.occurredAt, initialValue?.createdAt));
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
        occurredAt: toOccurredAtISO(date),
      };

      const result = await patchMutation?.mutateAsync({
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
      setConfirmOpen(false);
      const result = await patchMutation?.mutateAsync({
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


  return (
    <Sheet visible={open} onDismiss={hideModal}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        bottomOffset={20}
        extraKeyboardSpace={10}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headRow}>
          <Text style={[text.h3, { color: C?.text }]}>Edit entry</Text>
          <Text style={[text.caption, { color: C?.textMuted }]}>{format(date, "d MMM yyyy")}</Text>
        </View>

        <TypeToggle value={type} onChange={setType} />

        <View style={{ marginTop: spacing.lg }}>
          <CategorySelectField
            value={categoryId}
            onChange={setCategoryId}
            inSheet
          />
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
          <DateField value={date} onChange={setDate} label="Date" inSheet />
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
          <PrimaryButton label="Delete" onPress={() => setConfirmOpen(true)} variant="destructive" style={{ flexGrow: 0, flexShrink: 0, minWidth: 100 }} height={spacing.field} />
          <PrimaryButton
            label={patchMutation?.isPending ? "Saving…" : "Save changes"}
            onPress={handleUpdateTransaction}
            loading={patchMutation?.isPending}
            style={{ flex: 1 }}
            height={spacing.field}
          />
        </View>
      </KeyboardAwareScrollView>

      <ConfirmModal
        visible={confirmOpen}
        title="Delete transaction?"
        message={initialValue?.title ? `"${initialValue?.title}" will be removed from your transactions.` : undefined}
        confirmLabel="Delete"
        loading={patchMutation?.isPending}
        onConfirm={handleDeleteTransaction}
        onCancel={() => setConfirmOpen(false)}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
