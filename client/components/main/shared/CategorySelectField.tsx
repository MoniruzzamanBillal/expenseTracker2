import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TCategory } from "@/types/Category.types";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Modal, Portal } from "react-native-paper";

type TProps = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  label?: string;
};

export default function CategorySelectField({ value, onChange, label = "Category" }: TProps) {
  const C = useTheme();
  const [open, setOpen] = useState(false);
  const { data } = useFetchData<TCategory[]>(["categories"], "/categories");
  const categories = data?.data ?? [];

  const selected = categories.find((c) => c._id === value) ?? null;

  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[text.captionMd, { color: C?.textSecondary, marginBottom: spacing.xs + 1 }]}>{label}</Text>

      <TouchableOpacity onPress={() => setOpen(true)} style={[styles.field, { backgroundColor: C?.inputBg, borderColor: C?.border }]}>
        {selected?.icon ? (
          <View style={[styles.iconTile, { backgroundColor: C?.accentDim }]}>
            <MaterialCommunityIcons name={selected.icon as any} size={16} color={C?.accentText} />
          </View>
        ) : null}
        <Text style={[text.body, { color: selected ? C?.text : C?.placeholder, flex: 1 }]} numberOfLines={1}>
          {selected ? selected.name : "Select category"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C?.textMuted} />
      </TouchableOpacity>

      <Portal>
        <Modal visible={open} onDismiss={() => setOpen(false)} contentContainerStyle={[styles.modalContent, { backgroundColor: C?.surface, borderColor: C?.border }]}>
          <Text style={[text.h3, { color: C?.text, marginBottom: spacing.md }]}>Select category</Text>

          {categories.length === 0 ? (
            <Text style={[text.caption, { color: C?.textMuted }]}>No categories yet — add one from Settings.</Text>
          ) : (
            <FlatList
              data={categories}
              keyExtractor={(item) => item._id}
              style={styles.list}
              ListHeaderComponent={
                <TouchableOpacity
                  onPress={() => handleSelect(null)}
                  style={[styles.row, { borderColor: !value ? C?.accent : C?.border, backgroundColor: !value ? C?.accentDim : "transparent" }]}
                >
                  <MaterialCommunityIcons name="shape-outline" size={16} color={!value ? C?.accentText : C?.textSecondary} />
                  <Text style={[text.body, { color: !value ? C?.accentText : C?.textSecondary }]}>None</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => {
                const active = value === item._id;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect(item._id)}
                    style={[styles.row, { borderColor: active ? C?.accent : C?.border, backgroundColor: active ? C?.accentDim : "transparent" }]}
                  >
                    {item.icon ? <MaterialCommunityIcons name={item.icon as any} size={16} color={active ? C?.accentText : C?.textSecondary} /> : null}
                    <Text style={[text.body, { color: active ? C?.accentText : C?.text }]}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: spacing.field, borderRadius: radius.card, borderWidth: 1, paddingHorizontal: spacing.md },
  iconTile: { width: 28, height: 28, borderRadius: radius.sm + 2, alignItems: "center", justifyContent: "center" },
  modalContent: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.lg,
    maxHeight: "70%",
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
});
