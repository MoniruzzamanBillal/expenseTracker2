import {
  usePendingTransactions,
  useSyncPendingTransactions,
} from "@/hooks/usePendingTransactions";
import { useTheme, text, spacing, radius } from "@/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import PrimaryButton from "./PrimaryButton";

export default function PendingSyncBanner() {
  const C = useTheme();
  const { data: pendingTransactions } = usePendingTransactions();
  const { syncAll, isSyncing } = useSyncPendingTransactions();

  const pendingCount = pendingTransactions?.length ?? 0;

  if (!pendingCount) return null;

  return (
    <View style={[styles.container, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}>
      <View style={styles.textRow}>
        <MaterialCommunityIcons name="cloud-upload-outline" size={18} color={C.accent} />
        <Text style={[text.bodySm, { color: C.text }]}>
          {pendingCount} transaction{pendingCount === 1 ? "" : "s"} pending sync
        </Text>
      </View>

      <PrimaryButton
        label={isSyncing ? "Syncing..." : "Sync now"}
        onPress={syncAll}
        loading={isSyncing}
        style={styles.syncBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    flexShrink: 1,
  },
  syncBtn: {
    height: 36,
    paddingHorizontal: spacing.md,
  },
});
