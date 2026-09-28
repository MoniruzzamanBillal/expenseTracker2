import { useTheme, spacing, text } from "@/theme";
import { TTransactionRequest } from "@/types/TransactionRequest.types";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import CategoryPicker from "./CategoryPicker";
import FormField from "./FormField";
import PrimaryButton from "./PrimaryButton";
import Sheet from "./Sheet";

const SOURCE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  fuel: "car-outline",
  maintenance: "build-outline",
  accessory: "pricetag-outline",
};

type TPageProps = {
  open: boolean;
  setOpen: (val: boolean) => void;
  initialValue?: TTransactionRequest;
  onAccept: (edits: {
    title: string;
    description: string;
    amount: number;
    categoryId: string | null;
  }) => void;
  loading?: boolean;
};

// ! structurally mirrors PendingTransactionEditModal — but always "expense" (no TypeToggle,
// ! these are always spend), and its primary button submits the edits together with Accept
// ! rather than saving locally as a separate step. categoryId is applied by the caller via a
// ! follow-up PATCH /transactions/update-transaction/:id after accept (server can't take it
// ! on the accept call itself — see 01 Foundations.dc.html gap #04).
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
  const [categoryId, setCategoryId] = useState<string | null>(null);

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
      setCategoryId(null);
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
      categoryId,
    });
  };

  const sourceIcon = initialValue?.sourceType ? SOURCE_ICON[initialValue.sourceType] ?? "pricetag-outline" : "pricetag-outline";

  return (
    <Sheet visible={open} onDismiss={hideModal}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        bottomOffset={20}
        extraKeyboardSpace={10}
        showsVerticalScrollIndicator={false}
      >
        {initialValue ? (
          <View style={styles.metaRow}>
            <Ionicons name={sourceIcon} size={14} color={C.accentText} />
            <Text style={[text.caption, { color: C.textSecondary }]}>
              bikelog · {initialValue.sourceType} · {format(new Date(initialValue.occurredAt), "EEE d MMM, HH:mm")}
            </Text>
          </View>
        ) : null}
        <Text style={[text.h3, { color: C.text, marginBottom: spacing.md }]}>Review expense</Text>

        <FormField
          label="Amount"
          value={amount || ""}
          onChangeText={handleTextChange}
          keyboardType="decimal-pad"
          placeholder="0.00"
          inSheet
          inputStyle={{ fontSize: 20, fontWeight: "500", color: C.expense }}
        />
        <FormField label="Title" value={title || ""} onChangeText={setTitle} placeholder="e.g. Fuel: Shell Station" inSheet />
        <FormField
          label="Description"
          value={description || ""}
          onChangeText={setDescription}
          placeholder="Add a note… (optional)"
          multiline
          inSheet
          inputStyle={{ height: 70, textAlignVertical: "top", paddingTop: 12 }}
        />

        <View style={{ marginBottom: spacing.md }}>
          <Text style={[text.captionMd, { color: C.textSecondary, marginBottom: spacing.xs + 1 }]}>Category</Text>
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
        </View>

        {initialValue ? (
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={15} color={C.textMuted} />
            <Text style={[text.caption, { color: C.textMuted, flex: 1 }]}>
              Saved with today&apos;s date. The request keeps its original time ({format(new Date(initialValue.occurredAt), "d MMM")}).
            </Text>
          </View>
        ) : null}

        <PrimaryButton
          label={loading ? "Accepting…" : "Accept expense"}
          onPress={handleAccept}
          loading={loading}
          color={C.expense}
          height={spacing.field}
        />
      </KeyboardAwareScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: spacing.md },
});
