import { TTransactionHistory } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

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

export default function HistoryCard({
  historyData,
}: {
  historyData: TTransactionHistory;
}) {
  //   console.log(historyData);
  return (
    <View style={historyCardStyle.container}>
      <Text
        style={{
          fontWeight: 700,
          fontSize: 18,
          marginBottom: 2,
          color: COLORS.primary,
        }}
      >
        {monthNames[historyData?.month]}
      </Text>

      {/* money section  */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          columnGap: 6,
        }}
      >
        {/* income section  */}
        <View
          style={{
            flexDirection: "row",
            alignContent: "center",
            justifyContent: "center",
            columnGap: 1,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: COLORS.income,
            }}
          >
            Inc :
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: COLORS.income,
            }}
          >
            ৳
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: COLORS.income,
            }}
          >
            {historyData?.income}
          </Text>
        </View>

        {/* expense section  */}
        <View
          style={{
            flexDirection: "row",
            alignContent: "center",
            justifyContent: "center",
            columnGap: 1,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: COLORS.expense,
            }}
          >
            Exp :
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: COLORS.expense,
            }}
          >
            ৳
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: COLORS.expense,
            }}
          >
            {historyData?.expense}
          </Text>
        </View>

        {/* total balance section  */}
        <View
          style={{
            flexDirection: "row",
            alignContent: "center",
            justifyContent: "center",
            columnGap: 1,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            Balance :
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            ৳
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            {historyData?.income - historyData?.expense}
          </Text>
        </View>

        {/*  */}
      </View>
    </View>
  );
}

const historyCardStyle = StyleSheet.create({
  container: {
    width: "98%",
    margin: "auto",
    marginVertical: 6,
    flexDirection: "column",
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
