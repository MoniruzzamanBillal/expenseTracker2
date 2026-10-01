import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme, text, spacing, radius, elevation } from "@/theme";
import { Ionicons } from "@expo/vector-icons";

type TProps = {
  title: string;
  /** The API/axios error message, shown verbatim (never rewritten). */
  message: string;
  onRetry: () => void;
};

export default function ErrorState({ title, message, onRetry }: TProps) {
  const C = useTheme();
  const dark = C?.statusBarStyle === "light";
  return (
    <View style={[styles.card, { backgroundColor: C?.surface, borderColor: C?.border }, elevation(C, dark)?.card]}>
      <View style={styles.headRow}>
        <Ionicons name="alert-circle-outline" size={22} color={C?.expense} />
        <Text style={[text.bodyMd, { color: C?.text }]}>{title}</Text>
      </View>
      <Text style={[text.body, { color: C?.textSecondary }]}>{message}</Text>
      <TouchableOpacity
        onPress={onRetry}
        activeOpacity={0.8}
        style={[styles.retry, { borderColor: C?.accent, alignSelf: "flex-start" }]}
      >
        <Ionicons name="refresh-outline" size={17} color={C?.accent} />
        <Text style={[text.bodyMd, { color: C?.accent }]}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: spacing.base, gap: spacing.sm },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  retry: {
    height: spacing.control,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
