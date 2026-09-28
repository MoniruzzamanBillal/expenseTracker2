import { radius, spacing, useTheme } from "@/theme";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Modal, Portal } from "react-native-paper";

type TProps = {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  /** Cap content height so tall sheets don't run under the status bar. */
  maxHeightPct?: number;
};

/**
 * Bottom sheet chrome shared by every edit/create modal: Portal + Modal
 * anchored to the bottom (marginTop: auto), top corners radius.sheet, a
 * grabber, scrim token, padding 20 + insets.bottom.
 */
export default function Sheet({ visible, onDismiss, children, maxHeightPct = 88 }: TProps) {
  const C = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        style={styles.overlay}
        contentContainerStyle={[
          styles.sheet,
          {
            backgroundColor: C.surface,
            borderColor: C.border,
            paddingBottom: spacing.lg + insets.bottom,
            maxHeight: `${maxHeightPct}%`,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: C.border }]} />
        {children}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: { justifyContent: "flex-end" },
  sheet: {
    marginTop: "auto",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
});
