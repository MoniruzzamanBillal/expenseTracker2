import { text } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Modal, Portal } from "react-native-paper";

type TProps = {
  visible: boolean;
  imageUrl: string;
  onDismiss: () => void;
  /** Original filename from the server — shown in the header when present (spec 24 / G4). */
  fileName?: string | null;
};

const VIEWER_BG = "#10111b";

export default function ReceiptViewerModal({ visible, imageUrl, onDismiss, fileName }: TProps) {
  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modalContent}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onDismiss} hitSlop={8}>
            <Ionicons name="close" size={24} color="#e9e9ed" />
          </TouchableOpacity>
          {fileName ? (
            <Text style={[text.bodyMd, styles.fileNameText]} numberOfLines={1}>
              {fileName}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={styles.headerBtn} />
        </View>

        {/*
          The Pressable must wrap the image, not be wrapped by it — an outer
          Pressable with a plain View (pointerEvents="box-none") inside is the
          only way "tap anywhere, including the image, dismisses" actually
          works; a Pressable placed around just the image swallows the tap
          and only the X button ends up working. Bike Log's spec 21 had to
          debug this once already — inherited straight from that fix.
        */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss}>
          <View style={styles.imageWrap} pointerEvents="box-none">
            <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" />
          </View>
        </Pressable>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    margin: 0,
    flex: 1,
    backgroundColor: VIEWER_BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 12,
    zIndex: 1,
  },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  fileNameText: { flex: 1, color: "#e9e9ed", textAlign: "center" },
  imageWrap: {
    flex: 1,
  },
  image: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 40,
  },
});
