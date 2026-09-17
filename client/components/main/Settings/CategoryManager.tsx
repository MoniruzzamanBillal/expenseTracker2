import EmptyState from "@/components/main/shared/EmptyState";
import { useFetchData, usePatch } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TCategory } from "@/types/Category.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import CategoryFormModal from "./CategoryFormModal";

export default function CategoryManager() {
  const C = useTheme();
  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<TCategory | undefined>(
    undefined,
  );

  const { data, isLoading } = useFetchData<TCategory[]>(
    ["categories"],
    "/categories",
  );
  const deleteMutation = usePatch([["categories"]]);

  const categories = data?.data ?? [];

  const openCreate = () => {
    setEditCategory(undefined);
    setFormOpen(true);
  };

  const openEdit = (category: TCategory) => {
    setEditCategory(category);
    setFormOpen(true);
  };

  const handleDelete = (category: TCategory) => {
    Alert.alert("Delete category?", category.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deleteMutation.mutateAsync({
              url: `/categories/${category._id}/delete`,
              payload: {},
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
    <View>
      {!isLoading && categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          subtitle="Add one to start tagging your transactions"
        />
      ) : (
        categories.map((category, i) => (
          <View
            key={category._id}
            style={[
              styles.row,
              {
                borderColor: C.border,
                backgroundColor: C.surface,
                marginBottom: i === categories.length - 1 ? 0 : spacing.sm,
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: C.accentDim }]}>
              <MaterialCommunityIcons
                name={(category.icon as any) ?? "shape"}
                size={18}
                color={C.accent}
              />
            </View>
            <View style={styles.info}>
              <Text
                style={[text.bodyMd, { color: C.text }]}
                numberOfLines={1}
              >
                {category.name}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => openEdit(category)}
                style={[styles.actionButton, { backgroundColor: C.accentDim }]}
              >
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={14}
                  color={C.accent}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(category)}
                style={[styles.actionButton, { backgroundColor: C.expenseBg }]}
              >
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={14}
                  color={C.expense}
                />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <TouchableOpacity
        onPress={openCreate}
        activeOpacity={0.8}
        style={[
          styles.addButton,
          { borderColor: C.accentBorder, backgroundColor: C.accentDim },
        ]}
      >
        <MaterialCommunityIcons name="plus" size={16} color={C.accent} />
        <Text style={[text.bodyMd, { color: C.accent }]}>Add Category</Text>
      </TouchableOpacity>

      {formOpen && (
        <CategoryFormModal
          open={formOpen}
          setOpen={setFormOpen}
          initialValue={editCategory}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
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
    marginTop: spacing.sm,
  },
});
