import { TTransaction } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Collapsible from "react-native-collapsible";
import { Swipeable } from "react-native-gesture-handler";
import { Text } from "react-native-paper";
import TransactionCard from "../shared/TransactionCard";

type TDailyData = {
  date: string;
  expense: number;
  income: number;
  transactions: TTransaction[];
};

type TProps = {
  dailyData: TDailyData[];
};

export default function TransactionAccordion({ dailyData }: TProps) {
  const openSwipeableRef = useRef<Swipeable | null>(null);

  const [activeDate, setActiveDate] = useState<string | null>(null);

  // console.log(dailyData);

  const toggleAccordion = (date: string) => {
    setActiveDate(activeDate === date ? null : date);
  };

  return (
    <View>
      {dailyData &&
        dailyData?.map((day: TDailyData) => {
          const isActive = activeDate === day?.date;

          return (
            <View key={day?.date} style={styles.accordionItem}>
              {/* Accordion Header */}

              <TouchableOpacity
                onPress={() => toggleAccordion(day?.date)}
                style={styles.header}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text style={styles.date}>
                    {format(new Date(day?.date as string), "d MMM")}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "900",
                      color: COLORS.primary,
                    }}
                  >
                    {" , "}
                    {format(
                      new Date(day?.transactions[0]?.createdAt as string),
                      "EEEE",
                    )}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.amounts}>
                    <Text style={styles.income}>+৳{day?.income}</Text>
                    <Text style={styles.expense}>-৳{day?.expense}</Text>
                    <Text style={styles.balance}>
                      B:{day?.income - day?.expense || 0}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isActive ? "chevron-up" : "chevron-down"}
                    size={24}
                    color="#333"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              </TouchableOpacity>

              {/* Collapsible Content */}
              <Collapsible collapsed={activeDate !== day?.date}>
                <View style={{ paddingHorizontal: 6 }}>
                  {day?.transactions?.map((item) => (
                    <TransactionCard
                      key={item?._id}
                      transactionData={item}
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
                  ))}
                </View>
              </Collapsible>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  accordionItem: {
    marginBottom: 6,
    backgroundColor: "#fff",
    borderRadius: 6,
    overflow: "hidden",
    elevation: 1,
    padding: 2,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  header: {
    padding: 8,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
  },
  amounts: {
    flexDirection: "row",
    columnGap: 8,
  },
  income: {
    color: "green",
    fontWeight: "bold",
    fontSize: 13,
  },
  expense: {
    color: "red",
    fontWeight: "bold",
    fontSize: 13,
  },
  balance: {
    fontWeight: "bold",
    fontSize: 13,
    color: COLORS.primary,
  },
});
