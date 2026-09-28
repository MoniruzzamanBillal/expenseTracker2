import { TransactionTypeConst, TTransactionType } from "@/constants/TransactionType.constant";
import { useUpdatePendingTransaction } from "@/hooks/usePendingTransactions";
import { useTheme, spacing, text } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import FormField from "./FormField";
import PrimaryButton from "./PrimaryButton";
import Sheet from "./Sheet";
import TypeToggle from "./TypeToggle";

type TPageProps = {
  open: boolean;
  setOpen: (val: boolean) => void;
  initialValue?: TTransaction;
};

export default function PendingTransactionEditModal({
  open = false,
  setOpen,
  initialValue,
}: TPageProps) {
  const C = useTheme();
  const updatePendingTransaction = useUpdatePendingTransaction();

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
    }
  }, [initialValue]);

  const hideModal = () => setOpen(false);

  // Updating a pending (not-yet-synced) transaction — local queue only, no request.
  const handleUpdatePendingTransaction = async () => {
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
      await updatePendingTransaction(initialValue?._id as string, {
        type,
        amount: parseFloat(amount!),
        title,
        description: description ?? " ",
      });

      Toast.show({
        type: "success",
        text1: "Updated locally",
        position: "top",
      });

      hideModal();
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

  return (
    <Sheet visible={open} onDismiss={hideModal}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        bottomOffset={20}
        extraKeyboardSpace={10}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[text.h3, { color: C.text, marginBottom: spacing.md }]}>Edit queued entry</Text>

        <TypeToggle value={type} onChange={setType} />

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

        <PrimaryButton label="Save changes" onPress={handleUpdatePendingTransaction} height={spacing.field} />
      </KeyboardAwareScrollView>
    </Sheet>
  );
}
