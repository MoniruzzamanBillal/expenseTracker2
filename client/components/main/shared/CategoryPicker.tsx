import { useFetchData } from "@/hooks/useApi";
import { spacing, text, useTheme } from "@/theme";
import { TCategory } from "@/types/Category.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type TProps = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

export default function CategoryPicker({ value, onChange }: TProps) {
  const C = useTheme();
  const { data } = useFetchData<TCategory[]>(["categories"], "/categories");
  const categories = data?.data ?? [];

  if (categories.length === 0) {
    return (
      <Text
        style={[
          text.caption,
          { color: C.textMuted, marginBottom: spacing.base },
        ]}
      >
        No categories yet — add one from Settings.
      </Text>
    );
  }

  return (
    <View style={[styles.grid, { marginBottom: spacing.base }]}>
      {categories.map((cat) => {
        const active = value === cat._id;
        return (
          <TouchableOpacity
            key={cat._id}
            onPress={() => onChange(active ? null : cat._id)}
            style={[
              styles.chip,
              {
                borderColor: active ? C.accent : C.border,
                backgroundColor: active ? C.accentDim : "transparent",
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
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
