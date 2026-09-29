import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { format } from "date-fns";
import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
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

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

/**
 * Day-grouped transaction list, every day open (Nocturne's Activity screen
 * removes the accordion — "every day is open, headed by its own in/out").
 */
export default function TransactionAccordion({ dailyData }: TProps) {
  const C = useTheme();
  const dark = C.statusBarStyle === "light";
  const openSwipeableRef = useRef<Swipeable | null>(null);

  return (
    <View>
      {dailyData?.map((day: TDailyData) => {
        const hasIncome = day?.income > 0;
        const hasExpense = day?.expense > 0;
        const net = day?.income - day?.expense;

        return (
          <View key={day?.date} style={styles.dayGroup}>
            <View style={styles.dayHeader}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={[text.bodyMd, { color: C.text }]}>{format(new Date(`${day?.date}T00:00:00`), "EEE d MMM")}</Text>
              </View>
              {hasIncome && hasExpense ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Text style={[text.bodySm, { color: C.income }]}>+৳{fmt(day?.income)}</Text>
                  <Text style={[text.bodySm, { color: C.expense }]}>−৳{fmt(day?.expense)}</Text>
                </View>
              ) : (
                <Text style={[text.bodySm, { color: net >= 0 ? C.income : C.expense }]}>
                  {net >= 0 ? "+" : "−"}৳{fmt(net)}
                </Text>
              )}
            </View>

            {day?.transactions?.length > 0 ? (
              <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, elevation(C, dark).card]}>
                {day?.transactions.map((item, i) => (
                  <TransactionCard
                    key={item?._id}
                    transactionData={item}
                    isLast={i === day?.transactions.length - 1}
                    onSwipeOpen={(ref) => {
                      if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
                        openSwipeableRef.current.close();
                      }
                      openSwipeableRef.current = ref;
                    }}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dayGroup: { marginBottom: spacing.base },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  card: { borderRadius: radius.card, borderWidth: 1 },
});
