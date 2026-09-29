import FormField from "@/components/main/shared/FormField";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import Sheet from "@/components/main/shared/Sheet";
import { useDeleteData, useFetchData, usePatch, usePost } from "@/hooks/useApi";
import { spacing, text, useTheme } from "@/theme";
import { TBudget } from "@/types/Budget.types";
import { TCategory } from "@/types/Category.types";
import { TBreakdownEntry } from "@/components/main/shared/CategoryBreakdown";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import { formatTotal } from "@/utils/formatAmount";

type TProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  initialValue?: TBudget;
  availableCategories: TCategory[];
};

export default function BudgetFormModal({ open, setOpen, initialValue, availableCategories }: TProps) {
  const C = useTheme();
  const isEdit = !!initialValue;

  const [categoryId, setCategoryId] = useState<string | null>(initialValue?.categoryId ?? null);
  const [limit, setLimit] = useState(initialValue ? String(initialValue?.monthlyLimit) : "");

  useEffect(() => {
    if (open) {
      setCategoryId(initialValue?.categoryId ?? null);
      setLimit(initialValue ? String(initialValue?.monthlyLimit) : "");
    }
  }, [open, initialValue]);

  const createMutation = usePost([["budgets"]]);
  const updateMutation = usePatch([["budgets"]]);
  const deleteMutation = useDeleteData([["budgets"]]);
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Diverged: "spent this month" reference for the category being picked
  // comes from the cached monthly categoryBreakdown (already fetched by
  // Activity), not a fresh dedicated call.
  const { data: monthlyData } = useFetchData<{ categoryBreakdown: TBreakdownEntry[] }>(
    ["monthly-transaction", `monthly-transaction-${new Date().getMonth() + 1}`, String(new Date().getMonth() + 1)],
    `/transactions/monthly-transaction?targetMonth=${new Date().getMonth() + 1}`,
  );
  const spentThisMonth = useMemo(() => {
    const key = categoryId;
    if (!key) return null;
    const entry = monthlyData?.data?.categoryBreakdown?.find((c) => c?.categoryId === key);
    return entry?.expense ?? 0;
  }, [monthlyData, categoryId]);

  const hideModal = () => setOpen(false);

  const handleLimitChange = (value: string) => {
    const regex = /^\d+(\.\d{0,2})?$/;
    if (value === "" || regex.test(value)) {
      setLimit(value);
    } else {
      Toast.show({ type: "error", text1: "Invalid Amount", text2: "Only numeric values are allowed (e.g. 5000 or 5000.50)", position: "bottom" });
    }
  };

  const handleSubmit = async () => {
    if (!isEdit && !categoryId) {
      Toast.show({ type: "error", text1: "Missing Field", text2: "Please pick a category", position: "bottom" });
      return;
    }
    if (!limit.trim()) {
      Toast.show({ type: "error", text1: "Missing Field", text2: "Please enter a monthly limit", position: "bottom" });
      return;
    }

    try {
      const result = isEdit
        ? await updateMutation.mutateAsync({ url: `/budgets/${initialValue!._id}`, payload: { monthlyLimit: parseFloat(limit) } })
        : await createMutation.mutateAsync({ url: "/budgets", payload: { categoryId, monthlyLimit: parseFloat(limit) } });

      if (result?.success) {
        Toast.show({ type: "success", text1: result?.message, position: "top" });
        hideModal();
      }
      // On failure (including a 409 category-already-budgeted conflict),
      // axiosInstance's response interceptor already showed a Toast with the
      // server's own message — modal stays open so the user can adjust.
    } catch (error) {
      console.log("error = ", error);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete this budget?", initialValue?.category?.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deleteMutation.mutateAsync({ url: `/budgets/${initialValue?._id}` });
            if (result?.success) {
              Toast.show({ type: "success", text1: result?.message, position: "top" });
              hideModal();
            }
          } catch (error) {
            console.log("error = ", error);
          }
        },
      },
    ]);
  };

  return (
    <Sheet visible={open} onDismiss={hideModal}>
      <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }} bottomOffset={20} extraKeyboardSpace={10} showsVerticalScrollIndicator={false}>
        <Text style={[text.h3, { color: C.text, marginBottom: spacing.md }]}>{isEdit ? "Edit budget" : "New budget"}</Text>

        {isEdit ? (
          <View style={[styles.lockedCategory, { borderColor: C.border, backgroundColor: C.surface2 }]}>
            <MaterialCommunityIcons name={(initialValue?.category?.icon as any) ?? "shape"} size={18} color={C.textSecondary} />
            <Text style={[text.bodyMd, { color: C.text }]}>{initialValue?.category?.name}</Text>
          </View>
        ) : (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[text.captionMd, { color: C.textSecondary, marginBottom: spacing.xs }]}>Category · only ones without a budget</Text>
            <View style={styles.grid}>
              {availableCategories.map((cat) => {
                const active = categoryId === cat?._id;
                return (
                  <TouchableOpacity
                    key={cat?._id}
                    onPress={() => setCategoryId(cat?._id)}
                    style={[styles.chip, { borderColor: active ? C.accent : C.border, backgroundColor: active ? C.accentDim : "transparent" }]}
                  >
                    {cat?.icon ? <MaterialCommunityIcons name={cat?.icon as any} size={14} color={active ? C.accentText : C.textSecondary} /> : null}
                    <Text style={[text.caption, { color: active ? C.accentText : C.textSecondary }]}>{cat?.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <FormField label="Monthly limit" value={limit} onChangeText={handleLimitChange} keyboardType="decimal-pad" placeholder="0.00" inSheet inputStyle={{ fontSize: 20, fontWeight: "500" }} />

        {categoryId && spentThisMonth !== null ? (
          <Text style={[text.caption, { color: C.textMuted, marginTop: -spacing.md, marginBottom: spacing.lg }]}>
            Spent on {isEdit ? initialValue?.category?.name : availableCategories.find((c) => c?._id === categoryId)?.name} so far this month: ৳
            {formatTotal(spentThisMonth)}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          {isEdit ? (
            <PrimaryButton label="Delete" onPress={confirmDelete} variant="destructive" style={{ flex: 0, paddingHorizontal: spacing.base }} height={spacing.field} />
          ) : null}
          <PrimaryButton label={isPending ? "Saving…" : isEdit ? "Save changes" : "Save budget"} onPress={handleSubmit} loading={isPending} style={{ flex: 1 }} height={spacing.field} />
        </View>
      </KeyboardAwareScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: 17,
    borderWidth: 1,
  },
  lockedCategory: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
