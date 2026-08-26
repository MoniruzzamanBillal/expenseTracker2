import {
  usePendingTransactions,
  useSyncPendingTransactions,
} from "@/hooks/usePendingTransactions";
import { COLORS } from "@/utils/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

export default function PendingSyncBanner() {
  const { data: pendingTransactions } = usePendingTransactions();
  const { syncAll, isSyncing } = useSyncPendingTransactions();

  const pendingCount = pendingTransactions?.length ?? 0;

  if (!pendingCount) return null;

  return (
    <View style={styles.container}>
      <View style={styles.textRow}>
        <MaterialCommunityIcons
          name="cloud-upload-outline"
          size={18}
          color={COLORS.primary}
        />
        <Text style={styles.text}>
          {pendingCount} transaction{pendingCount === 1 ? "" : "s"} pending sync
        </Text>
      </View>

      <Button
        mode="contained"
        compact
        disabled={isSyncing}
        onPress={syncAll}
        style={{ backgroundColor: COLORS.primary }}
        labelStyle={{
          fontSize: 12,
          fontWeight: "400",
          color: COLORS.white,
        }}
      >
        {isSyncing ? "Syncing..." : "Sync now"}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    flexShrink: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
  },
});
