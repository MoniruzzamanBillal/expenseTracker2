import { COLORS } from "@/utils/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type TMonthlyAverageCardProps = {
  averageExpense: number;
};

export default function MonthlyAverageCard({
  averageExpense,
}: TMonthlyAverageCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Avg Daily Expense · This Month</Text>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="chart-line-variant"
            size={14}
            color={COLORS.expense}
          />
        </View>
      </View>
      <View style={styles.amountContainer}>
        <Text style={styles.currencySymbol}>৳</Text>
        <Text style={styles.amount}>{averageExpense.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    justifyContent: "space-between",
    marginBottom: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.8,
  },
  iconContainer: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: "#FFEBEE",
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  currencySymbol: {
    fontSize: 12,
    opacity: 0.8,
    marginRight: 3,
    color: COLORS.textLight,
  },
  amount: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 24,
    color: COLORS.expense,
  },
});
