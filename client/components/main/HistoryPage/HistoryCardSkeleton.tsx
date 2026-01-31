import React from "react";
import { StyleSheet, View } from "react-native";

export default function HistoryCardSkeleton() {
  return (
    <View style={styles.container}>
      {/* Month skeleton */}
      <View
        style={[
          styles.skeleton,
          { width: "50%", height: 20, marginBottom: 10 },
        ]}
      />

      {/* Money Section skeleton */}
      <View style={styles.moneySection}>
        {/* Income section skeleton */}
        <View>
          <View style={[styles.skeleton, { width: 90, height: 20 }]} />
        </View>

        {/* Expense section skeleton */}
        <View>
          <View style={[styles.skeleton, { width: 90, height: 20 }]} />
        </View>

        {/* Balance section skeleton */}
        <View>
          <View style={[styles.skeleton, { width: 90, height: 20 }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    flexDirection: "column",
    backgroundColor: "white",
    padding: 10,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  moneySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  skeleton: {
    backgroundColor: "#e1e9ee",
    borderRadius: 4,
  },
});
