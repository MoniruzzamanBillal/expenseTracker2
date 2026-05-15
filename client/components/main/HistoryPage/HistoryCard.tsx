import { TTransactionHistory } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function HistoryCard({
  historyData,
}: {
  historyData: TTransactionHistory;
}) {
  const balance = historyData?.income - historyData?.expense;

  return (
    <View style={historyCardStyle.container}>
      {/* Header Section */}
      <View style={historyCardStyle.header}>
        <Text style={historyCardStyle.monthText}>
          {monthNames[historyData?.month]}
        </Text>
        <View style={historyCardStyle.transactionBadge}>
          <Text style={historyCardStyle.badgeText}>
            {historyData?.transactionCount} TRANSACTIONS
          </Text>
        </View>
      </View>

      {/* Stats Section */}
      <View style={historyCardStyle.statsContainer}>
        {/* Income Section */}
        <View style={historyCardStyle.statItem}>
          <Text style={historyCardStyle.statLabel}>Inc</Text>
          <Text
            style={[
              historyCardStyle.statValue,
              { color: COLORS.income || "#4CAF50" },
            ]}
          >
            ৳{historyData?.income?.toLocaleString()}
          </Text>
        </View>

        {/* Divider */}
        <View style={historyCardStyle.divider} />

        {/* Expense Section */}
        <View style={historyCardStyle.statItem}>
          <Text style={historyCardStyle.statLabel}>Exp</Text>
          <Text
            style={[
              historyCardStyle.statValue,
              { color: COLORS.expense || "#F44336" },
            ]}
          >
            ৳{historyData?.expense?.toLocaleString()}
          </Text>
        </View>

        {/* Divider */}
        <View style={historyCardStyle.divider} />

        {/* Balance Section */}
        <View style={[historyCardStyle.statItem, historyCardStyle.balanceItem]}>
          <Text style={historyCardStyle.statLabel}>Balance</Text>
          <Text
            style={[
              historyCardStyle.statValue,
              {
                color: balance < 0 ? "red" : COLORS.text || "#1F2937",
              },
            ]}
          >
            ৳{balance?.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const historyCardStyle = StyleSheet.create({
  container: {
    width: "98%",
    margin: "auto",
    marginVertical: 6,
    backgroundColor: COLORS.background || "#FFFFFF",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border || "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  monthText: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  transactionBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLORS.textLight,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    flexDirection: "column",
  },
  balanceItem: {
    alignItems: "flex-end",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLORS.textLight || "#6B7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border || "#E5E7EB",
    marginHorizontal: 8,
  },
});
