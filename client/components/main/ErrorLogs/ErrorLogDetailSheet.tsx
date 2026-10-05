import { formatLogDate, statusTone } from "@/components/main/ErrorLogs/ErrorLogCard";
import Sheet from "@/components/main/shared/Sheet";
import { radius, spacing, text, useTheme } from "@/theme";
import { TErrorLog } from "@/types/ErrorLog.types";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

type TProps = {
  log: TErrorLog | null;
  onDismiss: () => void;
};

function Field({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  const C = useTheme();

  return (
    <View style={{ gap: 2 }}>
      <Text style={[text.kicker, { color: C?.textSecondary }]}>{label}</Text>
      <Text style={[text.bodySm, { color: C?.text }]}>{value}</Text>
      {hint ? <Text style={[text.caption, { color: C?.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Renders the row the list already fetched — it deliberately does NOT call
 * GET /admin/error-logs/:id. The list endpoint returns complete rows (stack included), so a
 * second request would only add a loading state and another FETCH-1 failure mode (spec 36).
 */
export default function ErrorLogDetailSheet({ log, onDismiss }: TProps) {
  const C = useTheme();
  const tone = statusTone(C, log?.status ?? 0);
  const sources = Array.isArray(log?.errorSources) ? log?.errorSources : [];

  return (
    <Sheet visible={!!log} onDismiss={onDismiss}>
      {log ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          <View style={styles.headRow}>
            <View style={[styles.badge, { backgroundColor: tone?.bg }]}>
              <Text style={[text.caption, { color: tone?.fg }]}>{String(log.status)}</Text>
            </View>
            <Text style={[text.h3, { color: C?.text, flex: 1 }]} numberOfLines={1} ellipsizeMode="middle">
              {log.method} {log.path}
            </Text>
          </View>

          <Field label="When" value={formatLogDate(log.createdAt, "EEE d MMM yyyy, h:mm:ss a")} />
          <Field label="Error" value={log.errorName || "—"} />
          <Field
            label="User"
            value={log.userEmail || "unauthenticated"}
            hint={log.userId ? `id ${log.userId}` : null}
          />

          <View style={{ gap: 2 }}>
            <Text style={[text.kicker, { color: C?.textSecondary }]}>Message</Text>
            <Text style={[text.bodyMd, { color: C?.text }]}>{log.message}</Text>
          </View>

          {sources?.length ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={[text.kicker, { color: C?.textSecondary }]}>Sources</Text>
              {sources.map((source, index) => {
                // A 404's source has an empty `path` ([{ path: "", message: "API NOT FOUND!" }]),
                // so the arrow is dropped rather than rendered with nothing in front of it.
                const path = source?.path === 0 || source?.path ? String(source.path) : "";
                return (
                  <Text key={`${path}-${index}`} style={[text.caption, { color: C?.textMuted }]}>
                    {path ? `${path} → ` : ""}
                    {source?.message}
                  </Text>
                );
              })}
            </View>
          ) : null}

          {log.stack ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={[text.kicker, { color: C?.textSecondary }]}>Stack</Text>
              <View style={[styles.stackBox, { backgroundColor: C?.surface2, borderColor: C?.border }]}>
                {/* Horizontal, so long frames stay readable instead of wrapping into mush. */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={[styles.stackText, { color: C?.textSecondary }]}>{log.stack}</Text>
                </ScrollView>
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: {
    height: 22,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  stackBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  // The theme has no mono token and this is the only place that needs one.
  stackText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    lineHeight: 16,
  },
});
