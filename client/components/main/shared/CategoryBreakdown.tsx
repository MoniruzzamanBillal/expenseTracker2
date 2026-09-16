import { radius, spacing, text, useTheme } from "@/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export type TBreakdownEntry = {
  categoryId: string | null;
  name: string;
  icon: string | null;
  income: number;
  expense: number;
};

type TProps = {
  data: TBreakdownEntry[];
  selected: string | null; // categoryId, "uncategorized", or null = no filter
  onSelect: (key: string | null) => void;
};

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

export default function CategoryBreakdown({
  data,
  selected,
  onSelect,
}: TProps) {
  const C = useTheme();

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.expense - a.expense),
    [data],
  );

  if (sorted.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { marginBottom: spacing.base }]}
    >
      {sorted.map((entry) => {
        const key = entry.categoryId ?? "uncategorized";
        const active = selected === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(active ? null : key)}
            style={[
              styles.chip,
              {
                borderColor: active ? C.accent : C.border,
                backgroundColor: active ? C.accentDim : C.surface,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={(entry.icon as any) ?? "tag-outline"}
              size={14}
              color={C.expense}
            />
            <Text
              style={[text.caption, { color: active ? C.accent : C.text }]}
              numberOfLines={1}
            >
              {entry.name}
            </Text>
            <Text style={[text.caption, { color: C.expense }]}>
              ৳{fmt(entry.expense)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
