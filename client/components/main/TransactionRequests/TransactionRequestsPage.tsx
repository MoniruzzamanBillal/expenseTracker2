import EmptyState from "@/components/main/shared/EmptyState";
import TransactionCardSkeleton from "@/components/main/shared/TransactionCardSkeleton";
import TransactionRequestEditModal from "@/components/main/shared/TransactionRequestEditModal";
import {
  useAcceptTransactionRequest,
  useFetchTransactionRequests,
  useRejectTransactionRequest,
} from "@/hooks/useTransactionRequests";
import { radius, spacing, text, useTheme } from "@/theme";
import { TTransactionRequest } from "@/types/TransactionRequest.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

const SOURCE_META: Record<
  TTransactionRequest["sourceType"],
  { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; label: string }
> = {
  fuel: { icon: "gas-station", label: "Fuel" },
  maintenance: { icon: "wrench", label: "Maintenance" },
  accessory: { icon: "shopping-outline", label: "Accessory" },
};

export default function TransactionRequestsPage() {
  const C = useTheme();
  const [editRequest, setEditRequest] = useState<TTransactionRequest | null>(
    null,
  );

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useFetchTransactionRequests();

  const acceptMutation = useAcceptTransactionRequest();
  const rejectMutation = useRejectTransactionRequest();

  const requests = data?.data ?? [];

  const acceptRequest = async (
    id: string,
    payload: { title?: string; description?: string; amount?: number } = {},
  ) => {
    try {
      const result = await acceptMutation.mutateAsync({
        url: `/transaction-requests/${id}/accept`,
        payload,
      });

      if (result?.success) {
        Toast.show({
          type: "success",
          text1: result?.message || "Request accepted",
          position: "top",
        });
      }
    } catch (error) {
      console.log("error = ", error);
      Toast.show({
        type: "error",
        text1: "Something went wrong!!",
        position: "top",
      });
    }
  };

  const rejectRequest = async (id: string) => {
    try {
      const result = await rejectMutation.mutateAsync({
        url: `/transaction-requests/${id}/reject`,
        payload: {},
      });

      if (result?.success) {
        Toast.show({
          type: "success",
          text1: result?.message || "Request rejected",
          position: "top",
        });
      }
    } catch (error) {
      console.log("error = ", error);
      Toast.show({
        type: "error",
        text1: "Something went wrong!!",
        position: "top",
      });
    }
  };

  const handleAccept = (request: TTransactionRequest) => {
    Alert.alert("Accept this request?", `${request.title} · ৳${fmt(request.amount)}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Accept", onPress: () => acceptRequest(request._id) },
    ]);
  };

  const handleReject = (request: TTransactionRequest) => {
    Alert.alert("Reject this request?", request.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () => rejectRequest(request._id),
      },
    ]);
  };

  const handleModalAccept = async (edits: {
    title: string;
    description: string;
    amount: number;
  }) => {
    if (!editRequest) return;
    await acceptRequest(editRequest._id, edits);
    setEditRequest(null);
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
        <Text style={[text.navTitle, { color: C.text, marginBottom: spacing.xl }]}>
          Requests
        </Text>

        {isLoading ? (
          <TransactionCardSkeleton />
        ) : requests.length === 0 ? (
          <EmptyState
            title="No pending requests"
            subtitle="Spend logged in bikelog will show up here for review."
          />
        ) : (
          requests.map((request) => {
            const meta = SOURCE_META[request.sourceType];
            return (
              <View
                key={request._id}
                style={[
                  styles.row,
                  { borderColor: C.border, backgroundColor: C.surface },
                ]}
              >
                <View
                  style={[styles.icon, { backgroundColor: C.expenseBg }]}
                >
                  <MaterialCommunityIcons
                    name={meta.icon}
                    size={18}
                    color={C.expense}
                  />
                </View>
                <View style={styles.info}>
                  <Text
                    style={[text.bodyMd, { color: C.text }]}
                    numberOfLines={1}
                  >
                    {request.title}
                  </Text>
                  <Text
                    style={[
                      text.caption,
                      { color: C.textSecondary, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {meta.label} ·{" "}
                    {format(new Date(request.occurredAt), "d MMM")}
                  </Text>
                </View>
                <View style={styles.right}>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => setEditRequest(request)}
                      style={[styles.actionButton, { backgroundColor: C.accentDim }]}
                    >
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={14}
                        color={C.accent}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleAccept(request)}
                      style={[styles.actionButton, { backgroundColor: C.incomeBg }]}
                    >
                      <MaterialCommunityIcons
                        name="check"
                        size={14}
                        color={C.income}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleReject(request)}
                      style={[styles.actionButton, { backgroundColor: C.expenseBg }]}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={14}
                        color={C.expense}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={[text.amountSm, { color: C.expense }]}>
                    −৳{fmt(request.amount)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {editRequest && (
        <TransactionRequestEditModal
          open={!!editRequest}
          setOpen={(val) => !val && setEditRequest(null)}
          initialValue={editRequest}
          onAccept={handleModalAccept}
          loading={acceptMutation.isPending}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingTop: spacing.lg, paddingBottom: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  right: { alignItems: "flex-end", gap: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
