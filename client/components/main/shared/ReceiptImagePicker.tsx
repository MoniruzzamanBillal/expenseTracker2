import { useDeleteData, usePut } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import ReceiptViewerModal from "./ReceiptViewerModal";

type TProps = {
  transactionId: string;
  value?: string | null; // receiptFileUrl
  invalidateKeys: string[][];
};

export default function ReceiptImagePicker({
  transactionId,
  value,
  invalidateKeys,
}: TProps) {
  const C = useTheme();
  const [viewerOpen, setViewerOpen] = useState(false);
  const putMutation = usePut(invalidateKeys);
  const deleteMutation = useDeleteData(invalidateKeys);

  const upload = async (file: { uri: string; name: string; type: string }) => {
    try {
      const formData = new FormData();
      formData.append("file", file as any);
      const result = await putMutation.mutateAsync({
        url: `/transactions/receipt-file/${transactionId}`,
        payload: formData,
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
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: "error",
        text1: "Permission denied",
        text2: "Camera access is required to take a photo",
        position: "top",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      await upload({
        uri: asset.uri,
        name: asset.fileName ?? "receipt.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: "error",
        text1: "Permission denied",
        text2: "Photo library access is required to attach a receipt",
        position: "top",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      await upload({
        uri: asset.uri,
        name: asset.fileName ?? "receipt.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
    }
  };

  const openPickerActionSheet = () => {
    Alert.alert("Receipt Photo", undefined, [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handlePress = () => {
    if (value) {
      setViewerOpen(true);
      return;
    }
    openPickerActionSheet();
  };

  const handleRemove = () => {
    Alert.alert("Remove receipt?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deleteMutation.mutateAsync({
              url: `/transactions/receipt-file/${transactionId}`,
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
          }
        },
      },
    ]);
  };

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text
        style={[text.label, { color: C.textSecondary, marginBottom: spacing.xs }]}
      >
        RECEIPT
      </Text>

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          styles.tile,
          value
            ? { borderColor: C.border, borderStyle: "solid" }
            : { borderColor: C.border, borderStyle: "dashed" },
        ]}
      >
        {value ? (
          <Image source={{ uri: value }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <MaterialCommunityIcons
              name="camera-plus-outline"
              size={22}
              color={C.textMuted}
            />
            <Text style={[text.caption, { color: C.textMuted }]}>
              Add Receipt
            </Text>
          </View>
        )}

        {putMutation.isPending && (
          <View style={styles.spinnerOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}

        {value && !putMutation.isPending ? (
          <>
            <TouchableOpacity
              onPress={openPickerActionSheet}
              style={[styles.badge, styles.editBadge, { backgroundColor: C.accentDim }]}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={12}
                color={C.accent}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRemove}
              style={[styles.badge, styles.removeBadge, { backgroundColor: C.expenseBg }]}
            >
              <MaterialCommunityIcons name="close" size={12} color={C.expense} />
            </TouchableOpacity>
          </>
        ) : null}
      </TouchableOpacity>

      {value && (
        <ReceiptViewerModal
          visible={viewerOpen}
          imageUrl={value}
          onDismiss={() => setViewerOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", gap: 4 },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editBadge: { top: 4, right: 4 },
  removeBadge: { bottom: 4, right: 4 },
});
