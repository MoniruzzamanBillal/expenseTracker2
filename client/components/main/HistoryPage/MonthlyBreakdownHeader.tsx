import { COLORS } from "@/utils/colors";
import { StyleSheet, Text, View } from "react-native";

const MonthlyBreakdownHeader = ({ year }: { year: number }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monthly Breakdown</Text>
      <Text style={styles.subtitle}>FY {year}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#6B7280", // or COLORS.textLight
  },
});

export default MonthlyBreakdownHeader;
