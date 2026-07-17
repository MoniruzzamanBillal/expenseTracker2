import { useFetchData } from "@/hooks/useApi";
import { TTransaction } from "@/types/Transaction.tyes";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import TransactionAccordion from "../MonthlyTransaction/TransactionAccordion";
import TotalBalanceCard from "../shared/TotalBalanceCard";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";
import WeeklyAverageCard from "./WeeklyAverageCard";

type TDailyData = {
  date: string;
  expense: number;
  income: number;
  transactions: TTransaction[];
};

type TData = {
  expense: number;
  income: number;
  transactionData: TDailyData[];
};

export default function WeeklyTransactionsPage() {
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: weeklyTransaction,
    isLoading,
    refetch,
  } = useFetchData<TData>(
    ["weekly-transaction"],
    `/transactions/weekly-transaction`,
  );

  //   console.log(weeklyTransaction?.data);

  const handleRefresh = async () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  };

  const daysWithExpense =
    weeklyTransaction?.data?.transactionData?.filter((d) => d.expense > 0)
      .length ?? 0;

  const averageExpense =
    daysWithExpense > 0
      ? (weeklyTransaction?.data?.expense ?? 0) / daysWithExpense
      : 0;

  return (
    <View style={{ width: "92%", alignSelf: "center", marginTop: 10, flex: 1 }}>
      {/* Total balance card */}
      <TotalBalanceCard
        income={weeklyTransaction?.data?.income ?? 0}
        expense={weeklyTransaction?.data?.expense ?? 0}
      />

      {/* Weekly average expense card */}
      <WeeklyAverageCard averageExpense={averageExpense} />

      {/* Scrollable Transactions */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, marginTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading && <TransactionCardSkeleton />}
        {!isLoading && !weeklyTransaction?.data?.transactionData?.length && (
          <Text style={{ fontWeight: "600", fontSize: 24, color: "red" }}>
            No transactions yet !!!
          </Text>
        )}

        {weeklyTransaction?.data?.transactionData && (
          <TransactionAccordion
            dailyData={weeklyTransaction?.data?.transactionData}
          />
        )}
      </ScrollView>
    </View>
  );
}
