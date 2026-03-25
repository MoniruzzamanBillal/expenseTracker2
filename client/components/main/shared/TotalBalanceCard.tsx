import { COLORS } from "@/utils/colors";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

type TPageProps = {
  income: number;
  expense: number;
};

export default function TotalBalanceCard({ income, expense }: TPageProps) {
  const totalBalance = income - expense;

  return (
    <LinearGradient
      colors={[COLORS.primary, "#b07c60"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={cardStyles.container}
    >
      {/* Content */}
      <View style={cardStyles.contentContainer}>
        {/* Left Section */}
        <View>
          <Text style={cardStyles.totalBalanceLabel}>Total Balance</Text>
          <Text style={cardStyles.totalBalanceAmount}>
            ৳{" "}
            {totalBalance.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>

        {/* Right Section - Income/Expense Cards */}
        <View style={cardStyles.rightSection}>
          {/* Income Card */}
          <View style={cardStyles.statCard}>
            <Text style={cardStyles.statLabel}>Income</Text>
            <Text style={[cardStyles.statAmount, cardStyles.incomeAmount]}>
              +৳ {income.toLocaleString("en-IN")}
            </Text>
          </View>

          {/* Expense Card */}
          <View style={cardStyles.statCard}>
            <Text style={cardStyles.statLabel}>Expense</Text>
            <Text style={[cardStyles.statAmount, cardStyles.expenseAmount]}>
              -৳ {expense.toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    marginVertical: 12,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },

  contentContainer: {
    padding: 20,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 3,
  },

  totalBalanceLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  totalBalanceAmount: {
    color: "#FFFFFF",
    fontSize: 35,
    fontWeight: "bold",
    letterSpacing: -0.5,
    marginBottom: 10,
  },

  rightSection: {
    flexDirection: "row",
    gap: 16,
  },
  statCard: {
    backgroundColor: "rgba(208, 189, 189, 0.1)",
    borderRadius: 16,
    padding: 10,
    minWidth: "45%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statAmount: {
    fontSize: 20,
    fontWeight: "bold",
  },
  incomeAmount: {
    color: "#4CAF50",
  },
  expenseAmount: {
    color: "#F44336",
  },
});
