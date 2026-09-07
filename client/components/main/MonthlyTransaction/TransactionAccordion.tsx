import { fontFamily, radius, spacing, text, useTheme } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Collapsible from "react-native-collapsible";
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
  /** Weekly-only: render a read-only bar under the header row, ported from WeekDayRow's math. */
  showBar?: boolean;
  /** Weekly-only: scale for the bar width relative to the whole week's buckets. */
  maxAbs?: number;
};

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

export default function TransactionAccordion({
  dailyData,
  showBar = false,
  maxAbs = 1,
}: TProps) {
  const C = useTheme();
  const openSwipeableRef = useRef<Swipeable | null>(null);

  const [activeDate, setActiveDate] = useState<string | null>(null);

  const toggleAccordion = (date: string) => {
    setActiveDate(activeDate === date ? null : date);
  };

  return (
    <View>
      {dailyData &&
        dailyData?.map((day: TDailyData) => {
          const isActive = activeDate === day?.date;
          const net = day.income - day.expense;
          const isPositive = net >= 0;
          const barColor = isPositive ? C.income : C.expense;
          const barWidth =
            day.transactions.length > 0
              ? Math.max((Math.abs(net) / maxAbs) * 100, 6)
              : 0;

          return (
            <View
              key={day?.date}
              style={[
                styles.accordionItem,
                { backgroundColor: C.surface, borderColor: C.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggleAccordion(day?.date)}
                style={styles.header}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[text.bodyMd, { color: C.text }]}>
                    {format(new Date(`${day?.date}T00:00:00`), "d MMM")}
                  </Text>
                  <Text
                    style={[text.caption, { color: C.accent, marginLeft: 6 }]}
                  >
                    {format(new Date(`${day?.date}T00:00:00`), "EEEE")}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.amounts}>
                    <Text
                      style={[
                        text.caption,
                        { color: C.income, fontFamily: fontFamily.medium },
                      ]}
                    >
                      +৳{fmt(day?.income)}
                    </Text>
                    <Text
                      style={[
                        text.caption,
                        { color: C.expense, fontFamily: fontFamily.medium },
                      ]}
                    >
                      −৳{fmt(day?.expense)}
                    </Text>
                    <Text
                      style={[
                        text.caption,
                        {
                          color: net < 0 ? C.expense : C.accent,
                          fontFamily: fontFamily.semiBold,
                        },
                      ]}
                    >
                      B: {net.toFixed(2)}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isActive ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={C.textSecondary}
                    style={{ marginLeft: 8 }}
                  />
                </View>
              </TouchableOpacity>

              {showBar && (
                <View style={styles.barWrap}>
                  <View
                    style={[styles.barTrack, { backgroundColor: C.divider }]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        { width: `${barWidth}%`, backgroundColor: barColor },
                      ]}
                    />
                  </View>
                </View>
              )}

              <Collapsible collapsed={activeDate !== day?.date}>
                <View
                  style={{
                    // paddingHorizontal: spacing.xs,
                    paddingBottom: spacing.xs,
                    // backgroundColor: "red",
                  }}
                >
                  {day?.transactions?.map((item, i) => (
                    <TransactionCard
                      key={item?._id}
                      transactionData={item}
                      compact
                      isLast={i === day.transactions.length - 1}
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
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
  },
  header: {
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amounts: {
    flexDirection: "row",
    columnGap: spacing.sm,
  },
  barWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
});
