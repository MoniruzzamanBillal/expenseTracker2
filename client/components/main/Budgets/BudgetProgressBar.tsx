import { fontFamily, text, useTheme } from "@/theme";
import { StyleSheet, Text, View } from "react-native";

type TProps = {
  spent: number;
  limit: number;
  percentage: number;
  isOverLimit: boolean;
};

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

export default function BudgetProgressBar({
  spent,
  limit,
  percentage,
  isOverLimit,
}: TProps) {
  const C = useTheme();
  const barColor = isOverLimit ? C.expense : C.income;
  const width = Math.min(percentage, 100);

  return (
    <View>
      <View style={[styles.track, { backgroundColor: C.divider }]}>
        <View
          style={[
            styles.fill,
            { width: `${width}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <View style={styles.labelRow}>
        <Text style={[text.caption, { color: C.textSecondary }]}>
          ৳{fmt(spent)} of ৳{fmt(limit)}
        </Text>
        {isOverLimit ? (
          <Text
            style={[
              text.caption,
              { color: C.expense, fontFamily: fontFamily.medium },
            ]}
          >
            ৳{fmt(spent - limit)} over
          </Text>
        ) : (
          <Text style={[text.caption, { color: C.textMuted }]}>
            {Math.round(percentage)}%
          </Text>
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
