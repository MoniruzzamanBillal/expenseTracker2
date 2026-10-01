import { useUserContext } from "@/context/user.context";
import { useFetchData } from "@/hooks/useApi";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";
import { useFetchTransactionRequests } from "@/hooks/useTransactionRequests";
import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import CategoryBreakdown, {
  TBreakdownEntry,
} from "../shared/CategoryBreakdown";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import PendingSyncBanner from "../shared/PendingSyncBanner";
import TransactionCard from "../shared/TransactionCard";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";
import NetTodayCard from "./NetTodayCard";

type TData = {
  expense: number;
  income: number;
  transactions: TTransaction[];
  categoryBreakdown: TBreakdownEntry[];
};

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function HomePage() {
  const C = useTheme();
  const dark = C.statusBarStyle === "light";
  const router = useRouter();
  const { user } = useUserContext();
  const openSwipeableRef = useRef<Swipeable | null>(null);

  const {
    data: dailyTransaction,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useFetchData<TData>(
    ["daily-transaction"],
    `/transactions/daily-transaction`,
  );

  const { data: pendingTransactions } = usePendingTransactions();
  const { data: requestsData } = useFetchTransactionRequests();
  const pendingRequestCount = requestsData?.data?.length ?? 0;

  const pendingAsTransactions: TTransaction[] = (pendingTransactions ?? []).map(
    (item) => ({
      _id: item?.localId,
      title: item?.payload?.title,
      description: item?.payload?.description,
      amount: item?.payload?.amount,
      type: item?.payload?.type,
      createdAt: item?.createdAt,
    }),
  );

  const income = dailyTransaction?.data?.income ?? 0;
  const expense = dailyTransaction?.data?.expense ?? 0;
  const transactions = dailyTransaction?.data?.transactions ?? [];

  const categoryBreakdown = dailyTransaction?.data?.categoryBreakdown ?? [];

  // console.log("categoryBreakdown = ", categoryBreakdown);

  const entryCount = transactions.length;

  const todayLabel = useMemo(
    () =>
      new Date()
        .toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
        .replace(",", " ·"),
    [],
  );

  const handleSwipeOpen = (ref: Swipeable) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  };

  const allRows = [...pendingAsTransactions, ...transactions];

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: C.background }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.screenPad },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.accent}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            activeOpacity={0.8}
            style={[styles.avatar, { backgroundColor: C.accentDim }]}
          >
            <Text style={[text.bodyMd, { color: C.accentText }]}>
              {initials(user?.name)}
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            {/* Both lines sit one step under their tokens, local to this header
                so the other screen titles keep text.h2/text.kicker. lineHeight
                and letterSpacing are scaled with the size — the tokens set both,
                so overriding fontSize alone would leave the original leading. */}
            <Text
              style={[
                text.kicker,
                {
                  color: C.textSecondary,
                  fontSize: 10,
                  lineHeight: 13,
                  letterSpacing: 0.9,
                },
              ]}
            >
              {todayLabel}
            </Text>
            <Text
              style={[
                text.h2,
                {
                  color: C.text,
                  fontSize: 18,
                  lineHeight: 22,
                  letterSpacing: -0.27,
                },
              ]}
            >
              Today
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/transaction-requests")}
            activeOpacity={0.8}
            style={[styles.trayBtn, { borderColor: C.border }]}
          >
            <Ionicons name="file-tray-outline" size={20} color={C.text} />
            {pendingRequestCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: C.accent }]}>
                <Text
                  style={[text.caption, { color: C.background, fontSize: 11 }]}
                >
                  {pendingRequestCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {isError ? (
          <>
            <ErrorState
              title="Couldn't load today"
              message={(error as any)?.message ?? "Network Error"}
              onRetry={refetch}
            />
            {/* Also rendered here, not just in the loaded branch below: being
                offline is exactly when the queue has something in it *and*
                when daily-transaction fails, so Sync now has to stay reachable
                on the error screen too. It self-hides on an empty queue, so
                only one of the two ever shows anything. */}
            <PendingSyncBanner />
          </>
        ) : isLoading ? (
          <TransactionCardSkeleton />
        ) : (
          <>
            <NetTodayCard
              income={income}
              expense={expense}
              entryCount={entryCount}
            />

            {categoryBreakdown.length > 0 && (
              <CategoryBreakdown
                data={categoryBreakdown}
                selected={null}
                onSelect={() => {}}
              />
            )}

            <PendingSyncBanner />

            <View style={styles.entriesHead}>
              <Text style={[text.kicker, { color: C.textSecondary }]}>
                Entries
              </Text>
              <Text style={[text.caption, { color: C.textMuted }]}>
                Newest first
              </Text>
            </View>

            {allRows?.length === 0 ? (
              <EmptyState
                title="Nothing logged today"
                subtitle="Entries you add today show up here, newest first."
                icon="receipt-outline"
              />
            ) : (
              <View
                style={[
                  styles.listCard,
                  { backgroundColor: C.surface, borderColor: C.border },
                  elevation(C, dark).card,
                ]}
              >
                {pendingAsTransactions &&
                  pendingAsTransactions?.map((t, i) => (
                    <TransactionCard
                      key={t?._id}
                      transactionData={t}
                      pending
                      isLast={i === allRows?.length - 1}
                    />
                  ))}
                {transactions &&
                  transactions?.map((t, i) => (
                    <TransactionCard
                      key={t?._id}
                      transactionData={t}
                      isLast={
                        pendingAsTransactions?.length + i ===
                        allRows?.length - 1
                      }
                      onSwipeOpen={handleSwipeOpen}
                    />
                  ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    height: 48,
    marginBottom: spacing.base,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  trayBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  entriesHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  listCard: { borderRadius: radius.card, borderWidth: 1 },
});
