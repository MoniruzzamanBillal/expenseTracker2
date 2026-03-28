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
      colors={["#f7dfd2", "#ebccbc"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={cardStyles.container}
    >
      {/* Content */}
      <View style={cardStyles.contentContainer}>
        {/* total balance  */}
        <View>
          <Text style={cardStyles.totalBalanceLabel}>Total Balance</Text>
          <Text style={cardStyles.totalBalanceAmount}>৳ {totalBalance}</Text>
        </View>

        {/*  Income/Expense Cards */}
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
    marginVertical: 10,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,

    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  contentContainer: {
    padding: 16,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  totalBalanceLabel: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  totalBalanceAmount: {
    color: COLORS.primary,
    fontSize: 30,
    fontWeight: "bold",
    letterSpacing: -0.5,
    marginBottom: 8,
  },

  rightSection: {
    flexDirection: "row",
    gap: 16,
  },
  statCard: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 8,
    minWidth: "45%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statAmount: {
    fontSize: 18,
    fontWeight: "bold",
  },
  incomeAmount: {
    color: COLORS.income,
    textShadowColor: "rgba(76, 175, 80, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  expenseAmount: {
    color: COLORS.expense,
    textShadowColor: "rgba(195, 83, 75, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
