import { useFetchData } from "@/hooks/useApi";
import { TTransactionHistory } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { Picker } from "@react-native-picker/picker";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import HistoryCard from "./HistoryCard";
import HistoryCardSkeleton from "./HistoryCardSkeleton";

const startYear = 2023;
const currentYear = new Date().getFullYear();

const yearsData = Array.from(
  { length: currentYear - startYear + 1 },
  (_, i) => startYear + i,
);

export default function HistoryPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // const {
  //   data: yearlyTransactions,
  //   isLoading,
  //   refetch,
  // } = useFetchData(["yearly-transaction"], `/transactions/yearly-transaction`);

  const {
    data: yearlyTransactions,
    isLoading,
    refetch,
  } = useFetchData(
    ["yearly-transaction", String(selectedYear)],
    `/transactions/yearly-transaction?targetYear=${selectedYear}`,
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  };

  return (
    <View style={{ width: "92%", alignSelf: "center", marginTop: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            marginRight: 8,
            color: COLORS.text,
          }}
        >
          Select Year:
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 4,
            overflow: "hidden",
            flex: 1,
          }}
        >
          <Picker
            selectedValue={selectedYear}
            onValueChange={(value) => setSelectedYear(value)}
          >
            {yearsData.map((year) => (
              <Picker.Item key={year} label={String(year)} value={year} />
            ))}
          </Picker>
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
          yearlyTransactions?.data?.map(
            (historyData: TTransactionHistory, ind: number) => (
              <HistoryCard key={ind} historyData={historyData} />
            ),
          )}
      </ScrollView>
    </View>
  );
}
