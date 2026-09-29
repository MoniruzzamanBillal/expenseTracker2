import ConfirmModal from "@/components/main/shared/ConfirmModal";
import EmptyState from "@/components/main/shared/EmptyState";
import ErrorState from "@/components/main/shared/ErrorState";
import TransactionCardSkeleton from "@/components/main/shared/TransactionCardSkeleton";
import TransactionRequestEditModal from "@/components/main/shared/TransactionRequestEditModal";
import {
  useAcceptTransactionRequest,
  useFetchTransactionRequests,
  useRejectTransactionRequest,
} from "@/hooks/useTransactionRequests";
import { usePatch } from "@/hooks/useApi";
import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { TTransactionRequest } from "@/types/TransactionRequest.types";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { formatAmount as fmt } from "@/utils/formatAmount";

const SOURCE_META: Record<
  TTransactionRequest["sourceType"],
  { icon: keyof typeof Ionicons.glyphMap }
> = {
  fuel: { icon: "car-outline" },
  maintenance: { icon: "build-outline" },
  accessory: { icon: "pricetag-outline" },
};

export default function TransactionRequestsPage() {
  const C = useTheme();
  const dark = C?.statusBarStyle === "light";
  const router = useRouter();
  const [editRequest, setEditRequest] = useState<TTransactionRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TTransactionRequest | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useFetchTransactionRequests();

  const acceptMutation = useAcceptTransactionRequest();
  const rejectMutation = useRejectTransactionRequest();
  const categoryPatchMutation = usePatch([
    ["daily-transaction"],
    ["monthly-transaction"],
    ["weekly-transaction"],
    ["yearly-transaction"],
    ["budgets"],
  ]);

  const requests = data?.data ?? [];

  const acceptRequest = async (
    id: string,
    payload: { title?: string; description?: string; amount?: number } = {},
    categoryId: string | null = null,
  ) => {
    try {
      const result = await acceptMutation?.mutateAsync({
        url: `/transaction-requests/${id}/accept`,
        payload,
      });

      if (result?.success) {
        const createdTransactionId = result?.data?.transaction?._id;
        // The accept endpoint always creates an uncategorized expense — a picked
        // category is applied with a separate follow-up call. If this second
        // call fails, the transaction from the first call still exists (now
        // uncategorized), so the toast calls that out specifically rather than
        // reporting the whole accept as failed.
        if (categoryId && createdTransactionId) {
          try {
            await categoryPatchMutation?.mutateAsync({
              url: `/transactions/update-transaction/${createdTransactionId}`,
              payload: { categoryId },
            });
          } catch (categoryError) {
            console.log("category apply error = ", categoryError);
            Toast.show({
              type: "error",
              text1: "Accepted, but category wasn't applied",
              text2: "The entry was saved as Uncategorized — edit it from Today to fix.",
              position: "top",
            });
            return;
          }
        }

        Toast.show({ type: "success", text1: result?.message || "Request accepted", position: "top" });
      }
    } catch (error) {
      console.log("error = ", error);
      Toast.show({ type: "error", text1: "Something went wrong!!", position: "top" });
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;

    try {
      const result = await rejectMutation?.mutateAsync({
        url: `/transaction-requests/${rejectTarget._id}/reject`,
        payload: {},
      });

      if (result?.success) {
        Toast.show({ type: "success", text1: result?.message || "Request rejected", position: "top" });
      }
      // A failed call already surfaced its own toast from the axios response
      // interceptor (which resolves instead of rejecting — known-issues.md#FETCH-1),
      // so there is nothing to add here beyond leaving the row in place.
    } catch (error) {
      console.log("error = ", error);
      Toast.show({ type: "error", text1: "Something went wrong!!", position: "top" });
    } finally {
      setRejectTarget(null);
    }
  };

  const handleModalAccept = async (edits: { title: string; description: string; amount: number; categoryId: string | null }) => {
    if (!editRequest) return;
    const { categoryId, ...payload } = edits;
    await acceptRequest(editRequest._id, payload, categoryId);
    setEditRequest(null);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C?.background }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C?.accent} />}
      >
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router?.back()} hitSlop={8} style={{ marginLeft: -10 }}>
            <Ionicons name="chevron-back" size={22} color={C?.text} />
          </TouchableOpacity>
          <Text style={[text.h2, { color: C?.text, flex: 1 }]}>Requests</Text>
          {requests.length > 0 ? <Text style={[text.bodySm, { color: C?.textSecondary }]}>{requests.length} waiting</Text> : null}
        </View>

        {isError ? (
          <ErrorState title="Couldn't load requests" message={(error as any)?.message ?? "Network Error"} onRetry={refetch} />
        ) : isLoading ? (
          <TransactionCardSkeleton />
        ) : requests.length === 0 ? (
          <EmptyState
            title="Nothing pending"
            subtitle="Expenses your other apps send (like fuel logged in bikelog) wait here until you accept or reject them."
            icon="file-tray-outline"
          />
        ) : (
          requests.map((request) => {
            const meta = SOURCE_META[request.sourceType];
            return (
              <View key={request._id} style={[styles.card, { backgroundColor: C?.surface, borderColor: C?.border }, elevation(C, dark).card]}>
                <View style={styles.cardTop}>
                  <View style={[styles.icon, { backgroundColor: C?.accentDim }]}>
                    <Ionicons name={meta.icon} size={14} color={C?.accentText} />
                  </View>
                  <Text style={[text.caption, { color: C?.textSecondary, flex: 1 }]} numberOfLines={1}>
                    bikelog · {request.sourceType}
                  </Text>
                  <Text style={[text.caption, { color: C?.textMuted }]}>{format(new Date(request.occurredAt), "EEE d MMM, HH:mm")}</Text>
                </View>

                <View style={styles.titleRow}>
                  <Text style={[text.bodyMd, { color: C?.text, flex: 1 }]} numberOfLines={1}>
                    {request.title}
                  </Text>
                  <Text style={[text.bodyMd, { color: C?.expense }]}>−৳{fmt(request.amount)}</Text>
                </View>
                {request.description ? (
                  <Text style={[text.bodySm, { color: C?.textSecondary }]} numberOfLines={2}>
                    {request.description}
                  </Text>
                ) : null}

                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={() => setRejectTarget(request)} style={styles.rejectBtn}>
                    <Ionicons name="close" size={16} color={C?.textSecondary} />
                    <Text style={[text.bodySm, { color: C?.textSecondary }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditRequest(request)} style={[styles.reviewBtn, { borderColor: C?.accent }]}>
                    <Text style={[text.bodySm, { color: C?.accent }]}>Review</Text>
                    <Ionicons name="arrow-forward" size={15} color={C?.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!rejectTarget}
        title="Reject this request?"
        message={
          rejectTarget
            ? `"${rejectTarget.title}" will be removed from your inbox and won't be added as a transaction.`
            : undefined
        }
        confirmLabel="Reject"
        loading={rejectMutation?.isPending}
        onConfirm={confirmReject}
        onCancel={() => setRejectTarget(null)}
      />

      {editRequest && (
        <TransactionRequestEditModal
          open={!!editRequest}
          setOpen={(val) => !val && setEditRequest(null)}
          initialValue={editRequest}
          onAccept={handleModalAccept}
          loading={acceptMutation?.isPending}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: spacing.xs, paddingBottom: 40 },
  nav: { flexDirection: "row", alignItems: "center", height: 44, marginBottom: spacing.base },
  card: { borderRadius: radius.card, borderWidth: 1, padding: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { width: 24, height: 24, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  rejectBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 36, paddingHorizontal: spacing.sm },
  reviewBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
});
