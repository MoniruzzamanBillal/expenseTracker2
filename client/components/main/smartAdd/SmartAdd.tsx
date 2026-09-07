import { usePost } from "@/hooks/useApi";
import { useEnqueuePendingTransactions } from "@/hooks/usePendingTransactions";
import { TransactionTypeConst } from "@/constants/TransactionType.constant";
import { TTransaction } from "@/types/Transaction.tyes";
import { createBatchId } from "@/utils/transactionQueue";
import { useTheme, text, spacing, radius } from "@/theme";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Keyboard,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

type TDraftTransaction = TTransaction;

export default function SmartAddPage() {
  const C = useTheme();
  const router = useRouter();

  const [prompt, setPrompt] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<TDraftTransaction[] | null>(null);

  const parseMutation = usePost([[""]]);
  const saveMutation = usePost([
    ["daily-transaction"],
    ["monthly-transaction"],
    ["weekly-transaction"],
    ["yearly-transaction"],
  ]);

  const enqueuePendingTransactions = useEnqueuePendingTransactions();

  const handleParse = async () => {
    if (!prompt?.trim()) {
      Toast.show({
        type: "error",
        text1: "Give a valid prompt!!!",
        position: "top",
      });
      return;
    }

    Keyboard.dismiss();

    try {
      const result = await parseMutation.mutateAsync({
        url: "/transactions/manage-money",
        payload: { prompt },
      });

      if (result?.success) {
        Toast.show({
          type: "success",
          text1: result?.message,
          position: "top",
        });

        setPrompt(null);
        setDrafts(result?.data ?? []);
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

  const updateDraft = (i: number, key: keyof TDraftTransaction, value: string | number) => {
    setDrafts((prev) => (prev ? prev.map((d, idx) => (idx === i ? { ...d, [key]: value } : d)) : prev));
  };

  const removeDraft = (i: number) => {
    Alert.alert("Remove transaction?", "This item will be removed from the list", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => setDrafts((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev)),
      },
    ]);
  };

  const handleSaveAll = async () => {
    if (!drafts?.length) {
      Toast.show({
        type: "error",
        text1: "No response data available",
        position: "top",
      });
      return;
    }

    try {
      const result = await saveMutation.mutateAsync({
        url: "/transactions/many-transaction",
        payload: drafts.map((d) => ({
          type: d.type,
          title: d.title,
          amount: d.amount,
          description: d.description ?? " ",
        })),
      });

      if (result?.success) {
        Toast.show({
          type: "success",
          text1: result?.message,
          position: "top",
        });

        setPrompt(null);
        setDrafts(null);

        setTimeout(() => router.push("/"), 100);
      } else {
        // Didn't reach the server (offline or a server-side failure — both
        // resolve here rather than throwing, see known-issues.md#FETCH-1).
        // Queue every item individually, sharing one batchId for display
        // grouping only — sync still syncs each one separately (spec 02).
        const batchId = createBatchId();

        await enqueuePendingTransactions(
          drafts.map((item) => ({
            payload: {
              type: item.type,
              amount: item.amount,
              title: item.title,
              description: item.description ?? " ",
            },
            origin: "smart-add" as const,
            batchId,
          })),
        );

        setPrompt(null);
        setDrafts(null);

        Toast.show({
          type: "success",
          text1: "Saved locally",
          text2: "It will sync when you're back online",
          position: "top",
        });

        setTimeout(() => router.push("/"), 100);
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
        <View style={styles.heading}>
          <Text style={[text.navTitle, { color: C.text }]}>Smart Add</Text>
          <View style={[styles.aiBadge, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}>
            <Text style={[text.label, { color: C.accent }]}>AI</Text>
          </View>
        </View>
        <Text style={[text.bodySm, { color: C.textSecondary, marginBottom: spacing.lg }]}>
          Describe transactions in plain text
        </Text>

        <TextInput
          value={prompt || ""}
          onChangeText={setPrompt}
          multiline
          style={[styles.textarea, { backgroundColor: C.inputBg, borderColor: C.accentBorder, color: C.text }, text.body]}
          placeholder="bought groceries for 850 taka and got 5000 taka salary"
          placeholderTextColor={C.placeholder}
        />

        <PrimaryButton
          label={parseMutation?.isPending ? "Parsing..." : "Parse with AI"}
          onPress={handleParse}
          loading={parseMutation?.isPending}
          disabled={!prompt?.trim()}
          style={{ marginBottom: spacing.xl }}
        />

        {drafts !== null && (
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.resultsHeader}>
              <Text style={[text.label, { color: C.textSecondary }]}>PARSED RESULTS</Text>
              <View style={[styles.countBadge, { backgroundColor: C.accentDim }]}>
                <Text style={[text.label, { color: C.accent }]}>{drafts.length} found</Text>
              </View>
            </View>

            {drafts.length === 0 && (
              <Text style={[text.body, { color: C.textSecondary, textAlign: "center", marginBottom: spacing.xl }]}>
                Couldn&apos;t parse any transactions — try rephrasing.
              </Text>
            )}

            {drafts.map((draft, i) => {
              const isIncome = draft.type === TransactionTypeConst.income;
              const typeColor = isIncome ? C.income : C.expense;
              const typeBorder = isIncome ? C.incomeBg : C.expenseBg;
              return (
                <View key={i} style={[styles.draftCard, { backgroundColor: C.surface, borderColor: typeBorder }]}>
                  <View style={styles.draftTypeRow}>
                    <View style={styles.draftTypeLeft}>
                      <View style={[styles.dot, { backgroundColor: typeColor }]} />
                      <TouchableOpacity
                        onPress={() =>
                          updateDraft(i, "type", isIncome ? TransactionTypeConst.expense : TransactionTypeConst.income)
                        }
                      >
                        <Text style={[text.label, { color: typeColor }]}>{isIncome ? "INCOME" : "EXPENSE"}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeDraft(i)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <MaterialCommunityIcons name="close" size={18} color={C.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={draft.title}
                    onChangeText={(v) => updateDraft(i, "title", v)}
                    style={[styles.draftInput, text.bodyMd, { color: C.text, borderBottomColor: C.divider }]}
                  />
                  <View style={styles.draftAmountRow}>
                    <Text style={[text.caption, { color: C.textSecondary }]}>৳</Text>
                    <TextInput
                      value={String(draft.amount)}
                      onChangeText={(v) => updateDraft(i, "amount", parseFloat(v.replace(/[^0-9.]/g, "")) || 0)}
                      keyboardType="decimal-pad"
                      style={[text.h3, { color: typeColor, flex: 1 }]}
                    />
                  </View>
                  <TextInput
                    value={draft.description ?? ""}
                    onChangeText={(v) => updateDraft(i, "description", v)}
                    placeholder="Add note…"
                    placeholderTextColor={C.placeholder}
                    style={[text.caption, { color: C.textSecondary, marginTop: 4 }]}
                  />
                </View>
              );
            })}

            {drafts.length > 0 && (
              <PrimaryButton
                label={saveMutation?.isPending ? "Saving..." : `Save ${drafts.length} Transaction${drafts.length > 1 ? "s" : ""}`}
                onPress={handleSaveAll}
                loading={saveMutation?.isPending}
              />
            )}
          </ScrollView>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: spacing.lg, paddingBottom: 40 },
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  aiBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  textarea: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.base, minHeight: 96, marginBottom: spacing.md, textAlignVertical: "top" },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  countBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  draftCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.sm, gap: 10 },
  draftTypeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  draftTypeLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 999 },
  draftInput: { borderBottomWidth: 1, paddingVertical: 6, fontSize: 15 },
  draftAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
});
