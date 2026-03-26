import { useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

import { useFetchData } from "@/hooks/useApi";
import { COLORS } from "@/utils/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TotalBalanceCard from "../shared/TotalBalanceCard";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";
import TransactionAccordion from "./TransactionAccordion";

const monthChangeDirection = {
  prev: "prev",
  next: "next",
} as const;

type Transaction = {
  _id: string;
  user: string;
  type: "income" | "expense";
  title: string;
  description: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  __v: number;
};

type TDailyData = {
  date: string;
  expense: number;
  income: number;
  transactions: Transaction[];
};

type TData = {
  expense: number;
  income: number;
  transactionData: TDailyData[];
};

const screenHeight = Dimensions.get("window").height;

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

const startMonth = 1;
const endMonth = 12;

export default function MonthlyTransactionPage() {
  const [refreshing, setRefreshing] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const {
    data: monthlyTransaction,
    isLoading,
    refetch,
  } = useFetchData<TData>(
    [`monthly-transaction-${selectedMonth}`, String(selectedMonth)],
    `/transactions/monthly-transaction?targetMonth=${selectedMonth}`,
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  };

  const handleMonthChange = (direction: keyof typeof monthChangeDirection) => {
    if (direction === monthChangeDirection.prev && selectedMonth > startMonth) {
      setSelectedMonth(selectedMonth - 1);
    }

    if (direction === monthChangeDirection.next && selectedMonth < endMonth) {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(currentMonth);
  };

  return (
    <View style={PageStyles.mainContainer}>
      {/* Total balance card */}
      <TotalBalanceCard
        income={monthlyTransaction?.data?.income ?? 0}
        expense={monthlyTransaction?.data?.expense ?? 0}
      />

      {/* Month Selector with Current Month Button */}
      <View style={styles.monthSelectorContainer}>
        <View style={styles.monthContainer}>
          <View style={styles.monthContainerWrapper}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => handleMonthChange(monthChangeDirection.prev)}
              disabled={selectedMonth === startMonth}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={18}
                color={
                  selectedMonth === startMonth ? COLORS.textLight : COLORS.text
                }
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={goToCurrentMonth}>
              <Text style={styles.monthText}>
                {monthNames[selectedMonth - 1]}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={() => handleMonthChange(monthChangeDirection.next)}
              disabled={selectedMonth === endMonth}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={
                  selectedMonth === endMonth ? COLORS.textLight : COLORS.text
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {selectedMonth !== currentMonth && (
          <TouchableOpacity
            style={styles.currentMonthButton}
            onPress={goToCurrentMonth}
          >
            <MaterialCommunityIcons
              name="calendar-today"
              size={12}
              color={COLORS.primary}
            />
            <Text style={styles.currentMonthText}>Current Month</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Scrollable Transactions */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20, marginTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading && <TransactionCardSkeleton />}
        {!monthlyTransaction?.data?.transactionData?.length && (
          <Text style={{ fontWeight: "600", fontSize: 24, color: "red" }}>
            No transactions yet !!!
          </Text>
        )}

        {monthlyTransaction?.data?.transactionData && (
          <TransactionAccordion
            dailyData={monthlyTransaction?.data?.transactionData}
          />
        )}
      </ScrollView>
    </View>
  );
}

const PageStyles = StyleSheet.create({
  mainContainer: {
    width: "90%",
    alignSelf: "center",
    flex: 1,
  },
  scrollableList: {
    marginTop: 8,
    flex: 1,
    maxHeight: screenHeight * 0.7,
  },
});

const styles = StyleSheet.create({
  monthSelectorContainer: {
    marginVertical: 4,
  },
  monthContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  monthContainerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border || "#E5E7EB",
    borderRadius: 9999,
    backgroundColor: COLORS.background || "#FFFFFF",
  },
  button: {
    padding: 4,
  },
  monthText: {
    fontFamily: "System",
    fontWeight: "bold",
    fontSize: 16,
    color: COLORS.text || "#1F2937",
    letterSpacing: 0.5,
  },
  currentMonthButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },
  currentMonthText: {
    fontSize: 10,
    fontWeight: "500",
    color: COLORS.primary,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  emptyStateText: {
    fontWeight: "600",
    fontSize: 18,
    color: COLORS.textLight || "#6B7280",
    textAlign: "center",
  },
});
