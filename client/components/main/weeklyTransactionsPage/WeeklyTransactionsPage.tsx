import { useFetchData } from "@/hooks/useApi";
import { TTransaction } from "@/types/Transaction.tyes";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import TransactionAccordion from "../MonthlyTransaction/TransactionAccordion";
import TotalBalanceCard from "../shared/TotalBalanceCard";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";

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

  return (
    <View style={{ width: "92%", alignSelf: "center", marginTop: 10 }}>
      {/* Total balance card */}
      <TotalBalanceCard
        income={weeklyTransaction?.data?.income ?? 0}
        expense={weeklyTransaction?.data?.expense ?? 0}
      />

      {/* Scrollable Transactions */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20, marginTop: 8 }}
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
