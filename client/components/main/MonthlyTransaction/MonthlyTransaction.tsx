import { useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";

import { useFetchData } from "@/hooks/useApi";
import { COLORS } from "@/utils/colors";
import { Picker } from "@react-native-picker/picker";
import PageSkeleton from "../shared/PageSkeleton";
import TotalBalanceCard from "../shared/TotalBalanceCard";
import TransactionAccordion from "./TransactionAccordion";

const screenHeight = Dimensions.get("window").height;

const monthsData = [
  { label: "January", value: 1 },
  { label: "February", value: 2 },
  { label: "March", value: 3 },
  { label: "April", value: 4 },
  { label: "May", value: 5 },
  { label: "June", value: 6 },
  { label: "July", value: 7 },
  { label: "August", value: 8 },
  { label: "September", value: 9 },
  { label: "October", value: 10 },
  { label: "November", value: 11 },
  { label: "December", value: 12 },
];

export default function MonthlyTransactionPage() {
  const [refreshing, setRefreshing] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const {
    data: monthlyTransaction,
    isLoading,

    refetch,
  } = useFetchData(
    ["monthly-transaction", String(selectedMonth)],
    `/transactions/monthly-transaction?targetMonth=${selectedMonth}`,
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <View style={PageStyles.mainContainer}>
      {/* Total balance card */}
      {monthlyTransaction?.data && (
        <TotalBalanceCard
          income={monthlyTransaction?.data?.income}
          expense={monthlyTransaction?.data?.expense}
        />
      )}

      {/* month select input  */}

      <View
        style={{
          marginTop: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>
          Current Month :{" "}
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 4,
            overflow: "hidden",
            flex: 1,
          }}
        >
          <Picker
            style={{ color: COLORS.primary }}
            selectedValue={selectedMonth}
            onValueChange={(value) => setSelectedMonth(value)}
          >
            {monthsData.map((month) => (
              <Picker.Item
                key={month?.value}
                label={month?.label}
                value={month?.value}
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* Scrollable Transactions */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20, marginTop: 10 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
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
