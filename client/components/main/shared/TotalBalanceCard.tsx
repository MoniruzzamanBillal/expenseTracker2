import { COLORS } from "@/utils/colors";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

type TPageProps = {
  income: number;
  expense: number;
};

export default function TotalBalanceCard({ income, expense }: TPageProps) {
  return (
    <View style={cardStyles.container}>
      {/* header , total balance section  */}
      <View style={{ marginBottom: 5, alignSelf: "center" }}>
        <Text
          style={{
            fontSize: 20,
            color: COLORS.text,
            fontWeight: "700",
          }}
        >
          Total Banalce
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignContent: "center",
            columnGap: 2,
          }}
        >
          <Text style={[cardStyles.title, { fontSize: 24 }]}>৳</Text>
          <Text style={[cardStyles.title, { fontSize: 24 }]}>
            {income - expense}
          </Text>
        </View>
      </View>
      {/*  */}

      {/* income expense section  */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          columnGap: 20,
        }}
      >
        {/* income view  */}
        <View>
          <Text
            style={{
              fontSize: 15,
              color: COLORS.income,
              fontWeight: "600",
              textAlign: "center",
              marginBottom: 1,
            }}
          >
            Income
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignContent: "center",
              columnGap: 3,
            }}
          >
            <Text
              style={{ fontSize: 16, fontWeight: "bold", color: COLORS.income }}
            >
              +৳
            </Text>
            <Text
              style={{ fontSize: 16, fontWeight: "600", color: COLORS.income }}
            >
              {income}
            </Text>
          </View>
        </View>

        {/* horizontal line  */}
        <View
          style={{
            height: "100%",
            width: 1,
            backgroundColor: COLORS.border,
          }}
        />

        {/* expense view  */}
        <View>
          <Text
            style={{
              fontSize: 15,
              color: COLORS.expense,
              fontWeight: "600",
              textAlign: "center",
              marginBottom: 1,
            }}
          >
            Expense
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignContent: "center",
              columnGap: 3,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                color: COLORS.expense,
              }}
            >
              +৳
            </Text>
            <Text
              style={{ fontSize: 16, fontWeight: "600", color: COLORS.expense }}
            >
              {expense}
            </Text>
          </View>
        </View>

        {/*  */}
      </View>

      {/*  */}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    marginTop: 9,
    width: "70%",
    alignSelf: "center",
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  title: {
    fontWeight: "bold",
    color: COLORS.text,
  },
});
