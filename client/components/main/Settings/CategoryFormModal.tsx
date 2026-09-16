import { CATEGORY_ICON_OPTIONS } from "@/constants/CategoryIcon.constant";
import { usePatch, usePost } from "@/hooks/useApi";
import { radius, spacing, useTheme } from "@/theme";
import { TCategory } from "@/types/Category.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Modal, Portal } from "react-native-paper";
import Toast from "react-native-toast-message";
import FormField from "../shared/FormField";
import PrimaryButton from "../shared/PrimaryButton";

type TProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  initialValue?: TCategory;
};

export default function CategoryFormModal({
  open,
  setOpen,
  initialValue,
}: TProps) {
  const C = useTheme();
  const isEdit = !!initialValue;
  const { width } = useWindowDimensions();

  const [name, setName] = useState(initialValue?.name ?? "");
  const [icon, setIcon] = useState<string | undefined>(initialValue?.icon);

  const ICON_COLUMNS = 6;
  const modalInnerWidth =
    width - spacing.xl * 2 - spacing.lg * 2 - StyleSheet.hairlineWidth * 2;
  const chipSize =
    (modalInnerWidth - spacing.sm * (ICON_COLUMNS - 1)) / ICON_COLUMNS;

  useEffect(() => {
    if (open) {
      setName(initialValue?.name ?? "");
      setIcon(initialValue?.icon);
    }
  }, [open, initialValue]);

  const postMutation = usePost([["categories"]]);
  const patchMutation = usePatch([["categories"]]);
  const isPending = postMutation.isPending || patchMutation.isPending;

  const hideModal = () => setOpen(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Field",
        text2: "Please enter a category name",
        position: "bottom",
      });
      return;
    }

    try {
      const payload = { name: name.trim(), icon };

      const result = isEdit
        ? await patchMutation.mutateAsync({
            url: `/categories/${initialValue!._id}`,
            payload,
          })
        : await postMutation.mutateAsync({ url: "/categories", payload });

      if (result?.success) {
        Toast.show({
          type: "success",
          text1: result?.message,
          position: "top",
        });
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
            <FormField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Food"
            />

            <View style={{ marginBottom: spacing.lg }}>
              <View style={styles.grid}>
                {CATEGORY_ICON_OPTIONS.map((opt) => {
                  const active = icon === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setIcon(opt)}
                      style={[
                        styles.chip,
                        {
                          width: chipSize,
                          height: chipSize,
                          borderColor: active ? C.accent : C.border,
                          backgroundColor: active
                            ? C.accentDim
                            : "transparent",
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={opt}
                        size={20}
                        color={active ? C.accent : C.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <PrimaryButton
              label={
                isPending
                  ? "Saving..."
                  : isEdit
                    ? "Save Changes"
                    : "Add Category"
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
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
