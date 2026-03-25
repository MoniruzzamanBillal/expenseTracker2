import { useFetchData } from "@/hooks/useApi";
import { TTransactionHistory } from "@/types/Transaction.tyes";
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

import { MaterialCommunityIcons } from "@expo/vector-icons";

const yearChangeDirection = {
  prev: "prev",
  next: "next",
} as const;

type TMonthlyData = {
  month: number;
  income: number;
  expense: number;
};

type TData = {
  totalExpense: number;
  totalIncome: number;
  yearSummary: TMonthlyData[];
};

const startYear = 2024;
const currentYear = new Date().getFullYear();

const yearsData = Array.from(
  { length: currentYear - startYear + 1 },
  (_, i) => startYear + i,
);

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
              color="#6B7280"
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
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 75 }}
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
            (historyData: TTransactionHistory, ind: number) => (
              <HistoryCard key={ind} historyData={historyData} />
            ),
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  yearContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  yearContainerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 9999,
    backgroundColor: "#FFFFFF",
  },
  button: {
    padding: 4,
  },
  yearText: {
    fontFamily: "System", // or your custom font for headline
    fontWeight: "bold",
    fontSize: 16,
    color: "#1F2937", // text-on-surface equivalent
    letterSpacing: 0.5, // tracking-wide equivalent
  },
});
