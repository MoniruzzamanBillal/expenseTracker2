import ErrorLogCard from "@/components/main/ErrorLogs/ErrorLogCard";
import ErrorLogDetailSheet from "@/components/main/ErrorLogs/ErrorLogDetailSheet";
import EmptyState from "@/components/main/shared/EmptyState";
import ErrorState from "@/components/main/shared/ErrorState";
import { useUserContext } from "@/context/user.context";
import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TErrorLog, TErrorLogListPayload } from "@/types/ErrorLog.types";
import { isAdmin } from "@/utils/isAdmin";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_SIZE = 20;

export default function ErrorLogsPage() {
  const C = useTheme();
  const router = useRouter();
  const { user } = useUserContext();
  const scrollRef = useRef<ScrollView>(null);

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TErrorLog | null>(null);

  const admin = isAdmin(user);

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useFetchData<TErrorLogListPayload>(
      // `page` must be part of the key, or TanStack serves page 1's cache for every page.
      ["error-logs", String(page)],
      `/admin/error-logs?page=${page}&limit=${PAGE_SIZE}`,
      {
        enabled: admin,
        // Keeps the current page on screen while the next one loads, instead of flashing
        // the skeleton. This is the client's first paginated read — no pattern to copy.
        placeholderData: (previous) => previous,
      },
    );

  const logs = data?.data?.result ?? [];
  // `meta` is nested inside `data`, not hoisted — see types/ErrorLog.types.ts.
  const meta = data?.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // A 403 (or any HTTP error) does NOT set `isError`: the response interceptor resolves
  // instead of rejecting, so apiGet returns `undefined` and the query reports success with
  // no payload (known-issues.md#FETCH-1). Hence the explicit `!data?.success` test.
  const failed = isError || (!isLoading && !isRefetching && !data?.success);

  const goToPage = (next: number) => {
    setPage(next);
    // Otherwise the next page opens scrolled to wherever the previous one was left.
    scrollRef?.current?.scrollTo({ y: 0, animated: false });
  };

  const navRow = (
    <View style={styles.nav}>
      <TouchableOpacity onPress={() => router?.back()} hitSlop={8} style={{ marginLeft: -10 }}>
        <Ionicons name="chevron-back" size={22} color={C?.text} />
      </TouchableOpacity>
      <Text style={[text.h2, { color: C?.text }]}>Error logs</Text>
    </View>
  );

  // Belt and braces: the Settings entry is already hidden for non-admins, but the screen
  // never trusts navigation. The subtitle names the re-login because a just-promoted admin
  // carries a token with no `userRole` claim until they sign in again (spec 36, Step 0).
  if (!admin) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C?.background }]} edges={["top"]}>
        <View style={{ paddingHorizontal: spacing.screenPad }}>
          {navRow}
          <EmptyState
            title="Admins only"
            subtitle="This screen is restricted. If you were just given admin access, log out and log back in."
            icon="lock-closed-outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C?.background }]} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C?.accent}
          />
        }
      >
        {navRow}

        {failed ? (
          <ErrorState
            title="Couldn't load error logs"
            // The interceptor already toasted the server's real message (FETCH-1), so this
            // must not invent a cause it cannot know.
            message={(error as Error)?.message ?? "Please try again."}
            onRetry={refetch}
          />
        ) : isLoading ? (
          <View style={{ gap: spacing.sm }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeleton, { backgroundColor: C?.skeleton }]} />
            ))}
          </View>
        ) : !logs?.length ? (
          <EmptyState
            title="No errors logged"
            subtitle="Nothing has failed in the last 30 days."
            icon="shield-checkmark-outline"
          />
        ) : (
          <>
            <Text style={[text.bodySm, { color: C?.textSecondary, marginBottom: spacing.sm }]}>
              {meta?.total ?? 0} errors · page {meta?.page ?? page} of {totalPages}
            </Text>

            <View style={{ gap: spacing.sm }}>
              {logs.map((log) => (
                <ErrorLogCard key={log?._id} log={log} onPress={() => setSelected(log)} />
              ))}
            </View>

            {totalPages > 1 ? (
              <View style={styles.pager}>
                <PagerButton
                  label="Prev"
                  icon="chevron-back"
                  disabled={page <= 1}
                  onPress={() => goToPage(page - 1)}
                />
                <PagerButton
                  label="Next"
                  icon="chevron-forward"
                  iconRight
                  disabled={page >= totalPages}
                  onPress={() => goToPage(page + 1)}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <ErrorLogDetailSheet log={selected} onDismiss={() => setSelected(null)} />
    </SafeAreaView>
  );
}

function PagerButton({
  label,
  icon,
  iconRight,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconRight?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const C = useTheme();
  const tint = disabled ? C?.textMuted : C?.accent;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.pagerBtn,
        { borderColor: disabled ? C?.border : C?.accentBorder, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      {iconRight ? null : <Ionicons name={icon} size={18} color={tint} />}
      <Text style={[text.bodyMd, { color: tint }]}>{label}</Text>
      {iconRight ? <Ionicons name={icon} size={18} color={tint} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 44,
    marginBottom: spacing.base,
  },
  skeleton: { height: 92, borderRadius: radius.card },
  pager: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  pagerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: spacing.field,
    borderWidth: 1,
    borderRadius: radius.card,
  },
});
