import React from "react";
import { StyleSheet, View } from "react-native";

export default function PageSkeleton() {
  return (
    <View style={styles.mainContainer}>
      <View style={styles.wrapper}>
        {/* Total Balance Card Skeleton */}
        <View style={styles.balanceCard}>
          <View style={[styles.skeleton, { width: 120, height: 20 }]} />
          <View
            style={[styles.skeleton, { width: 190, height: 35, marginTop: 10 }]}
          />
          <View style={styles.balanceRow}>
            <View style={[styles.skeleton, { width: 80, height: 20 }]} />
            <View style={[styles.skeleton, { width: 80, height: 20 }]} />
          </View>
        </View>

        {/* Transactions title */}
        <View style={{ marginTop: 10 }}>
          <View style={[styles.skeleton, { width: 220, height: 24 }]} />
        </View>

        {/* Transaction list skeletons */}
        <View style={styles.transactionList}>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={styles.transactionCard}>
              <View style={[styles.skeleton, { width: "80%", height: 20 }]} />
              <View style={{ marginTop: 6 }}>
                <View style={[styles.skeleton, { width: "50%", height: 16 }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    paddingTop: 22,
    backgroundColor: "white",
  },
  wrapper: {
    width: "90%",
    alignSelf: "center",
  },
  balanceCard: {
    width: "75%",
    alignSelf: "center",
    backgroundColor: "#f3f3f3",
    padding: 16,
    borderRadius: 8,
    overflow: "hidden", // Important for shimmer effect
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  transactionList: {
    marginTop: 18,
  },
  transactionCard: {
    backgroundColor: "#f3f3f3",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    overflow: "hidden",
  },
  skeleton: {
    backgroundColor: "#e1e9ee",
    borderRadius: 4,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    width: "30%",
    backgroundColor: "rgba(255,255,255,0.4)",
    opacity: 0.7,
  },
});
