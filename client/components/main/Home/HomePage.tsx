import { useFetchData } from "@/hooks/useApi";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";
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
import PendingSyncBanner from "../shared/PendingSyncBanner";
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

  const { data: pendingTransactions } = usePendingTransactions();

  // Not-yet-synced items shaped like TTransaction so they can render through
  // the same TransactionCard (with pending=true) as normal transactions.
  const pendingAsTransactions: TTransaction[] = (pendingTransactions ?? []).map(
    (item) => ({
      _id: item.localId,
      title: item.payload.title,
      description: item.payload.description,
      amount: item.payload.amount,
      type: item.payload.type,
      createdAt: item.createdAt,
    }),
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

      <PendingSyncBanner />

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
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading && <TransactionCardSkeleton />}
        {!isLoading &&
          !dailyTransaction?.data?.transactions?.length &&
          !pendingAsTransactions.length && (
            <Text style={{ fontWeight: "600", fontSize: 24, color: "red" }}>
              No transactions yet !!!
            </Text>
          )}

        {pendingAsTransactions.length > 0 && (
          <Text
            style={{
              marginBottom: 4,
              fontSize: 13,
              fontWeight: "700",
              color: COLORS.textLight,
            }}
          >
            Pending Sync
          </Text>
        )}

        {pendingAsTransactions.map((transaction) => (
          <TransactionCard
            key={transaction?._id}
            transactionData={transaction}
            pending
          />
        ))}

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
