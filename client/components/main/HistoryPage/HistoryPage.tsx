import { useFetchData } from "@/hooks/useApi";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import HistoryCard from "./HistoryCard";
import HistoryCardSkeleton from "./HistoryCardSkeleton";

import { TTransactionHistory } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TotalBalanceCard from "../shared/TotalBalanceCard";
import MonthlyBreakdownHeader from "./MonthlyBreakdownHeader";

const yearChangeDirection = {
  prev: "prev",
  next: "next",
} as const;

type TData = {
  totalExpense: number;
  totalIncome: number;
  yearSummary: TTransactionHistory[];
};

const startYear = 2025;
const currentYear = new Date().getFullYear();

export default function HistoryPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const {
    data: yearlyTransactions,
    isLoading,
    refetch,
  } = useFetchData<TData>(
    ["yearly-transaction", String(selectedYear)],
    `/transactions/yearly-transaction?targetYear=${selectedYear}`,
  );

  // console.log("yearlyTransactions = ", yearlyTransactions);

  const handleRefresh = async () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  };

  const handleYearChange = (direction: keyof typeof yearChangeDirection) => {
    if (direction === yearChangeDirection.prev && selectedYear > startYear) {
      setSelectedYear(selectedYear - 1);
    }

    if (direction === yearChangeDirection.next && selectedYear < currentYear) {
      setSelectedYear(selectedYear + 1);
    }
  };

  return (
    <View style={{ width: "92%", alignSelf: "center", marginTop: 10 }}>
      {/* year select  */}
      <View style={styles.yearContainer}>
        <View style={styles.yearContainerWrapper}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleYearChange(yearChangeDirection.prev)}
            disabled={selectedYear === startYear}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={18}
              color={COLORS.text}
            />
          </TouchableOpacity>

          <Text style={styles.yearText}> {selectedYear} </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => handleYearChange(yearChangeDirection.next)}
            disabled={selectedYear === currentYear}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={COLORS.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TotalBalanceCard
        income={yearlyTransactions?.data?.totalIncome ?? 0}
        expense={yearlyTransactions?.data?.totalExpense ?? 0}
      />

      <MonthlyBreakdownHeader year={selectedYear ?? 0} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 270 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading &&
          !refreshing &&
          Array.from({ length: 8 })?.map((_, ind) => (
            <HistoryCardSkeleton key={ind} />
          ))}
        {refreshing &&
          Array.from({ length: 8 })?.map((_, ind) => (
            <HistoryCardSkeleton key={ind} />
          ))}

        {yearlyTransactions?.data &&
          yearlyTransactions?.data?.yearSummary?.map(
            (historyData: TTransactionHistory) => (
              <HistoryCard key={historyData?.month} historyData={historyData} />
            ),
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // year select
  yearContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  yearContainerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9999,
    backgroundColor: COLORS.background,
  },
  button: {
    padding: 3,
  },
  yearText: {
    fontFamily: "System",
    fontWeight: "bold",
    fontSize: 15,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
});
