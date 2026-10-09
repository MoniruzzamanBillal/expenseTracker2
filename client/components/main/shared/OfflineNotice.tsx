import { radius, spacing, text, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type TProps = {
  /** true when the failed read never reached a server (ApiReadError.offline). */
  offline: boolean;
  onRetry: () => void;
  /** The query's `dataUpdatedAt` — when the data on screen was last loaded successfully. */
  updatedAt?: number;
};

// A strip that sits *above* real content when a read fails but there is still something to show.
// Deliberately lighter than ErrorState (no card, no elevation), which is the full-screen fallback
// for when there is nothing to show at all.
export default function OfflineNotice({ offline, onRetry, updatedAt }: TProps) {
  const C = useTheme();

  const headline = offline
    ? "You're offline — showing saved data."
    : "Couldn't refresh — showing saved data.";
  const lastUpdated = updatedAt
    ? ` Last updated ${formatDistanceToNow(updatedAt, { addSuffix: true })}.`
    : "";

  return (
    <View style={[styles.strip, { backgroundColor: C?.warningBg }]}>
      <Ionicons
        name={offline ? "cloud-offline-outline" : "alert-circle-outline"}
        size={18}
        color={C?.warning}
      />
      <Text style={[text.caption, { color: C?.text, flex: 1 }]}>
        {headline}
        {lastUpdated}
      </Text>
      <TouchableOpacity onPress={onRetry} hitSlop={10} activeOpacity={0.7}>
        <Text style={[text.bodyMd, { color: C?.warning }]}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.base,
  },
});
