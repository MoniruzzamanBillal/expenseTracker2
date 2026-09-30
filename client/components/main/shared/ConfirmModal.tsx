import PrimaryButton from "@/components/main/shared/PrimaryButton";
import { elevation, radius, spacing, text, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Modal, Portal } from "react-native-paper";

type TProps = {
  visible: boolean;
  title: string;
  message?: string;
  /** Label of the confirming action — also the destructive one. */
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Centered confirm dialog for destructive actions. Unlike Alert.alert (a hard
 * no-op on the web target, known-issues.md#UX-3) this renders on every
 * platform, so the confirmation step can't be silently skipped.
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading,
  onConfirm,
  onCancel,
  icon = "alert-circle-outline",
}: TProps) {
  const C = useTheme();
  const dark = C?.statusBarStyle === "light";

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={loading ? () => {} : onCancel}
        style={styles.overlay}
        contentContainerStyle={[
          styles.dialog,
          { backgroundColor: C?.surface, borderColor: C?.border },
          elevation(C, dark).card,
        ]}
      >
        <View style={[styles.icon, { backgroundColor: C?.expenseBg }]}>
          <Ionicons name={icon} size={22} color={C?.expense} />
        </View>

        <Text style={[text.h3, { color: C?.text, textAlign: "center" }]}>
          {title}
        </Text>
        {message ? (
          <Text
            style={[
              text.bodySm,
              { color: C?.textSecondary, textAlign: "center" },
            ]}
          >
            {message}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            label={cancelLabel}
            onPress={onCancel}
            variant="outline"
            disabled={loading}
            style={styles.action}
          />
          <PrimaryButton
            label={confirmLabel}
            onPress={onConfirm}
            variant="destructive"
            loading={loading}
            style={styles.action}
          />
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: { justifyContent: "center", paddingHorizontal: spacing.xl },
  dialog: {
    borderRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    maxWidth: 380,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.base,
    alignSelf: "stretch",
  },
  action: { flex: 1 },
});
