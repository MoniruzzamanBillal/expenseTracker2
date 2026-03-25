import { TransactionTypeConst } from "@/constants/TransactionType.constant";
import { COLORS } from "@/utils/colors";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type TSummaryCardProps = {
  type: keyof typeof TransactionTypeConst;
  amount: number;
  title: string;
  icon: "arrow-up" | "arrow-down";
};

export default function SummaryGrid({
  totalIncome,
  totalExpense,
}: {
  totalIncome: number;
  totalExpense: number;
}) {
  return (
    <View style={styles.gridContainer}>
      <SummaryCard
        type={TransactionTypeConst.income}
        title="Total Income"
        amount={totalIncome}
        icon="arrow-up"
      />
      <SummaryCard
        type={TransactionTypeConst.expense}
        title="Total Expense"
        amount={totalExpense}
        icon="arrow-down"
      />
    </View>
  );
}

const SummaryCard = ({ type, amount, title, icon }: TSummaryCardProps) => {
  const isIncome = type === "income";
  const color = isIncome
    ? COLORS.income || "#4CAF50"
    : COLORS.expense || "#F44336";
  const bgColor = isIncome ? "#E8F5E9" : "#FFEBEE";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
          <MaterialCommunityIcons name={icon} size={14} color={color} />
        </View>
      </View>
      <View style={styles.amountContainer}>
        <Text
          style={[
            styles.currencySymbol,
            { color: COLORS.textLight || "#6B7280" },
          ]}
        >
          ৳
        </Text>
        <Text style={[styles.amount, { color }]}>
          {amount.toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: "row",
    gap: 16,
    marginVertical: 6,
  },
  card: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: COLORS.background,
    borderColor: "#E5E7EB",

    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.8,
  },
  iconContainer: {
    padding: 4,
    borderRadius: 20,
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  currencySymbol: {
    fontSize: 12,
    opacity: 0.8,
    marginRight: 2,
  },
  amount: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28,
  },
});
