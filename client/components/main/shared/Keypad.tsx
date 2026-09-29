import { text, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

type TProps = {
  value: string;
  onChange: (next: string) => void;
};

/**
 * In-app numeric keypad for amount entry (Add / Quick Add) — same
 * /^\d+(\.\d{0,2})?$/ shape as the rest of the app, invalid keys simply
 * don't register rather than showing a toast.
 */
export default function Keypad({ value, onChange }: TProps) {
  const C = useTheme();

  const press = (key: string) => {
    if (key === "⌫") {
      onChange(value?.slice(0, -1));
      return;
    }
    const next = value + key;
    if (next === "" || /^\d+(\.\d{0,2})?$/.test(next)) {
      onChange(next);
    }
  };

  return (
    <View style={styles.grid}>
      {KEYS.map((k) => (
        <TouchableOpacity key={k} onPress={() => press(k)} activeOpacity={0.6} style={styles.key}>
          {k === "⌫" ? <Ionicons name="backspace-outline" size={24} color={C?.textSecondary} /> : <Text style={[text.h1, { color: C?.text }]}>{k}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  key: { width: "33.33%", height: 48, alignItems: "center", justifyContent: "center" },
});
