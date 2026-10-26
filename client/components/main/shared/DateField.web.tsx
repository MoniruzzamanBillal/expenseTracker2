import { radius, spacing, text, useTheme } from "@/theme";
import { format } from "date-fns";
import { Text, View } from "react-native";

type TProps = {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  inSheet?: boolean;
};

/**
 * Web implementation of DateField. The native @react-native-community/datetimepicker
 * has weak web support, and the web target is used mainly for headless verification
 * (CLAUDE.md), so this renders a plain HTML <input type="date"> with `max` set to today
 * to block future dates — the same guarantee `maximumDate` gives on native. Metro loads
 * this file on web and DateField.tsx on native, so the native module never enters the web
 * bundle.
 */
export default function DateField({ value, onChange, label, inSheet }: TProps) {
  const C = useTheme();
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <View style={label ? { marginBottom: spacing.lg } : undefined}>
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

      <input
        type="date"
        value={format(value, "yyyy-MM-dd")}
        max={today}
        onChange={(e) => {
          const [y, m, d] = e.target.value.split("-").map(Number);
          if (y && m && d) onChange(new Date(y, m - 1, d));
        }}
        style={{
          height: spacing.field,
          borderRadius: radius.card,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: C?.border,
          backgroundColor: inSheet ? C?.inputBgSheet : C?.inputBg,
          color: C?.text,
          paddingLeft: spacing.base,
          paddingRight: spacing.base,
          fontSize: 15,
          width: "100%",
          boxSizing: "border-box",
          outline: "none",
        }}
      />
    </View>
  );
}
