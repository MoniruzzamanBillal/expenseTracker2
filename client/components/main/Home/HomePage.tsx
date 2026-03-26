import { useFetchData } from "@/hooks/useApi";
import { TTransaction } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { useRef, useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Text } from "react-native-paper";
import TotalBalanceCard from "../shared/TotalBalanceCard";
import TransactionCard from "../shared/TransactionCard";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";

type TData = {
  expense: number;
  income: number;
  transactions: TTransaction[];
};

const screenHeight = Dimensions.get("window").height;

export default function HomePage() {
  const [refreshing, setRefreshing] = useState(false);

  const openSwipeableRef = useRef<Swipeable | null>(null);

  const {
    data: dailyTransaction,
    isLoading,
    refetch,
  } = useFetchData<TData>(
    ["daily-transaction"],
    `/transactions/daily-transaction`,
  );

  // console.log("dailyTransaction =", dailyTransaction?.data);

  const handleRefresh = async () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  };

  return (
    <View style={homePageStyles.mainContainer}>
      {/* Total balance card */}
      <TotalBalanceCard
        income={dailyTransaction?.data?.income ?? 0}
        expense={dailyTransaction?.data?.expense ?? 0}
      />

      {/* Title for transactions */}
      <Text
        style={{
          marginTop: 6,
          fontSize: 19,
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
        {isLoading && <TransactionCardSkeleton />}
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
                onSwipeOpen={(ref) => {
                  if (
                    openSwipeableRef.current &&
                    openSwipeableRef.current !== ref
                  ) {
                    openSwipeableRef.current.close();
                  }
                  openSwipeableRef.current = ref;
                }}
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
