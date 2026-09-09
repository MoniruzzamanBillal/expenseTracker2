import { useTheme, spacing, radius } from "@/theme";
import { TTransactionRequest } from "@/types/TransactionRequest.types";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Modal, Portal } from "react-native-paper";
import Toast from "react-native-toast-message";
import FormField from "./FormField";
import PrimaryButton from "./PrimaryButton";

type TPageProps = {
  open: boolean;
  setOpen: (val: boolean) => void;
  initialValue?: TTransactionRequest;
  onAccept: (edits: {
    title: string;
    description: string;
    amount: number;
  }) => void;
  loading?: boolean;
};

// ! structurally mirrors PendingTransactionEditModal — but always "expense" (no TypeToggle,
// ! these are always spend), and its primary button submits the edits together with Accept
// ! rather than saving locally as a separate step
export default function TransactionRequestEditModal({
  open = false,
  setOpen,
  initialValue,
  onAccept,
  loading,
}: TPageProps) {
  const C = useTheme();

  const [amount, setAmount] = useState<string | null>(
    initialValue ? String(initialValue.amount) : null,
  );
  const [title, setTitle] = useState<string | null>(
    initialValue?.title || null,
  );
  const [description, setDescription] = useState<string | null>(
    initialValue?.description || null,
  );

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
      setAmount(String(initialValue.amount));
      setTitle(initialValue.title);
      setDescription(initialValue.description ?? " ");
    }
  }, [initialValue]);

  const hideModal = () => setOpen(false);

  const handleAccept = () => {
    if (!title?.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please enter a title",
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

    onAccept({
      title,
      description: description ?? " ",
      amount: parseFloat(amount),
    });
  };

  return (
    <Portal>
      <Modal
        visible={open}
        onDismiss={hideModal}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: C.surface, borderColor: C.border },
        ]}
      >
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          bottomOffset={20}
          extraKeyboardSpace={10}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageWrapper}>
            <View style={{ marginTop: spacing.lg }}>
              <FormField
                label="Amount"
                value={amount || ""}
                onChangeText={handleTextChange}
                keyboardType="decimal-pad"
                placeholder="0.00"
                inputStyle={{
                  fontSize: 24,
                  textAlign: "center",
                  color: C.expense,
                }}
              />
              <FormField
                label="Title"
                value={title || ""}
                onChangeText={setTitle}
                placeholder="e.g. Fuel: Shell Station"
              />
              <FormField
                label="Description"
                value={description || ""}
                onChangeText={setDescription}
                placeholder="Add a note… (optional)"
                multiline
                inputStyle={{
                  height: 70,
                  textAlignVertical: "top",
                  paddingTop: 12,
                }}
              />
            </View>

            <PrimaryButton
              label={loading ? "Accepting..." : "Accept Request"}
              onPress={handleAccept}
              loading={loading}
              color={C.expense}
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
