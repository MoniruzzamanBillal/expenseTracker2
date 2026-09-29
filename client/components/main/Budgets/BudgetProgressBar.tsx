import { text, useTheme } from "@/theme";
import { StyleSheet, Text, View } from "react-native";
import { formatAmount, formatTotal } from "@/utils/formatAmount";

type TProps = {
  spent: number;
  limit: number;
  percentage: number;
  isOverLimit: boolean;
};

const NEAR_LIMIT_THRESHOLD = 80;

export default function BudgetProgressBar({ spent, limit, percentage, isOverLimit }: TProps) {
  const C = useTheme();
  const isNearLimit = !isOverLimit && percentage >= NEAR_LIMIT_THRESHOLD;
  const barColor = isOverLimit ? C.expense : isNearLimit ? C.warning : C.accent;
  const width = Math.min(percentage, 100);

  return (
    <View>
      <View style={[styles.track, { backgroundColor: C.surface2 }]}>
        <View style={[styles.fill, { width: `${width}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.labelRow}>
        <Text style={[text.caption, { color: C.textSecondary }]}>
          ৳{formatTotal(spent)} of ৳{formatAmount(limit)}
        </Text>
        {isOverLimit ? (
          <Text style={[text.caption, { color: C.expense }]}>Over by ৳{formatTotal(spent - limit)}</Text>
        ) : spent === 0 ? (
          <Text style={[text.caption, { color: C.textMuted }]}>Nothing spent yet</Text>
        ) : (
          <Text style={[text.caption, { color: isNearLimit ? C.warning : C.textMuted }]}>৳{formatTotal(limit - spent)} left</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
});
