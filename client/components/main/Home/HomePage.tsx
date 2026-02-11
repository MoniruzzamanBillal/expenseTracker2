import { useFetchData } from "@/hooks/useApi";
import { TTransaction } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import PageSkeleton from "../shared/PageSkeleton";
import TotalBalanceCard from "../shared/TotalBalanceCard";
import TransactionCard from "../shared/TransactionCard";

const screenHeight = Dimensions.get("window").height;

export default function HomePage() {
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: dailyTransaction,
    isLoading,
    refetch,
  } = useFetchData(["daily-transaction"], `/transactions/daily-transaction`);

  //   console.log(dailyTransaction?.data);

  const handleRefresh = async () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <View style={homePageStyles.mainContainer}>
      {/* Total balance card */}
      {dailyTransaction && (
        <TotalBalanceCard
          income={dailyTransaction?.data?.income}
          expense={dailyTransaction?.data?.expense}
        />
      )}

      {/* Title for transactions */}
      <Text
        style={{
          marginTop: 8,
          fontSize: 20,
          fontWeight: "800",
          color: COLORS.text,
        }}
      >
        Transactions :
      </Text>

      {/* Scrollable Transactions */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {!dailyTransaction?.data?.transactions?.length && (
          <Text style={{ fontWeight: "600", fontSize: 24, color: "red" }}>
            No transactions yet !!!
          </Text>
        )}

        {dailyTransaction?.data?.transactions &&
          dailyTransaction?.data?.transactions?.map(
            (transaction: TTransaction) => (
              <TransactionCard
                key={transaction?._id}
                transactionData={transaction}
              />
            ),
          )}
      </ScrollView>
    </View>
  );
}

const homePageStyles = StyleSheet.create({
  mainContainer: {
    width: "90%",
    alignSelf: "center",
    flex: 1,
  },
  scrollableList: {
    marginTop: 4,
    flex: 1,
    maxHeight: screenHeight * 0.7,
  },
});
