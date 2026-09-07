import { TransactionTypeConst } from "@/constants/TransactionType.constant";
import { usePatch } from "@/hooks/useApi";
import { useRemovePendingTransaction } from "@/hooks/usePendingTransactions";
import { fontFamily, radius, spacing, text, useTheme } from "@/theme";
import { TTransaction } from "@/types/Transaction.tyes";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useRef, useState } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import PendingTransactionEditModal from "./PendingTransactionEditModal";
import UpdateTransactionModal from "./UpdateTransactionModal";

const INVALIDATE_KEYS = [
  ["daily-transaction"],
  ["monthly-transaction"],
  ["weekly-transaction"],
  ["yearly-transaction"],
];

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

type TProps = {
  transactionData: TTransaction;
  /** "only one swipeable open at a time" callback, driven by HomePage/TransactionAccordion. */
  onSwipeOpen?: (ref: Swipeable) => void;
  /** Not-yet-synced, offline-queued item — dashed/dimmed card, icon buttons instead of swipe. */
  pending?: boolean;
  /** Denser row (Monthly/Weekly's nested accordion rows). */
  compact?: boolean;
  /** Omit the bottom divider — pass true for the last row in a list/section. */
  isLast?: boolean;
};

export default function TransactionCard({
  transactionData,
  onSwipeOpen,
  pending = false,
  compact = false,
  isLast = false,
}: TProps) {
  const C = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const isIncome = transactionData?.type === TransactionTypeConst.income;

  // Hooks run unconditionally above the pending/normal branch below (rules-of-hooks) —
  // both branches need usePatch/useRemovePendingTransaction wired regardless of which renders.
  const patchMutation = usePatch(INVALIDATE_KEYS);
  const removePendingTransaction = useRemovePendingTransaction();

  const iconSize = compact ? 38 : 40;
  const time = transactionData?.createdAt
    ? new Date(transactionData.createdAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  // Pending (not-yet-synced, offline-queued) items have no server _id and are
  // edited/deleted purely locally (transactionQueue) — render a plain, dimmed
  // card with icon actions instead of the normal Swipeable/modal-editable card
  // below.
  if (pending) {
    const handleDeletePending = () => {
      Alert.alert(
        "Delete transaction?",
        "This item will be deleted from the list",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () =>
              await removePendingTransaction(transactionData?._id as string),
          },
        ],
      );
    };

    return (
      <>
        <View
          style={[
            styles.row,
            styles.pendingRow,
            { borderColor: C.border, backgroundColor: C.surface },
          ]}
        >
          <View
            style={[
              styles.icon,
              {
                width: iconSize,
                height: iconSize,
                backgroundColor: isIncome ? C.incomeBg : C.expenseBg,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="clock-outline"
              size={18}
              color={C.textSecondary}
            />
          </View>
          <View style={styles.info}>
            <Text
              style={[
                compact
                  ? { fontSize: 14, fontFamily: fontFamily.medium }
                  : text.bodyMd,
                { color: C.text },
              ]}
              numberOfLines={1}
            >
              {transactionData?.title}
            </Text>
            <Text
              style={[text.caption, { color: C.textSecondary, marginTop: 2 }]}
              numberOfLines={1}
            >
              Pending sync ·{" "}
              {format(new Date(transactionData?.createdAt as string), "d MMM")}
            </Text>
          </View>
          <View style={styles.pendingRight}>
            <View style={styles.pendingActions}>
              <TouchableOpacity
                onPress={() => setModalOpen(true)}
                style={[
                  styles.pendingActionButton,
                  { backgroundColor: C.accentDim },
                ]}
              >
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={14}
                  color={C.accent}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeletePending}
                style={[
                  styles.pendingActionButton,
                  { backgroundColor: C.expenseBg },
                ]}
              >
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={14}
                  color={C.expense}
                />
              </TouchableOpacity>
            </View>
            <Text
              style={[
                text.amountSm,
                { color: isIncome ? C.income : C.expense },
              ]}
            >
              {isIncome ? "+" : "−"}৳{fmt(transactionData?.amount)}
            </Text>
          </View>
        </View>

        {modalOpen && (
          <PendingTransactionEditModal
            open={modalOpen}
            setOpen={setModalOpen}
            initialValue={transactionData}
          />
        )}
      </>
    );
  }

  const handleDeleteTransaction = async () => {
    try {
      const result = await patchMutation.mutateAsync({
        url: `/transactions/delete-transaction/${transactionData?._id}`,
        payload: transactionData,
      });

      if (result?.success) {
        Toast.show({
          type: "success",
          text1: result?.message,
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

  const confirmDelete = () => {
    Alert.alert("Delete transaction?", transactionData?.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: handleDeleteTransaction,
      },
    ]);
  };

  const renderLeftActions = (_progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });
    return (
      <Animated.View
        style={[
          styles.leftAction,
          { backgroundColor: C.expense, transform: [{ scale }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => {
            swipeableRef.current?.close();
            confirmDelete();
          }}
        >
          <MaterialCommunityIcons name="delete" size={26} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderRightActions = (_progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={[
          styles.rightAction,
          { backgroundColor: C.income, transform: [{ scale }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => {
            swipeableRef.current?.close();
            setModalOpen(true);
          }}
        >
          <MaterialCommunityIcons
            name="book-edit-outline"
            size={26}
            color="#fff"
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        onSwipeableOpen={() => {
          if (swipeableRef.current) {
            onSwipeOpen?.(swipeableRef.current);
          }
        }}
      >
        <View
          style={[
            styles.row,
            {
              paddingVertical: compact ? 12 : 13,
              borderBottomColor: C.divider,
              borderBottomWidth: isLast ? 0 : 1,
              backgroundColor: C.background,
            },
          ]}
        >
          <View
            style={[
              styles.icon,
              {
                width: iconSize,
                height: iconSize,
                backgroundColor: isIncome ? C.incomeBg : C.expenseBg,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={isIncome ? "cash-multiple" : "cash-minus"}
              size={compact ? 18 : 20}
              color={isIncome ? C.income : C.expense}
            />
          </View>
          <View style={styles.info}>
            <Text
              style={[
                compact
                  ? { fontSize: 14, fontFamily: fontFamily.medium }
                  : text.bodyMd,
                { color: C.text },
              ]}
              numberOfLines={1}
            >
              {transactionData?.title}
            </Text>
            <Text
              style={[
                text.caption,
                { color: C.textSecondary, marginTop: compact ? 1 : 2 },
              ]}
              numberOfLines={1}
            >
              {compact
                ? time
                : transactionData?.description
                  ? `${transactionData.description} · ${time}`
                  : time}
            </Text>
          </View>
          <Text
            style={[
              compact ? text.amountXs : text.amountSm,
              { color: isIncome ? C.income : C.expense },
            ]}
          >
            {isIncome ? "+" : "−"}৳{fmt(transactionData?.amount)}
          </Text>
        </View>
      </Swipeable>

      {modalOpen && (
        <UpdateTransactionModal
          open={modalOpen}
          setOpen={setModalOpen}
          initialValue={transactionData}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  pendingRow: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.md,
    opacity: 0.75,
    marginBottom: 4,
  },
  icon: {
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  pendingRight: { alignItems: "flex-end", gap: 2 },
  pendingActions: { flexDirection: "row", alignItems: "center" },
  pendingActionButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  leftAction: {
    width: 70,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.sm,
  },
  rightAction: {
    width: 70,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.sm,
  },
});
