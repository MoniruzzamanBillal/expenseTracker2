import { TransactionTypeConst } from "@/constants/TransactionType.constant";
import { usePatch } from "@/hooks/useApi";
import { useRemovePendingTransaction } from "@/hooks/usePendingTransactions";
import { radius, spacing, text, useTheme } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useRef, useState } from "react";
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import PendingTransactionEditModal from "./PendingTransactionEditModal";
import ReceiptViewerModal from "./ReceiptViewerModal";
import UpdateTransactionModal from "./UpdateTransactionModal";

const INVALIDATE_KEYS = [
  ["daily-transaction"],
  ["monthly-transaction"],
  ["weekly-transaction"],
  ["yearly-transaction"],
  ["budgets"],
];

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

type TProps = {
  transactionData: TTransaction;
  /** "only one swipeable open at a time" callback, driven by HomePage/TransactionAccordion. */
  onSwipeOpen?: (ref: Swipeable) => void;
  /** Not-yet-synced, offline-queued item — dashed/dimmed card, icon buttons instead of swipe. */
  pending?: boolean;
  /** Omit the bottom divider — pass true for the last row in a list/section. */
  isLast?: boolean;
};

export default function TransactionCard({ transactionData, onSwipeOpen, pending = false, isLast = false }: TProps) {
  const C = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const isIncome = transactionData?.type === TransactionTypeConst.income;

  // Hooks run unconditionally above the pending/normal branch below (rules-of-hooks) —
  // both branches need usePatch/useRemovePendingTransaction wired regardless of which renders.
  const patchMutation = usePatch(INVALIDATE_KEYS);
  const removePendingTransaction = useRemovePendingTransaction();

  const time = transactionData?.createdAt
    ? new Date(transactionData?.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : "";
  const categoryIcon = transactionData?.category?.icon ?? null;
  const categoryName = transactionData?.category?.name ?? null;
  const meta = categoryName ? `${categoryName} · ${time}` : `Uncategorized · ${time}`;

  // Pending (not-yet-synced, offline-queued) items have no server _id and are
  // edited/deleted purely locally (transactionQueue) — render a plain, dimmed
  // TxRow with a "Waiting to sync" second line and tap-driven edit/delete
  // instead of the normal Swipeable/modal-editable card below.
  if (pending) {
    const handleDeletePending = () => {
      Alert.alert("Delete transaction?", "This item will be deleted from the list", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => await removePendingTransaction(transactionData?._id as string),
        },
      ]);
    };

    return (
      <>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setModalOpen(true)}
          style={[styles.row, { borderBottomColor: C?.divider, borderBottomWidth: isLast ? 0 : 1, opacity: 0.85 }]}
        >
          <View style={[styles.uncatIcon, { borderColor: C?.border }]}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={C?.textMuted} />
          </View>
          <View style={styles.info}>
            <Text style={[text.bodyMd, { color: C?.text }]} numberOfLines={1}>
              {transactionData?.title}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="cloud-upload-outline" size={13} color={C?.warning} />
              <Text style={[text.caption, { color: C?.warning }]}>Waiting to sync</Text>
              <Text style={[text.caption, { color: C?.textSecondary }]}>·</Text>
              <Text style={[text.caption, { color: C?.textSecondary }]} numberOfLines={1}>
                {format(new Date(transactionData?.createdAt as string), "d MMM")}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleDeletePending} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={16} color={C?.textMuted} />
          </TouchableOpacity>
          <Text style={[text.amount, { color: isIncome ? C?.income : C?.expense }]}>
            {isIncome ? "+" : "−"}
            <Text style={{ opacity: 0.75 }}>৳</Text>
            {fmt(transactionData?.amount)}
          </Text>
        </TouchableOpacity>

        {modalOpen && <PendingTransactionEditModal open={modalOpen} setOpen={setModalOpen} initialValue={transactionData} />}
      </>
    );
  }

  const handleDeleteTransaction = async () => {
    try {
      const result = await patchMutation?.mutateAsync({
        url: `/transactions/delete-transaction/${transactionData?._id}`,
        payload: transactionData,
      });

      if (result?.success) {
        Toast.show({ type: "success", text1: result?.message, position: "top" });
      }
    } catch (error) {
      console.log("error = ", error);
      Toast.show({ type: "error", text1: "Something went wrong!!", position: "top" });
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete transaction?", transactionData?.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: handleDeleteTransaction },
    ]);
  };

  const renderLeftActions = (_progress: any, dragX: any) => {
    const scale = dragX?.interpolate({ inputRange: [0, 100], outputRange: [0, 1], extrapolate: "clamp" });
    return (
      <Animated.View style={[styles.leftAction, { backgroundColor: C?.expenseBg, transform: [{ scale }] }]}>
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => {
            swipeableRef.current?.close();
            confirmDelete();
          }}
        >
          <Ionicons name="trash-outline" size={18} color={C?.expense} />
          <Text style={[text.caption, { color: C?.expense, marginTop: 2 }]}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderRightActions = (_progress: any, dragX: any) => {
    const scale = dragX?.interpolate({ inputRange: [-100, 0], outputRange: [1, 0], extrapolate: "clamp" });
    return (
      <Animated.View style={[styles.rightAction, { backgroundColor: C?.accentDim, transform: [{ scale }] }]}>
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => {
            swipeableRef.current?.close();
            setModalOpen(true);
          }}
        >
          <Ionicons name="create-outline" size={18} color={C?.accentText} />
          <Text style={[text.caption, { color: C?.accentText, marginTop: 2 }]}>Edit</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderRightActions}
        renderRightActions={renderLeftActions}
        overshootLeft={false}
        overshootRight={false}
        onSwipeableOpen={() => {
          if (swipeableRef.current) onSwipeOpen?.(swipeableRef.current);
        }}
      >
        <View style={[styles.row, { borderBottomColor: C?.divider, borderBottomWidth: isLast ? 0 : 1, backgroundColor: C?.background }]}>
          {categoryIcon ? (
            <View style={[styles.catIcon, { backgroundColor: C?.accentDim }]}>
              <MaterialCommunityIcons name={categoryIcon as any} size={19} color={C?.accentText} />
            </View>
          ) : (
            <View style={[styles.uncatIcon, { borderColor: C?.border }]}>
              <MaterialCommunityIcons name="shape-outline" size={18} color={C?.textMuted} />
            </View>
          )}
          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={[text.bodyMd, { color: C?.text, flexShrink: 1 }]} numberOfLines={1}>
                {transactionData?.title}
              </Text>
              {transactionData?.receiptFileUrl ? <Ionicons name="attach-outline" size={15} color={C?.textSecondary} /> : null}
            </View>
            <Text style={[text.caption, { color: C?.textSecondary }]} numberOfLines={1}>
              {meta}
            </Text>
          </View>
          {transactionData?.receiptFileUrl ? (
            <TouchableOpacity onPress={() => setReceiptViewerOpen(true)} style={styles.receiptIconBtn} hitSlop={8}>
              <Ionicons name="image-outline" size={16} color={C?.textSecondary} />
            </TouchableOpacity>
          ) : null}
          <Text style={[text.amount, { color: isIncome ? C?.income : C?.expense }]}>
            {isIncome ? "+" : "−"}
            <Text style={{ opacity: 0.75 }}>৳</Text>
            {fmt(transactionData?.amount)}
          </Text>
        </View>
      </Swipeable>

      {transactionData?.receiptFileUrl ? (
        <ReceiptViewerModal
          visible={receiptViewerOpen}
          imageUrl={transactionData.receiptFileUrl}
          onDismiss={() => setReceiptViewerOpen(false)}
          fileName={transactionData?.receiptFileOriginalName}
        />
      ) : null}

      {modalOpen && <UpdateTransactionModal open={modalOpen} setOpen={setModalOpen} initialValue={transactionData} />}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: spacing.rowMinHeight,
    paddingHorizontal: spacing.md + 2,
  },
  catIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  uncatIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0, gap: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  receiptIconBtn: { padding: 2 },
  leftAction: { width: 64, justifyContent: "center", alignItems: "center" },
  rightAction: { width: 64, justifyContent: "center", alignItems: "center" },
});
