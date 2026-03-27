import { COLORS } from "@/utils/colors";
import React from "react";
import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

export default function TransactionCardSkeleton() {
  return (
    <View style={styles.mainContainer}>
      <View style={styles.wrapper}>
        {/* Transaction list skeletons */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 10 }}
          style={styles.transactionList}
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <View key={index} style={styles.transactionCard}>
              <View style={[styles.skeleton, { width: "80%", height: 20 }]} />
              <View style={{ marginTop: 6 }}>
                <View style={[styles.skeleton, { width: "50%", height: 16 }]} />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  wrapper: {
    width: "98%",
    alignSelf: "center",
  },

  transactionList: {
    marginTop: 6,
  },
  transactionCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
  },
  skeleton: {
    backgroundColor: "#e1e9ee",
    borderRadius: 4,
  },
});
