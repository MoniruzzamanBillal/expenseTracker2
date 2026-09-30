import { CATEGORY_ICON_OPTIONS } from "@/constants/CategoryIcon.constant";
import { usePatch, usePost } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TCategory } from "@/types/Category.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import FormField from "../shared/FormField";
import PrimaryButton from "../shared/PrimaryButton";
import Sheet from "../shared/Sheet";

type TProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  initialValue?: TCategory;
};

export default function CategoryFormModal({ open, setOpen, initialValue }: TProps) {
  const C = useTheme();
  const isEdit = !!initialValue;

  const [name, setName] = useState(initialValue?.name ?? "");
  const [icon, setIcon] = useState<string | undefined>(initialValue?.icon);

  useEffect(() => {
    if (open) {
      setName(initialValue?.name ?? "");
      setIcon(initialValue?.icon);
    }
  }, [open, initialValue]);

  const postMutation = usePost([["categories"]]);
  const patchMutation = usePatch([["categories"]]);
  const deleteMutation = usePatch([["categories"]]);
  const isPending = postMutation?.isPending || patchMutation?.isPending;

  const hideModal = () => setOpen(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Missing Field", text2: "Please enter a category name", position: "bottom" });
      return;
    }

    try {
      const payload = { name: name.trim(), icon };

      const result = isEdit
        ? await patchMutation?.mutateAsync({ url: `/categories/${initialValue!._id}`, payload })
        : await postMutation?.mutateAsync({ url: "/categories", payload });

      if (result?.success) {
        Toast.show({ type: "success", text1: result?.message, position: "top" });
        hideModal();
      }
      // On failure (including a 409 duplicate-name conflict), axiosInstance's
      // response interceptor has already shown a Toast with the server's own
      // message — nothing more to show here, and the modal stays open so the
      // user can fix the name.
    } catch (error) {
      console.log("error = ", error);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete category?", initialValue?.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deleteMutation?.mutateAsync({ url: `/categories/${initialValue?._id}/delete`, payload: {} });
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
        <Text style={[text.h3, { color: C?.text, marginBottom: spacing.md }]}>{isEdit ? "Edit category" : "New category"}</Text>

        <FormField label="Name" value={name} onChangeText={setName} placeholder="e.g. Food" inSheet />

        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[text.captionMd, { color: C?.textSecondary, marginBottom: spacing.xs + 1 }]}>Icon</Text>
          <View style={styles.grid}>
            {CATEGORY_ICON_OPTIONS.map((opt) => {
              const active = icon === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setIcon(opt)}
                  style={[styles.chip, { borderColor: active ? C?.accent : C?.border, backgroundColor: active ? C?.accentDim : "transparent" }]}
                >
                  <MaterialCommunityIcons name={opt} size={20} color={active ? C?.accentText : C?.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.actionRow}>
          {isEdit ? (
            <PrimaryButton label="Delete" onPress={confirmDelete} variant="destructive" style={{ flexGrow: 0, flexShrink: 0, minWidth: 100 }} height={spacing.field} />
          ) : null}
          <PrimaryButton label={isPending ? "Saving…" : isEdit ? "Save" : "Add Category"} onPress={handleSubmit} loading={isPending} style={{ flex: 1 }} height={spacing.field} />
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
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
