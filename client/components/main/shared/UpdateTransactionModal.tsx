import { usePatch } from "@/hooks/useApi";
import { TransactionTypeConst, TTransactionType } from "@/constants/TransactionType.constant";
import { useTheme, spacing, radius } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Modal, Portal } from "react-native-paper";
import Toast from "react-native-toast-message";
import FormField from "./FormField";
import PrimaryButton from "./PrimaryButton";
import TypeToggle from "./TypeToggle";

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

  const patchMutation = usePatch([
    ["daily-transaction"],
    ["monthly-transaction"],
    ["weekly-transaction"],
    ["yearly-transaction"],
  ]);

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

  return (
    <Portal>
      <Modal
        visible={open}
        onDismiss={hideModal}
        contentContainerStyle={[styles.modalContent, { backgroundColor: C.surface, borderColor: C.border }]}
      >
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          bottomOffset={20}
          extraKeyboardSpace={10}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageWrapper}>
            <TypeToggle value={type} onChange={setType} />

            <View style={{ marginTop: spacing.lg }}>
              <FormField
                label="Amount"
                value={amount || ""}
                onChangeText={handleTextChange}
                keyboardType="decimal-pad"
                placeholder="0.00"
                inputStyle={{ fontSize: 24, textAlign: "center", color: accentColor }}
              />
              <FormField label="Title" value={title || ""} onChangeText={setTitle} placeholder="e.g. Groceries" />
              <FormField
                label="Description"
                value={description || ""}
                onChangeText={setDescription}
                placeholder="Add a note… (optional)"
                multiline
                inputStyle={{ height: 70, textAlignVertical: "top", paddingTop: 12 }}
              />
            </View>

            <PrimaryButton
              label={patchMutation?.isPending ? "Updating..." : "Update Transaction"}
              onPress={handleUpdateTransaction}
              loading={patchMutation?.isPending}
              color={accentColor}
            />
          </View>
        </KeyboardAwareScrollView>
      </Modal>
    </Portal>
  );
}

const styles = {
  modalContent: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  pageWrapper: {
    width: "100%" as const,
  },
};
