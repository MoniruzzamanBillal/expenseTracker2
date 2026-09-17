import FormField from "@/components/main/shared/FormField";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import { usePatch, usePost } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TBudget } from "@/types/Budget.types";
import { TCategory } from "@/types/Category.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Modal, Portal } from "react-native-paper";
import Toast from "react-native-toast-message";

type TProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  initialValue?: TBudget;
  availableCategories: TCategory[];
};

export default function BudgetFormModal({
  open,
  setOpen,
  initialValue,
  availableCategories,
}: TProps) {
  const C = useTheme();
  const isEdit = !!initialValue;

  const [categoryId, setCategoryId] = useState<string | null>(
    initialValue?.categoryId ?? null,
  );
  const [limit, setLimit] = useState(
    initialValue ? String(initialValue.monthlyLimit) : "",
  );

  useEffect(() => {
    if (open) {
      setCategoryId(initialValue?.categoryId ?? null);
      setLimit(initialValue ? String(initialValue.monthlyLimit) : "");
    }
  }, [open, initialValue]);

  const createMutation = usePost([["budgets"]]);
  const updateMutation = usePatch([["budgets"]]);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const hideModal = () => setOpen(false);

  const handleLimitChange = (value: string) => {
    const regex = /^\d+(\.\d{0,2})?$/;
    if (value === "" || regex.test(value)) {
      setLimit(value);
    } else {
      Toast.show({
        type: "error",
        text1: "Invalid Amount",
        text2: "Only numeric values are allowed (e.g. 5000 or 5000.50)",
        position: "bottom",
      });
    }
  };

  const handleSubmit = async () => {
    if (!isEdit && !categoryId) {
      Toast.show({
        type: "error",
        text1: "Missing Field",
        text2: "Please pick a category",
        position: "bottom",
      });
      return;
    }
    if (!limit.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Field",
        text2: "Please enter a monthly limit",
        position: "bottom",
      });
      return;
    }

    try {
      const result = isEdit
        ? await updateMutation.mutateAsync({
            url: `/budgets/${initialValue!._id}`,
            payload: { monthlyLimit: parseFloat(limit) },
          })
        : await createMutation.mutateAsync({
            url: "/budgets",
            payload: { categoryId, monthlyLimit: parseFloat(limit) },
          });

      if (result?.success) {
        Toast.show({
          type: "success",
          text1: result?.message,
          position: "top",
        });
        hideModal();
      }
      // On failure (including a 409 category-already-budgeted conflict),
      // axiosInstance's response interceptor already showed a Toast with the
      // server's own message — modal stays open so the user can adjust.
    } catch (error) {
      console.log("error = ", error);
    }
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
            {isEdit ? (
              <View
                style={[
                  styles.lockedCategory,
                  { borderColor: C.border, backgroundColor: C.surface2 },
                ]}
              >
                <MaterialCommunityIcons
                  name={(initialValue?.category?.icon as any) ?? "shape"}
                  size={18}
                  color={C.textSecondary}
                />
                <Text style={[text.bodyMd, { color: C.text }]}>
                  {initialValue?.category?.name}
                </Text>
              </View>
            ) : (
              <View style={[styles.grid, { marginBottom: spacing.lg }]}>
                {availableCategories.map((cat) => {
                  const active = categoryId === cat._id;
                  return (
                    <TouchableOpacity
                      key={cat._id}
                      onPress={() => setCategoryId(cat._id)}
                      style={[
                        styles.chip,
                        {
                          borderColor: active ? C.accent : C.border,
                          backgroundColor: active
                            ? C.accentDim
                            : "transparent",
                        },
                      ]}
                    >
                      {cat.icon ? (
                        <MaterialCommunityIcons
                          name={cat.icon as any}
                          size={14}
                          color={active ? C.accent : C.textSecondary}
                        />
                      ) : null}
                      <Text
                        style={[
                          text.caption,
                          { color: active ? C.accent : C.textSecondary },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <FormField
              label="Monthly Limit"
              value={limit}
              onChangeText={handleLimitChange}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />

            <PrimaryButton
              label={
                isPending
                  ? "Saving..."
                  : isEdit
                    ? "Save Changes"
                    : "Set Budget"
              }
              onPress={handleSubmit}
              loading={isPending}
            />
          </View>
        </KeyboardAwareScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  pageWrapper: {
    width: "100%" as const,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  lockedCategory: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
});
