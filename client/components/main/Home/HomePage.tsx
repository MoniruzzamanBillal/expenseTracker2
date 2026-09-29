import { useUserContext } from "@/context/user.context";
import { useFetchData } from "@/hooks/useApi";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";
import { useFetchTransactionRequests } from "@/hooks/useTransactionRequests";
import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import CategoryBreakdown, { TBreakdownEntry } from "../shared/CategoryBreakdown";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import TransactionCard from "../shared/TransactionCard";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";

type TData = {
  expense: number;
  income: number;
  transactions: TTransaction[];
  categoryBreakdown: TBreakdownEntry[];
};

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

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
  } = useFetchData<TData>(["daily-transaction"], `/transactions/daily-transaction`);

  const { data: pendingTransactions } = usePendingTransactions();
  const { data: requestsData } = useFetchTransactionRequests();
  const pendingRequestCount = requestsData?.data?.length ?? 0;

  const pendingAsTransactions: TTransaction[] = (pendingTransactions ?? []).map((item) => ({
    _id: item?.localId,
    title: item?.payload?.title,
    description: item?.payload?.description,
    amount: item?.payload?.amount,
    type: item?.payload?.type,
    createdAt: item?.createdAt,
  }));

  const income = dailyTransaction?.data?.income ?? 0;
  const expense = dailyTransaction?.data?.expense ?? 0;
  const net = income - expense;
  const isPositive = net >= 0;
  const transactions = dailyTransaction?.data?.transactions ?? [];
  const categoryBreakdown = dailyTransaction?.data?.categoryBreakdown ?? [];
  const entryCount = transactions.length;

  const todayLabel = useMemo(
    () =>
      new Date()
        .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
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
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.accent} />}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/settings")} activeOpacity={0.8} style={[styles.avatar, { backgroundColor: C.accentDim }]}>
            <Text style={[text.bodyMd, { color: C.accentText }]}>{initials(user?.name)}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[text.kicker, { color: C.textSecondary }]}>{todayLabel}</Text>
            <Text style={[text.h2, { color: C.text }]}>Today</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/transaction-requests")} activeOpacity={0.8} style={[styles.trayBtn, { borderColor: C.border }]}>
            <Ionicons name="file-tray-outline" size={20} color={C.text} />
            {pendingRequestCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: C.accent }]}>
                <Text style={[text.caption, { color: C.background, fontSize: 11 }]}>{pendingRequestCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {isError ? (
          <ErrorState title="Couldn't load today" message={(error as any)?.message ?? "Network Error"} onRetry={refetch} />
        ) : isLoading ? (
          <TransactionCardSkeleton />
        ) : (
          <>
            <View style={[styles.netCard, { backgroundColor: C.surface }, elevation(C, dark).glow]}>
              <View style={styles.rowBetween}>
                <Text style={[text.kicker, { color: C.textSecondary }]}>Net today</Text>
                <Text style={[text.caption, { color: C.textMuted }]}>{entryCount} entries</Text>
              </View>
              <View style={styles.netAmountRow}>
                <Text style={[styles.netSign, { color: net === 0 ? C.textMuted : isPositive ? C.income : C.expense }]}>{net === 0 ? "" : isPositive ? "+" : "−"}</Text>
                <Text style={[styles.netCurrency, { color: net === 0 ? C.textMuted : isPositive ? C.income : C.expense }]}>৳</Text>
                <Text style={[text.display, { color: net === 0 ? C.textMuted : isPositive ? C.income : C.expense }]}>{fmt(net)}</Text>
              </View>
              {income + expense > 0 ? (
                <View style={styles.splitBar}>
                  <View style={{ flex: income || 0.001, borderRadius: 3, backgroundColor: C.income }} />
                  <View style={{ flex: expense || 0.001, borderRadius: 3, backgroundColor: C.expense }} />
                </View>
              ) : (
                <View style={[styles.splitBarEmpty, { backgroundColor: C.surface2, borderColor: C.border }]} />
              )}
              <View style={styles.inOutRow}>
                <View>
                  <View style={styles.inOutLabelRow}>
                    <View style={[styles.dot, { backgroundColor: C.income }]} />
                    <Text style={[text.caption, { color: C.textSecondary }]}>In</Text>
                  </View>
                  <Text style={[text.amountMd, { color: C.income }]}>+৳{fmt(income)}</Text>
                </View>
                <View>
                  <View style={styles.inOutLabelRow}>
                    <View style={[styles.dot, { backgroundColor: C.expense }]} />
                    <Text style={[text.caption, { color: C.textSecondary }]}>Out</Text>
                  </View>
                  <Text style={[text.amountMd, { color: C.expense }]}>−৳{fmt(expense)}</Text>
                </View>
              </View>
            </View>

            {categoryBreakdown.length > 0 && <CategoryBreakdown data={categoryBreakdown} selected={null} onSelect={() => {}} />}

            <View style={styles.entriesHead}>
              <Text style={[text.kicker, { color: C.textSecondary }]}>Entries</Text>
              <Text style={[text.caption, { color: C.textMuted }]}>Newest first</Text>
            </View>

            {allRows.length === 0 ? (
              <EmptyState
                title="Nothing logged today"
                subtitle="Entries you add today show up here, newest first."
                icon="receipt-outline"
              />
            ) : (
              <View style={[styles.listCard, { backgroundColor: C.surface, borderColor: C.border }, elevation(C, dark).card]}>
                {pendingAsTransactions.map((t, i) => (
                  <TransactionCard key={t?._id} transactionData={t} pending isLast={i === allRows.length - 1} />
                ))}
                {transactions.map((t, i) => (
                  <TransactionCard
                    key={t?._id}
                    transactionData={t}
                    isLast={pendingAsTransactions.length + i === allRows.length - 1}
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
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  trayBtn: { width: 40, height: 40, borderRadius: radius.card, borderWidth: 1, alignItems: "center", justifyContent: "center" },
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
  netCard: { borderRadius: radius.card, padding: spacing.base, paddingBottom: spacing.lg, gap: spacing.md, marginBottom: spacing.base },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  netAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  netSign: { fontSize: 26 },
  netCurrency: { fontSize: 26 },
  splitBar: { flexDirection: "row", gap: 3, height: 6 },
  splitBarEmpty: { height: 6, borderRadius: 3, borderWidth: 1 },
  inOutRow: { flexDirection: "row", gap: spacing.xl },
  inOutLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 1 },
  dot: { width: 6, height: 6, borderRadius: 1 },
  entriesHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  listCard: { borderRadius: radius.card, borderWidth: 1 },
});
