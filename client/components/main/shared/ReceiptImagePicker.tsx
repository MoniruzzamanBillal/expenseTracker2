import { useDeleteData, usePutOutcome } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { prepareReceiptImage } from "@/utils/prepareReceiptImage";
import { Ionicons } from "@expo/vector-icons";
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
  fileName?: string | null;
  invalidateKeys: string[][];
};

export default function ReceiptImagePicker({
  transactionId,
  value,
  fileName,
  invalidateKeys,
}: TProps) {
  const C = useTheme();
  const [viewerOpen, setViewerOpen] = useState(false);
  const putMutation = usePutOutcome(invalidateKeys);
  const deleteMutation = useDeleteData(invalidateKeys);

  // No try/catch: under FETCH-1 a failed PUT resolves rather than rejects, so the old catch
  // was dead code and `result?.success` was read off an always-undefined value — a failure
  // looked identical to a success here. usePutOutcome resolves to a TWriteOutcome instead,
  // so the real reason can be surfaced (spec 35).
  const upload = async (file: { uri: string; name: string; type: string }) => {
    const formData = new FormData();
    formData.append("file", file as any);

    const outcome = await putMutation?.mutateAsync({
      url: `/transactions/receipt-file/${transactionId}`,
      payload: formData,
    });

    if (outcome?.ok) {
      Toast.show({
        type: "success",
        text1: outcome?.body?.message ?? "Receipt uploaded",
        position: "top",
      });
      return;
    }

    Toast.show({
      type: "error",
      text1: "Receipt didn't upload",
      text2: outcome?.offline
        ? "You appear to be offline. Try again when you're back online."
        : outcome?.message,
      position: "top",
    });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission?.granted) {
      Toast.show({
        type: "error",
        text1: "Permission denied",
        text2: "Camera access is required to take a photo",
        position: "top",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result?.canceled && result?.assets?.[0]) {
      const asset = result.assets[0];
      await upload(
        await prepareReceiptImage(
          {
            uri: asset.uri,
            name: asset.fileName ?? "receipt.jpg",
            type: asset.mimeType ?? "image/jpeg",
          },
          asset.width,
          asset.height,
        ),
      );
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission?.granted) {
      Toast.show({
        type: "error",
        text1: "Permission denied",
        text2: "Photo library access is required to attach a receipt",
        position: "top",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result?.canceled && result?.assets?.[0]) {
      const asset = result.assets[0];
      await upload(
        await prepareReceiptImage(
          {
            uri: asset.uri,
            name: asset.fileName ?? "receipt.jpg",
            type: asset.mimeType ?? "image/jpeg",
          },
          asset.width,
          asset.height,
        ),
      );
    }
  };

  const openPickerActionSheet = () => {
    Alert.alert("Attach receipt", "Image, up to 4 MB", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleRemove = () => {
    Alert.alert(
      "Remove receipt?",
      "The file is deleted from this entry. The entry itself stays.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await deleteMutation?.mutateAsync({
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
      ],
    );
  };

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text
        style={[
          text.captionMd,
          { color: C?.textSecondary, marginBottom: spacing.xs + 1 },
        ]}
      >
        Receipt
      </Text>

      {value ? (
        <View
          style={[
            styles.chip,
            { backgroundColor: C?.accentDim, borderColor: C?.accentBorder },
          ]}
        >
          <TouchableOpacity
            onPress={() => setViewerOpen(true)}
            activeOpacity={0.8}
            style={styles.chipTapArea}
          >
            <View style={[styles.thumb, { backgroundColor: C?.surface2 }]}>
              <Image
                source={{ uri: value }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[text.bodySm, { color: C?.accentText }]}
                numberOfLines={1}
              >
                {fileName ?? "Receipt attached"}
              </Text>
              <Text style={[text.caption, { color: C?.textSecondary }]}>
                Tap to view
              </Text>
            </View>
          </TouchableOpacity>
          {putMutation?.isPending ? (
            <ActivityIndicator color={C?.accent} size="small" />
          ) : (
            <TouchableOpacity
              onPress={handleRemove}
              style={styles.trashBtn}
              hitSlop={8}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={C?.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          onPress={openPickerActionSheet}
          activeOpacity={0.8}
          disabled={putMutation?.isPending}
          style={[styles.emptyChip, { borderColor: C?.border }]}
        >
          {putMutation?.isPending ? (
            <ActivityIndicator color={C?.textSecondary} size="small" />
          ) : (
            <>
              <Ionicons
                name="attach-outline"
                size={16}
                color={C?.textSecondary}
              />
              <Text style={[text.bodySm, { color: C?.textSecondary }]}>
                Receipt
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {value && (
        <ReceiptViewerModal
          visible={viewerOpen}
          imageUrl={value}
          onDismiss={() => setViewerOpen(false)}
          fileName={fileName}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 52,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 8,
    gap: spacing.sm,
  },
  chipTapArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: radius.sm + 2,
    overflow: "hidden",
  },
  trashBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChip: {
    alignSelf: "flex-start",
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
