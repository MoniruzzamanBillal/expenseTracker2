import EmptyState from "@/components/main/shared/EmptyState";
import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TCategory } from "@/types/Category.types";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import CategoryFormModal from "./CategoryFormModal";

export default function CategoryManager() {
  const C = useTheme();
  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<TCategory | undefined>(undefined);

  const { data, isLoading } = useFetchData<TCategory[]>(["categories"], "/categories");

  const categories = data?.data ?? [];

  const openCreate = () => {
    setEditCategory(undefined);
    setFormOpen(true);
  };

  const openEdit = (category: TCategory) => {
    setEditCategory(category);
    setFormOpen(true);
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[text.kicker, { color: C?.textSecondary }]}>Categories{categories.length ? ` · ${categories.length}` : ""}</Text>
        <TouchableOpacity onPress={openCreate} style={styles.newBtn}>
          <Ionicons name="add" size={16} color={C?.accent} />
          <Text style={[text.bodySm, { color: C?.accent }]}>New</Text>
        </TouchableOpacity>
      </View>

      {!isLoading && categories.length === 0 ? (
        <EmptyState title="No categories yet" subtitle="Categories group your spending on Today, Activity and Budgets. Everything without one counts as Uncategorized." icon="pricetags-outline" />
      ) : (
        <View style={[styles.card, { backgroundColor: C?.surface, borderColor: C?.border }]}>
          {categories.map((category, i) => (
            <TouchableOpacity
              key={category._id}
              onPress={() => openEdit(category)}
              activeOpacity={0.7}
              style={[styles.row, i !== categories.length - 1 && { borderBottomWidth: 1, borderBottomColor: C?.divider }]}
            >
              <View style={[styles.icon, { backgroundColor: C?.accentDim }]}>
                <MaterialCommunityIcons name={(category.icon as any) ?? "shape"} size={16} color={C?.accentText} />
              </View>
              <Text style={[text.body, { color: C?.text, flex: 1 }]} numberOfLines={1}>
                {category.name}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={C?.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {formOpen && <CategoryFormModal open={formOpen} setOpen={setFormOpen} initialValue={editCategory} />}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  card: { borderRadius: radius.card, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 48, paddingHorizontal: spacing.md },
  icon: { width: 30, height: 30, borderRadius: radius.sm + 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
