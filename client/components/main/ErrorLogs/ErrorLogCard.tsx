import { ColorScheme, elevation, radius, spacing, text, useTheme } from "@/theme";
import { TErrorLog } from "@/types/ErrorLog.types";
import { format } from "date-fns";
import React from "react";
import { StyleSheet, Text as RNText, TouchableOpacity, View } from "react-native";

/**
 * Status → tone, from existing tokens only. 4xx reads as `warning` rather than `expense`
 * on purpose: 404s from bot scans are the highest-volume row type (server spec 17), and a
 * wall of red would bury the 5xx rows that actually need attention.
 */
export const statusTone = (C: ColorScheme, status: number) => {
  if (status >= 500) return { fg: C?.expense, bg: C?.expenseBg };
  if (status >= 400) return { fg: C?.warning, bg: C?.warningBg };
  return { fg: C?.textSecondary, bg: C?.surface2 };
};

/**
 * Dates are formatted defensively — this screen exists to show failures, so a row with an
 * unparseable `createdAt` must render a dash, not throw and take the list down with it.
 */
export const formatLogDate = (value?: string | null, pattern = "d MMM, h:mm a") => {
  if (!value) return "—";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return format(date, pattern);
  } catch {
    return "—";
  }
};

type TProps = {
  log: TErrorLog;
  onPress: () => void;
};

export default function ErrorLogCard({ log, onPress }: TProps) {
  const C = useTheme();
  const dark = C?.statusBarStyle === "light";
  const tone = statusTone(C, log?.status);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.card,
        { backgroundColor: C?.surface, borderColor: C?.border },
        elevation(C, dark)?.card,
      ]}
    >
      <View style={styles.headRow}>
        <View style={[styles.badge, { backgroundColor: tone?.bg }]}>
          <RNText style={[text.caption, { color: tone?.fg }]}>{String(log?.status)}</RNText>
        </View>
        <RNText
          style={[text.bodySm, { color: C?.textSecondary, flex: 1 }]}
          numberOfLines={1}
          // Bot-scan 404 paths are long and it's the tail that identifies them.
          ellipsizeMode="middle"
        >
          <RNText style={{ color: C?.textSecondary }}>{log?.method} </RNText>
          <RNText style={{ color: C?.text }}>{log?.path}</RNText>
        </RNText>
      </View>

      <RNText style={[text.bodyMd, { color: C?.text }]} numberOfLines={2}>
        {log?.message}
      </RNText>

      <RNText style={[text.caption, { color: C?.textMuted }]} numberOfLines={1}>
        {log?.errorName ? `${log.errorName} · ` : ""}
        {formatLogDate(log?.createdAt)}
      </RNText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: {
    height: 22,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
