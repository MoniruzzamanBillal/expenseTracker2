import EmptyState from "@/components/main/shared/EmptyState";
import ErrorState from "@/components/main/shared/ErrorState";
import { useDeleteData, useFetchData } from "@/hooks/useApi";
import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { TBudget } from "@/types/Budget.types";
import { TCategory } from "@/types/Category.types";
import { formatTotal as fmt } from "@/utils/formatAmount";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import BudgetFormModal from "./BudgetFormModal";
import BudgetProgressBar from "./BudgetProgressBar";

const NEAR_LIMIT_THRESHOLD = 80;
const CURRENT_MONTH_LABEL = new Date().toLocaleDateString("en-US", {
  month: "long",
});

function tone(budget: TBudget): "over" | "near" | "ontrack" {
  if (budget?.isOverLimit) return "over";
  if (budget?.percentage >= NEAR_LIMIT_THRESHOLD) return "near";
  return "ontrack";
}

export default function BudgetsPage() {
  const C = useTheme();
  const dark = C.statusBarStyle === "light";
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<TBudget | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: budgetsData,
    isLoading,
    isError,
    error,
    refetch: refetchBudgets,
  } = useFetchData<TBudget[]>(["budgets"], "/budgets");
  // No dedicated useCategories hook per spec 12/13's own decision — see
  // ai context/specs/19-fix-stale-usecategories-reference-in-budgets-spec.md.
  const { data: categoriesData, refetch: refetchCategories } = useFetchData<
    TCategory[]
  >(["categories"], "/categories");
  const deleteMutation = useDeleteData([["budgets"]]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBudgets(), refetchCategories()]);
    setRefreshing(false);
  };

  const budgets = budgetsData?.data ?? [];
  const categories = categoriesData?.data ?? [];
  const availableCategories = categories.filter(
    (c) => !budgets.some((b) => b?.categoryId === c?._id),
  );

  const toneRank = { over: 0, near: 1, ontrack: 2 };
  const sortedBudgets = [...budgets].sort(
    (a, b) => toneRank[tone(a)] - toneRank[tone(b)],
  );

  const totalSpent = budgets.reduce((s, b) => s + b?.spent, 0);
  const totalLimit = budgets.reduce((s, b) => s + b?.monthlyLimit, 0);
  const overCount = budgets.filter((b) => tone(b) === "over").length;
  const nearCount = budgets.filter((b) => tone(b) === "near").length;
  const onTrackCount = budgets.filter((b) => tone(b) === "ontrack").length;

  const openCreate = () => {
    setEditBudget(undefined);
    setFormOpen(true);
  };

  const openEdit = (budget: TBudget) => {
    setEditBudget(budget);
    setFormOpen(true);
  };

  const handleDelete = (budget: TBudget) => {
    Alert.alert("Delete this budget?", budget?.category?.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deleteMutation.mutateAsync({
              url: `/budgets/${budget?._id}`,
            });
            if (result?.success) {
              Toast.show({
                type: "success",
                text1: result?.message,
                position: "top",
              });
            }
          } catch (error) {
            console.log("error = ", error);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: C.background }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.screenPad },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.accent}
          />
        }
      >
        <View style={styles.nav}>
          <View>
            <Text style={[text.kicker, { color: C.textSecondary }]}>
              {CURRENT_MONTH_LABEL}
            </Text>
            <Text style={[text.h2, { color: C.text }]}>Budgets</Text>
          </View>
          {categories.length > 0 ? (
            <TouchableOpacity
              onPress={openCreate}
              disabled={availableCategories.length === 0}
              style={[
                styles.addBtn,
                {
                  borderColor: C.accent,
                  opacity: availableCategories.length === 0 ? 0.45 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={20} color={C.accent} />
            </TouchableOpacity>
          ) : null}
        </View>

        {isError ? (
          <ErrorState
            title="Couldn't load budgets"
            message={(error as any)?.message ?? "Network Error"}
            onRetry={refetchBudgets}
          />
        ) : isLoading ? (
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: C.surface },
              elevation(C, dark).glow,
            ]}
          >
            <View
              style={[
                styles.skelBar,
                { backgroundColor: C.skeleton, width: 160 },
              ]}
            />
            <View
              style={[
                styles.skelBar,
                {
                  backgroundColor: C.skeleton,
                  width: 100,
                  height: 30,
                  marginTop: spacing.sm,
                },
              ]}
            />
          </View>
        ) : !categories.length ? (
          <EmptyState
            title="No categories yet"
            subtitle="Add a category in Settings first — budgets are set per category."
            icon="pie-chart-outline"
            actionLabel="Go to Settings"
            onAction={() => router.push("/settings")}
          />
        ) : budgets.length === 0 ? (
          <EmptyState
            title="No budgets yet"
            subtitle="Put a monthly limit on a category and its spend shows up here against that limit."
            icon="pie-chart-outline"
            actionLabel="Set a budget"
            onAction={openCreate}
          />
        ) : (
          <>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: C.surface },
                elevation(C, dark).glow,
              ]}
            >
              <Text
                style={[
                  text.kicker,
                  styles.summaryKicker,
                  { color: C.textSecondary },
                ]}
              >
                Spent against {budgets.length} budget
                {budgets.length > 1 ? "s" : ""}
              </Text>
              <View style={styles.summaryAmountRow}>
                <Text
                  style={[
                    text.amountLg,
                    styles.summaryAmount,
                    { color: C.text },
                  ]}
                >
                  ৳{fmt(totalSpent)}
                </Text>
                <Text
                  style={[
                    text.caption,
                    styles.summaryCaption,
                    { color: C.textSecondary },
                  ]}
                >
                  of ৳{fmt(totalLimit)}
                </Text>
              </View>
              <View
                style={[styles.summaryTrack, { backgroundColor: C.surface2 }]}
              >
                <View
                  style={[
                    styles.summaryFill,
                    {
                      width: `${totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0}%`,
                      backgroundColor: C.accent,
                    },
                  ]}
                />
              </View>
              <View style={styles.statusRow}>
                {overCount > 0 ? (
                  <Text
                    style={[
                      text.caption,
                      styles.summaryCaption,
                      { color: C.expense },
                    ]}
                  >
                    {overCount} over
                  </Text>
                ) : null}
                {nearCount > 0 ? (
                  <Text
                    style={[
                      text.caption,
                      styles.summaryCaption,
                      { color: C.warning },
                    ]}
                  >
                    {nearCount} near limit
                  </Text>
                ) : null}
                {onTrackCount > 0 ? (
                  <Text
                    style={[
                      text.caption,
                      styles.summaryCaption,
                      { color: C.textSecondary },
                    ]}
                  >
                    {onTrackCount} on track
                  </Text>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.rowsCard,
                { backgroundColor: C.surface, borderColor: C.border },
              ]}
            >
              {sortedBudgets.map((budget, i) => {
                const t = tone(budget);
                return (
                  <View
                    key={budget?._id}
                    style={[
                      styles.row,
                      i !== sortedBudgets.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: C.divider,
                      },
                    ]}
                  >
                    <View style={styles.rowTop}>
                      <View
                        style={[styles.icon, { backgroundColor: C.accentDim }]}
                      >
                        <MaterialCommunityIcons
                          name={(budget?.category?.icon as any) ?? "shape"}
                          size={18}
                          color={C.accentText}
                        />
                      </View>
                      <Text
                        style={[text.bodyMd, { color: C.text, flex: 1 }]}
                        numberOfLines={1}
                      >
                        {budget?.category?.name}
                      </Text>
                      {t !== "ontrack" ? (
                        <View
                          style={[
                            styles.tag,
                            {
                              backgroundColor:
                                t === "over" ? C.expenseBg : C.warningBg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              text.caption,
                              {
                                color: t === "over" ? C.expense : C.warning,
                                fontSize: 10,
                              },
                            ]}
                          >
                            {t === "over" ? "OVER" : "NEAR LIMIT"}
                          </Text>
                        </View>
                      ) : null}
                      {/* Both were textSecondary, so the destructive action looked
                          exactly like the safe one. Now the same pairing the swipe
                          panes on TransactionCard use: edit on the accent, delete
                          on the expense red. C.accent rather than C.accentText
                          because these sit on C.surface, not on an accentDim
                          chip — it is the token the add button on this same page
                          already uses. */}
                      <TouchableOpacity
                        onPress={() => openEdit(budget)}
                        hitSlop={8}
                        style={{ marginLeft: spacing.sm }}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={C.accent}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(budget)}
                        hitSlop={8}
                        style={{ marginLeft: spacing.sm }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={C.expense}
                        />
                      </TouchableOpacity>
                    </View>

                    <BudgetProgressBar
                      spent={budget?.spent}
                      limit={budget?.monthlyLimit}
                      percentage={budget?.percentage}
                      isOverLimit={budget?.isOverLimit}
                    />
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {formOpen && (
        <BudgetFormModal
          open={formOpen}
          setOpen={setFormOpen}
          initialValue={editBudget}
          availableCategories={availableCategories}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    marginBottom: spacing.base,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    borderRadius: radius.card,
    padding: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  // The scale jumps 40 (amountLg) straight to 18, so the headline overrides
  // amountLg's metrics rather than reaching for another token — medium weight
  // and tabular-nums still come from it, only size, leading and tracking
  // change. Matches Activity's net cards.
  summaryAmount: { fontSize: 23, lineHeight: 27, letterSpacing: -0.46 },
  // Label and status counts step below their tokens too, so the card shrinks
  // as one block instead of the headline pulling away from it.
  summaryKicker: { fontSize: 9, lineHeight: 12, letterSpacing: 0.81 },
  summaryCaption: { fontSize: 10, lineHeight: 14 },
  summaryAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  summaryTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  summaryFill: { height: "100%", borderRadius: 3 },
  statusRow: { flexDirection: "row", gap: spacing.md },
  skelBar: { height: 12, borderRadius: 3 },
  rowsCard: { borderRadius: radius.card, borderWidth: 1 },
  row: { padding: spacing.md, gap: spacing.sm },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tag: {
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});
