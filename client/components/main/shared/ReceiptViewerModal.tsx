import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { Modal, Portal } from "react-native-paper";

type TProps = {
  visible: boolean;
  imageUrl: string;
  onDismiss: () => void;
};

export default function ReceiptViewerModal({
  visible,
  imageUrl,
  onDismiss,
}: TProps) {
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        {/*
          The Pressable must wrap the image, not be wrapped by it — an outer
          Pressable with a plain View (pointerEvents="box-none") inside is the
          only way "tap anywhere, including the image, dismisses" actually
          works; a Pressable placed around just the image swallows the tap
          and only the X button ends up working. Bike Log's spec 21 had to
          debug this once already — inherited straight from that fix.
        */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
          <View style={styles.imageWrap} pointerEvents="box-none">
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              contentFit="contain"
            />
          </View>
        </Pressable>

        <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
          <MaterialCommunityIcons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    margin: 0,
    flex: 1,
    backgroundColor: "black",
  },
  imageWrap: {
    flex: 1,
  },
  image: {
    flex: 1,
  },
  closeBtn: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
