import EmptyState from "@/components/main/shared/EmptyState";
import { useDeleteData, useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TBudget } from "@/types/Budget.types";
import { TCategory } from "@/types/Category.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

export default function BudgetsPage() {
  const C = useTheme();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<TBudget | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: budgetsData,
    isLoading,
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
    (c) => !budgets.some((b) => b.categoryId === c._id),
  );

  const openCreate = () => {
    setEditBudget(undefined);
    setFormOpen(true);
  };

  const openEdit = (budget: TBudget) => {
    setEditBudget(budget);
    setFormOpen(true);
  };

  const handleDelete = (budget: TBudget) => {
    Alert.alert("Delete this budget?", budget.category.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deleteMutation.mutateAsync({
              url: `/budgets/${budget._id}`,
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
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={22}
              color={C.text}
            />
          </TouchableOpacity>
          <Text style={[text.navTitle, { color: C.text }]}>Budgets</Text>
          <View style={styles.backBtn} />
        </View>

        {!isLoading && categories.length === 0 ? (
          <EmptyState
            title="Set up categories first"
            subtitle="Add a category in Settings before you can set a budget"
          />
        ) : !isLoading && budgets.length === 0 ? (
          <EmptyState
            title="No budgets yet"
            subtitle="Set a limit for a category to track it here"
          />
        ) : (
          budgets.map((budget, i) => (
            <View
              key={budget._id}
              style={[
                styles.row,
                {
                  borderColor: C.border,
                  backgroundColor: C.surface,
                  marginBottom: i === budgets.length - 1 ? 0 : spacing.sm,
                },
              ]}
            >
              <View style={styles.rowTop}>
                <View style={[styles.icon, { backgroundColor: C.accentDim }]}>
                  <MaterialCommunityIcons
                    name={(budget.category.icon as any) ?? "shape"}
                    size={18}
                    color={C.accent}
                  />
                </View>
                <Text
                  style={[text.bodyMd, { color: C.text, flex: 1 }]}
                  numberOfLines={1}
                >
                  {budget.category.name}
                </Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => openEdit(budget)}
                    style={[
                      styles.actionButton,
                      { backgroundColor: C.accentDim },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={14}
                      color={C.accent}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(budget)}
                    style={[
                      styles.actionButton,
                      { backgroundColor: C.expenseBg },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="delete-outline"
                      size={14}
                      color={C.expense}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <BudgetProgressBar
                spent={budget.spent}
                limit={budget.monthlyLimit}
                percentage={budget.percentage}
                isOverLimit={budget.isOverLimit}
              />
            </View>
          ))
        )}

        {categories.length > 0 && (
          <TouchableOpacity
            onPress={openCreate}
            disabled={availableCategories.length === 0}
            activeOpacity={0.8}
            style={[
              styles.addButton,
              {
                borderColor: C.accentBorder,
                backgroundColor: C.accentDim,
                opacity: availableCategories.length === 0 ? 0.5 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons name="plus" size={16} color={C.accent} />
            <Text style={[text.bodyMd, { color: C.accent }]}>
              {availableCategories.length === 0
                ? "All your categories already have a budget"
                : "Set Budget"}
            </Text>
          </TouchableOpacity>
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
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  backBtn: { width: 28 },
  row: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
});
