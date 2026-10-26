import { radius, spacing, text, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type TProps = {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  /** Use inputBgSheet instead of inputBg — for fields rendered inside a bottom sheet. */
  inSheet?: boolean;
};

/**
 * A tappable date field backed by the native OS date picker
 * (@react-native-community/datetimepicker). Future dates are non-selectable via
 * `maximumDate` (client spec 48). Web has its own implementation in DateField.web.tsx.
 */
export default function DateField({ value, onChange, label, inSheet }: TProps) {
  const C = useTheme();
  // iOS shows the picker inline when open; Android uses the imperative dialog API.
  const [iosOpen, setIosOpen] = useState(false);

  const openPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        maximumDate: new Date(),
        onChange: (event, selected) => {
          if (event.type === "set" && selected) onChange(selected);
        },
      });
    } else {
      setIosOpen((v) => !v);
    }
  };

  return (
    <View style={label ? styles.wrap : undefined}>
      {label ? (
        <Text
          style={[
            text.captionMd,
            { color: C?.textSecondary, marginBottom: spacing.xs + 1 },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.7}
        style={[
          styles.field,
          {
            backgroundColor: inSheet ? C?.inputBgSheet : C?.inputBg,
            borderColor: C?.border,
          },
        ]}
      >
        <Ionicons name="calendar-outline" size={18} color={C?.textMuted} />
        <Text style={[text.body, { color: C?.text, flex: 1 }]}>
          {format(value, "EEE, d MMM yyyy")}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C?.textMuted} />
      </TouchableOpacity>

      {Platform.OS === "ios" && iosOpen ? (
        <View>
          <DateTimePicker
            value={value}
            mode="date"
            display="inline"
            maximumDate={new Date()}
            onChange={(event, selected) => {
              if (event.type === "set" && selected) onChange(selected);
            }}
          />
          <TouchableOpacity
            onPress={() => setIosOpen(false)}
            style={styles.iosDone}
          >
            <Text style={[text.bodyMd, { color: C?.accent }]}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.base,
  },
  iosDone: { alignSelf: "flex-end", paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
});
