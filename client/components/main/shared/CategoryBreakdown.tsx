import { radius, spacing, text, useTheme } from "@/theme";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

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

/**
 * Compact stacked bar + wrapped legend, ranked by expense desc, ramp c1→c5 by
 * rank (6th+ collapse into "Other" in c5). Uncategorized always gets its own
 * swatch, never a ramp hue, even if it ranks first. Rows are tappable when
 * onSelect is wired (Activity's filter); Home passes a no-op for read-only.
 */
export default function CategoryBreakdown({ data, selected, onSelect }: TProps) {
  const C = useTheme();

  const rows = useMemo(() => {
    const expenseOnly = data.filter((d) => d.expense > 0).sort((a, b) => b.expense - a.expense);
    const total = expenseOnly.reduce((sum, d) => sum + d.expense, 0);
    if (total === 0) return [];

    const ranked = expenseOnly.slice(0, 5).map((entry, i) => ({
      key: entry.categoryId ?? "uncategorized",
      name: entry.name,
      expense: entry.expense,
      pct: Math.round((entry.expense / total) * 100),
      color: entry.categoryId === null ? C.uncategorized : C.chartPalette[i] ?? C.chartPalette[C.chartPalette.length - 1],
    }));

    if (expenseOnly.length > 5) {
      const otherExpense = expenseOnly.slice(5).reduce((sum, d) => sum + d.expense, 0);
      ranked.push({
        key: "__other",
        name: "Other",
        expense: otherExpense,
        pct: Math.round((otherExpense / total) * 100),
        color: C.chartPalette[C.chartPalette.length - 1],
      });
    }
    return ranked;
  }, [data, C]);

  if (rows.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={styles.headRow}>
        <Text style={[text.kicker, { color: C.textSecondary }]}>Spent on</Text>
      </View>
      <View style={styles.bar}>
        {rows.map((r) => (
          <View key={r.key} style={{ flex: r.pct || 1, borderRadius: 2, backgroundColor: r.color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {rows.map((r) => {
          const active = selected === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              onPress={() => onSelect(active ? null : r.key)}
              activeOpacity={0.7}
              style={[styles.legendItem, active && { backgroundColor: C.accentDim, borderRadius: radius.sm }]}
            >
              <View style={[styles.swatch, { backgroundColor: r.color }]} />
              <Text style={[text.caption, { color: C.textSecondary }]}>{r.name}</Text>
              <Text style={[text.caption, { color: C.text }]}>{r.pct}%</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: 12, paddingHorizontal: 14, gap: spacing.sm, marginBottom: spacing.base },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bar: { flexDirection: "row", gap: 2, height: 8 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2, paddingHorizontal: 4 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
});
