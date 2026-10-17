import { text, useTheme } from "@/theme";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

export function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

type TProps = {
  name?: string | null;
  uri?: string | null;
  /** Diameter: 36 Home, 48 Settings card, 88 edit sheet. */
  size: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The user's profile photo, or their initials when there is none. Falls back to initials if
 * the image fails to load - offline, the URL is in the persisted user but the bitmap may not
 * be cached, and a blank circle is worse than initials.
 */
export default function UserAvatar({ name, uri, size, style }: TProps) {
  const C = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const showPhoto = !!uri && !failed;
  const token = size >= 80 ? text.h2 : text.bodyMd;

  return (
    <View
      accessibilityLabel={name ?? undefined}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: C?.accentDim },
        style,
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[token, { color: C?.accentText }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
