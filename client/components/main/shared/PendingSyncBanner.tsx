import {
  usePendingTransactions,
  useSyncPendingTransactions,
} from "@/hooks/usePendingTransactions";
import { useTheme, text, spacing, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import PrimaryButton from "./PrimaryButton";

// Nocturne's Today build notes say the offline queue merges into the entry
// list as "waiting to sync" rows (TransactionCard's pending branch) instead
// of a separate banner — this component is kept only for the Sync-now
// action itself, which the new list design doesn't otherwise surface.
export default function PendingSyncBanner() {
  const C = useTheme();
  const { data: pendingTransactions } = usePendingTransactions();
  const { syncAll, isSyncing } = useSyncPendingTransactions();

  const pendingCount = pendingTransactions?.length ?? 0;

  if (!pendingCount) return null;

  return (
    <View style={[styles.container, { backgroundColor: C.warningBg }]}>
      <View style={styles.textRow}>
        <Ionicons name="cloud-offline-outline" size={19} color={C.warning} />
        <Text style={[text.bodySm, { color: C.text, flex: 1 }]}>
          {pendingCount} {pendingCount === 1 ? "entry is" : "entries are"} saved on this phone. They&apos;ll sync when you&apos;re back online.
        </Text>
      </View>

      <PrimaryButton label={isSyncing ? "Syncing…" : "Sync now"} onPress={syncAll} loading={isSyncing} variant="outline" color={C.warning} style={styles.syncBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.card,
    padding: spacing.md,
    paddingHorizontal: spacing.md + 2,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  syncBtn: {
    height: 36,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
  },
});
