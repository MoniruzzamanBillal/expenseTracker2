import { useUserContext } from "@/context/user.context";
import { useFetchData } from "@/hooks/useApi";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";
import { radius, spacing, text, useTheme } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useRef } from "react";
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import EmptyState from "../shared/EmptyState";
import PendingSyncBanner from "../shared/PendingSyncBanner";
import TotalBalanceCard from "../shared/TotalBalanceCard";
import TransactionCard from "../shared/TransactionCard";
import TransactionCardSkeleton from "../shared/TransactionCardSkeleton";

type TData = {
  expense: number;
  income: number;
  transactions: TTransaction[];
};

export default function HomePage() {
  const C = useTheme();
  const { user, logoutFunction } = useUserContext();
  const openSwipeableRef = useRef<Swipeable | null>(null);

  const {
    data: dailyTransaction,
    isLoading,
    refetch,
    isRefetching,
  } = useFetchData<TData>(
    ["daily-transaction"],
    `/transactions/daily-transaction`,
  );

  const { data: pendingTransactions } = usePendingTransactions();

  // Not-yet-synced items shaped like TTransaction so they can render through
  // the same TransactionCard (with pending=true) as normal transactions.
  const pendingAsTransactions: TTransaction[] = (pendingTransactions ?? []).map(
    (item) => ({
      _id: item.localId,
      title: item.payload.title,
      description: item.payload.description,
      amount: item.payload.amount,
      type: item.payload.type,
      createdAt: item.createdAt,
    }),
  );

  const transactions = dailyTransaction?.data?.transactions ?? [];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const handleLogoutPress = () => {
    Alert.alert("Log out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logoutFunction },
    ]);
  };

  const handleSwipeOpen = (ref: Swipeable) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
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
          <View>
            <Text
              style={[
                text.caption,
                { color: C.textSecondary, marginBottom: 2 },
              ]}
            >
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
            <Text style={[text.h3, { color: C.text }]}>
              {greeting}
              {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleLogoutPress}
            activeOpacity={0.8}
            style={[
              styles.logoutBtn,
              { backgroundColor: C.surface2, borderColor: C.border },
            ]}
          >
            <MaterialCommunityIcons
              name="logout"
              size={18}
              color={C.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <TotalBalanceCard
          income={dailyTransaction?.data?.income ?? 0}
          expense={dailyTransaction?.data?.expense ?? 0}
          label="Today's Balance"
        />

        <PendingSyncBanner />

        {isLoading ? (
          <TransactionCardSkeleton />
        ) : !transactions.length && !pendingAsTransactions.length ? (
          <EmptyState
            title="No transactions today"
            subtitle="Tap + to add your first one"
          />
        ) : (
          <>
            {pendingAsTransactions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <Text style={[text.label, { color: C.textSecondary }]}>
                    PENDING SYNC
                  </Text>
                </View>
                {pendingAsTransactions.map((t) => (
                  <TransactionCard key={t._id} transactionData={t} pending />
                ))}
              </View>
            )}

            {transactions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <Text style={[text.label, { color: C.textSecondary }]}>
                    TODAY
                  </Text>
                </View>
                {transactions.map((t, i) => (
                  <TransactionCard
                    key={t?._id}
                    transactionData={t}
                    isLast={i === transactions.length - 1}
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
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { marginBottom: spacing.base },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});
