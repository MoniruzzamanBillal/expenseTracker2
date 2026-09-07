import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme, text, radius } from "@/theme";
import { TransactionTypeConst, TTransactionType } from "@/constants/TransactionType.constant";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type TProps = {
  value: TTransactionType;
  onChange: (v: TTransactionType) => void;
};

export default function TypeToggle({ value, onChange }: TProps) {
  const C = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: C.surface2, borderColor: C.border }]}>
      {(Object.values(TransactionTypeConst) as TTransactionType[]).map((type) => {
        const active = value === type;
        const activeColor = type === "income" ? C.income : C.expense;
        const activeBg = type === "income" ? C.incomeBg : C.expenseBg;
        return (
          <TouchableOpacity
            key={type}
            onPress={() => onChange(type)}
            activeOpacity={0.8}
            style={[
              styles.opt,
              { borderColor: active ? activeColor : "transparent", backgroundColor: active ? activeBg : "transparent" },
            ]}
          >
            <View style={styles.optContent}>
              <MaterialCommunityIcons
                name={type === "income" ? "arrow-up" : "arrow-down"}
                size={16}
                color={active ? activeColor : C.textSecondary}
              />
              <Text style={[text.bodyMd, { color: active ? activeColor : C.textSecondary }]}>
                {type === "income" ? "Income" : "Expense"}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: radius.lg, borderWidth: 1, padding: 4, gap: 4 },
  opt: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: "center", borderWidth: 1 },
  optContent: { flexDirection: "row", alignItems: "center", gap: 6 },
});
