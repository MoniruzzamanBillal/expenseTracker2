import CategoryPicker from "@/components/main/shared/CategoryPicker";
import FormField from "@/components/main/shared/FormField";
import Keypad from "@/components/main/shared/Keypad";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import TypeToggle from "@/components/main/shared/TypeToggle";
import {
  TransactionTypeConst,
  TTransactionType,
} from "@/constants/TransactionType.constant";
import { usePostOutcome, usePut } from "@/hooks/useApi";
import { useEnqueuePendingTransactions } from "@/hooks/usePendingTransactions";
import { radius, spacing, text, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const fmt = (n: string) => {
  if (!n) return "0";
  const [whole, dec] = n.split(".");
  const withCommas = Number(whole || 0).toLocaleString("en-IN");
  return dec !== undefined ? `${withCommas}.${dec}` : withCommas;
};

export default function AddTransactionPage({
  initialType = TransactionTypeConst.income,
}: {
  // Lets a caller (e.g. the quick-add widget route) pre-select income/expense
  // instead of always defaulting to income.
  initialType?: TTransactionType;
} = {}) {
  const C = useTheme();
  const router = useRouter();

  const [type, setType] = useState<TTransactionType>(initialType);
  const [amount, setAmount] = useState<string>("");
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [titleError, setTitleError] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const accentColor = type === TransactionTypeConst.income ? C.income : C.expense;

  const addTransactionMutation = usePostOutcome([
    ["daily-transaction"],
    ["monthly-transaction"],
    ["weekly-transaction"],
    ["yearly-transaction"],
    ["budgets"],
  ]);
  const uploadReceiptMutation = usePut([]);

  const enqueuePendingTransactions = useEnqueuePendingTransactions();

  const pickReceiptFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setReceipt({ uri: asset?.uri, name: asset?.fileName ?? "receipt.jpg", type: asset?.mimeType ?? "image/jpeg" });
    }
  };

  const takeReceiptPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setReceipt({ uri: asset?.uri, name: asset?.fileName ?? "receipt.jpg", type: asset?.mimeType ?? "image/jpeg" });
    }
  };

  const pickReceiptPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setReceipt({ uri: asset?.uri, name: asset?.name ?? "document.pdf", type: asset?.mimeType ?? "application/pdf" });
    }
  };

  const openReceiptSheet = () => {
    Alert.alert("Attach receipt", "Image or PDF, up to 10 MB", [
      { text: "Take Photo", onPress: takeReceiptPhoto },
      { text: "Choose from Library", onPress: pickReceiptFromLibrary },
      { text: "Choose PDF", onPress: pickReceiptPdf },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAmount("");
    setType(TransactionTypeConst.income);
    setCategoryId(null);
    setReceipt(null);
    setTitleError(false);
    setNoteOpen(false);
  };

  const handleAddTransaction = async () => {
    Keyboard.dismiss();

    const finalTitle = title?.trim() || null;
    if (!finalTitle) {
      setTitleError(true);
    }
    if (!amount) {
      Toast.show({ type: "error", text1: "Enter an amount", position: "bottom" });
      return;
    }

    try {
      // categoryId is included in the online payload only — the offline queue
      // never carries a category (per direct user instruction, spec 13's Scope).
      const basePayload = {
        type,
        amount: parseFloat(amount),
        title: finalTitle ?? "Uncategorized",
        description: description?.trim() || " ",
      };

      // Omitted rather than sent as null when nothing is picked: the server's
      // createTransactionSchema has categoryId as .optional(), which admits
      // undefined but not null, so an explicit null is a 400 (spec 28).
      const outcome = await addTransactionMutation.mutateAsync({
        url: "/transactions/new-transaction",
        payload: { ...basePayload, ...(categoryId ? { categoryId } : {}) },
      });

      if (outcome?.ok) {
        const result = outcome.body;
        const createdId = result?.data?._id;
        if (receipt && createdId) {
          try {
            const formData = new FormData();
            formData.append("file", receipt as any);
            await uploadReceiptMutation.mutateAsync({
              url: `/transactions/receipt-file/${createdId}`,
              payload: formData,
            });
          } catch (uploadError) {
            console.log("receipt upload error = ", uploadError);
            Toast.show({
              type: "error",
              text1: "Entry saved, receipt didn't upload",
              text2: "File too large. Open the entry to try another file.",
              position: "top",
            });
          }
        }

        resetForm();
        Toast.show({ type: "success", text1: result?.message, position: "top" });
        setTimeout(() => router.push("/"), 100);
      } else if (outcome?.offline) {
        // No response at all — offline, DNS, or the timeout. Queue it rather
        // than lose it.
        await enqueuePendingTransactions([{ payload: basePayload, origin: "manual" }]);
        resetForm();
        Toast.show({ type: "success", text1: "Saved offline", text2: "It will sync when you're back online", position: "top" });
        setTimeout(() => router.push("/"), 100);
      }
      // A server that answered with an error is not an offline save: the axios
      // interceptor has already toasted its message, and the form keeps what
      // was typed so it can be corrected and resubmitted.
    } catch (error) {
      console.log("error = ", error);
      Toast.show({ type: "error", text1: "Something went wrong!!", position: "top" });
    }
  };

  const saving = addTransactionMutation?.isPending;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={["top"]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        bottomOffset={30}
        extraKeyboardSpace={10}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.nav}>
          <Text style={[text.h2, { color: C.text }]}>New entry</Text>
          <TouchableOpacity onPress={() => router.push("/smart-add")} style={[styles.smartAddBtn, { borderColor: C.accentBorder }]}>
            <Ionicons name="sparkles-outline" size={16} color={C.accent} />
            <Text style={[text.bodySm, { color: C.accent }]}>Smart Add</Text>
          </TouchableOpacity>
        </View>

        <TypeToggle value={type} onChange={setType} />

        <View style={styles.amountBlock}>
          <Text style={[text.kicker, { color: C.textSecondary }]}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.currencySymbol, { color: C.textSecondary }]}>৳</Text>
            <Text style={[text.amountInput, { color: amount ? C.text : C.textMuted }]}>{fmt(amount) || "0"}</Text>
          </View>
        </View>

        <View style={[styles.titleField, { backgroundColor: C.surface, borderColor: titleError ? C.expense : C.border }]}>
          <Ionicons name="text-outline" size={17} color={C.textMuted} />
          {/* A bare TextInput, not FormField: this row already draws the border,
              background and height that FormField's own wrapper would duplicate,
              and FormField's root has no flex, so nested in a row it collapsed to
              its content width instead of filling the field. */}
          <TextInput
            value={title || ""}
            onChangeText={(v) => {
              setTitle(v);
              if (v.trim()) setTitleError(false);
            }}
            placeholder="What was it for?"
            placeholderTextColor={C.placeholder}
            underlineColorAndroid="transparent"
            style={[styles.titleInput, text.body, { color: C.text }]}
          />
        </View>
        {titleError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={C.expense} />
            <Text style={[text.caption, { color: C.expense }]}>Please enter a title</Text>
          </View>
        ) : null}

        <CategoryPicker value={categoryId} onChange={setCategoryId} />

        <View style={styles.pillRow}>
          <TouchableOpacity
            onPress={() => setNoteOpen((v) => !v)}
            style={[styles.pill, { borderColor: C.border }, noteOpen && { borderColor: C.accentBorder, backgroundColor: C.accentDim }]}
          >
            <Ionicons name="create-outline" size={15} color={noteOpen ? C.accentText : C.textSecondary} />
            <Text style={[text.bodySm, { color: noteOpen ? C.accentText : C.textSecondary }]}>Note</Text>
          </TouchableOpacity>
          {receipt ? (
            <View style={[styles.pill, styles.receiptPill, { borderColor: C.accentBorder, backgroundColor: C.accentDim }]}>
              <Ionicons name="document-text-outline" size={15} color={C.accentText} />
              <Text style={[text.bodySm, { color: C.accentText, flex: 1 }]} numberOfLines={1}>
                {receipt?.name}
              </Text>
              <TouchableOpacity onPress={() => setReceipt(null)} hitSlop={6}>
                <Ionicons name="close" size={16} color={C.accentText} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={openReceiptSheet} style={[styles.pill, { borderColor: C.border }]}>
              <Ionicons name="attach-outline" size={16} color={C.textSecondary} />
              <Text style={[text.bodySm, { color: C.textSecondary }]}>Receipt</Text>
            </TouchableOpacity>
          )}
        </View>

        {noteOpen ? (
          <FormField
            label=""
            value={description || ""}
            onChangeText={setDescription}
            placeholder="Add a note… (optional)"
            multiline
            autoFocus
            inputStyle={{ height: 60, textAlignVertical: "top", paddingTop: 12 }}
          />
        ) : null}

        <Keypad value={amount} onChange={setAmount} />

        <PrimaryButton
          label={saving ? "Saving…" : `Save ${type === TransactionTypeConst.income ? "income" : "expense"}`}
          onPress={handleAddTransaction}
          loading={saving}
          color={accentColor}
          height={spacing.cta}
          style={{ marginTop: spacing.md }}
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: spacing.xs, paddingBottom: 40, gap: spacing.md },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
  },
  smartAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm + 3,
    borderWidth: 1,
  },
  amountBlock: { gap: 2, paddingVertical: spacing.xs },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  currencySymbol: { fontSize: 28 },
  titleField: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 46, borderRadius: radius.card, borderWidth: 1, paddingHorizontal: spacing.md },
  // outlineWidth kills the browser's focus ring on the web target (react-native-web
  // doesn't reset it); underlineColorAndroid="transparent" on the input does the
  // same for Android's focus underline. The row's own border is the focus affordance.
  titleInput: { flex: 1, height: "100%", padding: 0, outlineWidth: 0 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: -spacing.xs },
  pillRow: { flexDirection: "row", gap: spacing.sm },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
  },
  receiptPill: { flex: 1, minWidth: 0, paddingLeft: spacing.md, paddingRight: spacing.xs },
});
