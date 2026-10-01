import { usePost, usePostOutcome } from "@/hooks/useApi";
import { useEnqueuePendingTransactions } from "@/hooks/usePendingTransactions";
import { TransactionTypeConst } from "@/constants/TransactionType.constant";
import { TTransaction } from "@/types/Transaction.tyes";
import { createBatchId } from "@/utils/transactionQueue";
import { useTheme, text, spacing, radius } from "@/theme";
import CategoryPicker from "@/components/main/shared/CategoryPicker";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import FormField from "@/components/main/shared/FormField";
import TypeToggle from "@/components/main/shared/TypeToggle";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { formatAmount as fmt, formatTotal } from "@/utils/formatAmount";

type TDraftTransaction = TTransaction;

export default function SmartAddPage() {
  const C = useTheme();
  const router = useRouter();

  const [prompt, setPrompt] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<TDraftTransaction[] | null>(null);
  const [savedLines, setSavedLines] = useState<{ title: string; amount: number; type: string }[] | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseMutation = usePost([[""]]);
  const saveMutation = usePostOutcome([
    ["daily-transaction"],
    ["monthly-transaction"],
    ["weekly-transaction"],
    ["yearly-transaction"],
    ["budgets"],
  ]);

  const enqueuePendingTransactions = useEnqueuePendingTransactions();

  const handleParse = async () => {
    if (!prompt?.trim()) return;

    Keyboard.dismiss();
    setParseError(null);

    try {
      const result = await parseMutation?.mutateAsync({
        url: "/transactions/manage-money",
        payload: { prompt },
      });

      if (result?.success) {
        const parsed = result?.data ?? [];
        setDrafts(parsed);
        setExpandedIndex(parsed.length > 0 ? 0 : null);
        if (parsed.length === 0) setParseError("empty");
      }
    } catch (error: any) {
      console.log("error = ", error);
      setParseError(error?.message ?? "AI returned invalid transaction data");
    }
  };

  const updateDraft = (i: number, key: keyof TDraftTransaction, value: string | number | null) => {
    setDrafts((prev) => (prev ? prev.map((d, idx) => (idx === i ? { ...d, [key]: value } : d)) : prev));
  };

  const removeDraft = (i: number) => {
    Alert.alert("Discard entry?", "This one won't be saved", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => setDrafts((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev)),
      },
    ]);
  };

  const handleSaveAll = async () => {
    if (!drafts?.length) return;

    try {
      // spec 22 / G2 — include categoryId in the online save payload, but omit
      // the key entirely on an uncategorized draft rather than sending null
      // (spec 28).
      const outcome = await saveMutation?.mutateAsync({
        url: "/transactions/many-transaction",
        payload: drafts.map((d) => ({
          type: d.type,
          title: d.title,
          amount: d.amount,
          description: d.description ?? " ",
          ...(d.categoryId ? { categoryId: d.categoryId } : {}),
        })),
      });

      if (outcome?.ok) {
        setSavedLines(drafts.map((d) => ({ title: d.title, amount: d.amount, type: d.type })));
        setPrompt(null);
        setDrafts(null);
      } else if (outcome?.offline) {
        // Offline-queue path intentionally omits categoryId (spec 13 scope / spec 22 scope).
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

        setSavedLines(drafts.map((d) => ({ title: d.title, amount: d.amount, type: d.type })));
        setPrompt(null);
        setDrafts(null);
        Toast.show({ type: "success", text1: "Saved locally", text2: "It will sync when you're back online", position: "top" });
      }
      // A server rejection keeps the drafts on screen so they can be corrected;
      // the interceptor has already toasted why. Only a no-response failure
      // queues locally.
    } catch (error) {
      console.log("error = ", error);
      Toast.show({ type: "error", text1: "Something went wrong!!", position: "top" });
    }
  };

  // S4 — saved success screen
  if (savedLines) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C?.background }]} edges={["top"]}>
        <View style={[styles.content, { paddingHorizontal: spacing.screenPad, paddingTop: 100 }]}>
          <Ionicons name="checkmark-circle-outline" size={44} color={C?.income} />
          <Text style={[text.h1, { color: C?.text, marginTop: spacing.md }]}>
            {savedLines.length} {savedLines.length === 1 ? "entry" : "entries"} saved
          </Text>
          <Text style={[text.body, { color: C?.textSecondary, marginTop: 4 }]}>They&apos;re in today&apos;s list now.</Text>

          <View style={[styles.savedCard, { backgroundColor: C?.surface, borderColor: C?.border }]}>
            {savedLines.map((s, i) => (
              <View key={i} style={[styles.savedLine, i !== savedLines.length - 1 && { borderBottomWidth: 1, borderBottomColor: C?.divider }]}>
                <Text style={[text.body, { color: C?.text, flex: 1 }]} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={[text.bodyMd, { color: s.type === TransactionTypeConst.income ? C?.income : C?.expense }]}>
                  {s.type === TransactionTypeConst.income ? "+" : "−"}৳{fmt(s.amount)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.savedActions}>
            <PrimaryButton label="View today" onPress={() => router?.push("/")} variant="outline" style={{ flex: 1 }} />
            <PrimaryButton label="Add more" onPress={() => setSavedLines(null)} variant="ghost" icon={<Ionicons name="add" size={18} color={C?.textSecondary} />} style={{ flex: 1 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C?.background }]} edges={["top"]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        bottomOffset={30}
        extraKeyboardSpace={10}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <TouchableOpacity onPress={() => router?.back()} hitSlop={8} style={{ marginLeft: -10, marginRight: 4 }}>
            <Ionicons name="chevron-back" size={22} color={C?.text} />
          </TouchableOpacity>
          <Text style={[text.h2, { color: C?.text }]}>{drafts !== null ? "Review" : "Smart Add"}</Text>
        </View>

        {drafts !== null && drafts.length > 0 ? (
          <View style={styles.summaryRow}>
            <Text style={[text.bodySm, { color: C?.textSecondary }]}>
              {drafts.length} draft{drafts.length > 1 ? "s" : ""}
            </Text>
            <Text style={[text.bodySm, { color: C?.income }]}>
              In +৳{formatTotal(drafts.filter((d) => d.type === TransactionTypeConst.income).reduce((s, d) => s + d.amount, 0))}
            </Text>
            <Text style={[text.bodySm, { color: C?.expense }]}>
              Expense −৳{formatTotal(drafts.filter((d) => d.type === TransactionTypeConst.expense).reduce((s, d) => s + d.amount, 0))}
            </Text>
          </View>
        ) : null}

        {drafts === null ? (
          <>
            <TextInput
              value={prompt || ""}
              onChangeText={setPrompt}
              multiline
              style={[styles.textarea, { backgroundColor: C?.surface, borderColor: C?.accent, color: C?.text }, text.body]}
              placeholder="Spent 250 on coffee and 450 on lunch, paid 1,200 for the electricity bill…"
              placeholderTextColor={C?.placeholder}
            />
            <Text style={[text.bodySm, { color: C?.textSecondary, marginBottom: spacing.lg }]}>You&apos;ll review every entry before anything is saved.</Text>

            {parseError && parseError !== "empty" ? (
              <View style={[styles.errorCard, { backgroundColor: C?.expenseBg }]}>
                <Ionicons name="alert-circle-outline" size={19} color={C?.expense} />
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyMd, { color: C?.text }]}>Couldn&apos;t find entries</Text>
                  <Text style={[text.bodySm, { color: C?.textSecondary, marginTop: 2 }]}>{parseError}</Text>
                </View>
              </View>
            ) : null}
            {parseError === "empty" ? (
              <View style={[styles.errorCard, { backgroundColor: C?.expenseBg }]}>
                <Ionicons name="alert-circle-outline" size={19} color={C?.expense} />
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyMd, { color: C?.text }]}>Couldn&apos;t find entries</Text>
                  <Text style={[text.bodySm, { color: C?.textSecondary, marginTop: 2 }]}>No amounts found in that text.</Text>
                </View>
              </View>
            ) : null}

            <PrimaryButton
              label={parseMutation?.isPending ? "Reading your text…" : "Find entries"}
              onPress={handleParse}
              loading={parseMutation?.isPending}
              disabled={!prompt?.trim()}
              variant="outline"
              icon={!parseMutation?.isPending ? <Ionicons name="sparkles-outline" size={18} color={C?.accent} /> : undefined}
              height={spacing.cta}
            />
          </>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {drafts.map((draft, i) => {
              const isIncome = draft.type === TransactionTypeConst.income;
              const isExpanded = expandedIndex === i;
              const hasCategory = !!draft.categoryId;

              if (!isExpanded) {
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setExpandedIndex(i)}
                    activeOpacity={0.8}
                    style={[styles.draftSummary, { backgroundColor: C?.surface, borderColor: C?.border }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.draftSummaryTitleRow}>
                        <Text style={[text.bodyMd, { color: C?.text, flexShrink: 1 }]} numberOfLines={1}>
                          {draft.title}
                        </Text>
                        <Text style={[text.bodyMd, { color: isIncome ? C?.income : C?.expense }]}>
                          {isIncome ? "+" : "−"}৳{fmt(draft.amount)}
                        </Text>
                      </View>
                      {draft.description ? (
                        <Text style={[text.bodySm, { color: C?.textSecondary }]} numberOfLines={1}>
                          {draft.description}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.draftCatChip,
                          hasCategory ? { borderColor: C?.accentBorder, backgroundColor: C?.accentDim } : { borderColor: C?.warning, borderStyle: "dashed" },
                        ]}
                      >
                        <Text style={[text.caption, { color: hasCategory ? C?.accentText : C?.warning }]}>{hasCategory ? "Categorized" : "No category"}</Text>
                      </View>
                    </View>
                    <Ionicons name="create-outline" size={18} color={C?.textSecondary} />
                  </TouchableOpacity>
                );
              }

              return (
                <View key={i} style={[styles.draftCard, { backgroundColor: C?.surface, borderColor: C?.accent }]}>
                  <TypeToggle value={draft.type} onChange={(v) => updateDraft(i, "type", v)} />

                  <View style={styles.draftRow}>
                    <View style={[styles.draftAmountBox, { backgroundColor: C?.background, borderColor: C?.border }]}>
                      <Text style={[text.bodySm, { color: C?.textSecondary }]}>৳</Text>
                      <TextInput
                        value={String(draft.amount)}
                        onChangeText={(v) => updateDraft(i, "amount", parseFloat(v.replace(/[^0-9.]/g, "")) || 0)}
                        keyboardType="decimal-pad"
                        style={[text.bodyMd, { color: C?.text, flex: 1, padding: 0 }]}
                      />
                    </View>
                    <FormField label="" value={draft.title} onChangeText={(v) => updateDraft(i, "title", v)} inputStyle={{ height: 42 }} />
                  </View>

                  <FormField label="" value={draft.description ?? ""} onChangeText={(v) => updateDraft(i, "description", v)} placeholder="Add a note…" inputStyle={{ height: 42 }} />

                  <CategoryPicker value={draft.categoryId ?? null} onChange={(v) => updateDraft(i, "categoryId", v)} />

                  <View style={styles.draftActionsRow}>
                    <TouchableOpacity onPress={() => removeDraft(i)} style={styles.discardBtn}>
                      <Ionicons name="trash-outline" size={16} color={C?.expense} />
                      <Text style={[text.bodySm, { color: C?.expense }]}>Discard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setExpandedIndex(null)} style={[styles.doneBtn, { borderColor: C?.accent }]}>
                      <Ionicons name="checkmark" size={16} color={C?.accent} />
                      <Text style={[text.bodySm, { color: C?.accent }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {drafts.length === 0 ? (
              <Text style={[text.body, { color: C?.textSecondary, textAlign: "center", marginVertical: spacing.xl }]}>No amounts found in that text.</Text>
            ) : null}

            {drafts.length > 0 && (
              <PrimaryButton
                label={saveMutation?.isPending ? "Saving…" : `Save ${drafts.length} ${drafts.length > 1 ? "entries" : "entry"}`}
                onPress={handleSaveAll}
                loading={saveMutation?.isPending}
                height={spacing.cta}
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
  content: { flexGrow: 1, paddingTop: spacing.xs, paddingBottom: 40 },
  heading: { flexDirection: "row", alignItems: "center", height: 44, marginBottom: spacing.sm },
  summaryRow: { flexDirection: "row", gap: spacing.base, marginBottom: spacing.sm },
  textarea: { borderWidth: 1, borderRadius: radius.card, padding: spacing.base, minHeight: 140, marginBottom: spacing.sm, textAlignVertical: "top" },
  errorCard: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.base },
  draftSummary: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderWidth: 1, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.sm },
  draftSummaryTitleRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  draftCatChip: { alignSelf: "flex-start", marginTop: spacing.xs, height: 22, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  draftCard: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  draftRow: { flexDirection: "row", gap: spacing.sm },
  draftAmountBox: { width: 108, height: 42, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: spacing.sm },
  draftActionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  discardBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 36 },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  savedCard: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: spacing.base, marginTop: spacing.md },
  savedLine: { flexDirection: "row", alignItems: "center", height: 42 },
  savedActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.base },
});
