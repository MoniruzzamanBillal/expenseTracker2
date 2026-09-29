import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TCategory } from "@/types/Category.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

type TProps = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

/** Horizontal chip row, h34/r17, bleeds off the right edge. First chip "None" sends null. */
export default function CategoryPicker({ value, onChange }: TProps) {
  const C = useTheme();
  const { data } = useFetchData<TCategory[]>(["categories"], "/categories");
  const categories = data?.data ?? [];

  if (categories.length === 0) {
    return <Text style={[text.caption, { color: C?.textMuted, marginBottom: spacing.base }]}>No categories yet — add one from Settings.</Text>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { marginBottom: spacing.base }]}
    >
      <TouchableOpacity
        onPress={() => onChange(null)}
        style={[styles.chip, { borderColor: value === null ? C?.accent : C?.border, backgroundColor: value === null ? C?.accentDim : "transparent" }]}
      >
        <MaterialCommunityIcons name="shape-outline" size={16} color={value === null ? C?.accentText : C?.textSecondary} />
        <Text style={[text.bodySm, { color: value === null ? C?.accentText : C?.textSecondary }]}>None</Text>
      </TouchableOpacity>
      {categories.map((cat) => {
        const active = value === cat._id;
        return (
          <TouchableOpacity
            key={cat._id}
            onPress={() => onChange(cat._id)}
            style={[styles.chip, { borderColor: active ? C?.accent : C?.border, backgroundColor: active ? C?.accentDim : "transparent" }]}
          >
            {cat.icon ? <MaterialCommunityIcons name={cat.icon as any} size={16} color={active ? C?.accentText : C?.textSecondary} /> : null}
            <Text style={[text.bodySm, { color: active ? C?.accentText : C?.textSecondary }]}>{cat.name}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: spacing.md, paddingLeft: 10, borderRadius: radius.pill, borderWidth: 1 },
});
