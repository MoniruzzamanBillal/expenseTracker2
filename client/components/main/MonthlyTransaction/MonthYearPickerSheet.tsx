import { radius, spacing, text, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Sheet from "../shared/Sheet";

type TProps = {
  visible: boolean;
  onDismiss: () => void;
  selectedMonth: number; // 1-12
  selectedYear: number;
  currentMonth: number; // 1-12
  currentYear: number;
  onSelect: (month: number, year: number) => void;
  // How far back the year stepper can go; defaults to 10 years.
  minYear?: number;
};

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2000, i, 1), "MMM"),
);

// Month + year picker opened by tapping the month name on TrendTab. Keeps the
// arrow stepper's within-year behaviour untouched; this is the only way to
// reach a different year. Future months of the current year are disabled
// because they can never hold data.
export default function MonthYearPickerSheet({
  visible,
  onDismiss,
  selectedMonth,
  selectedYear,
  currentMonth,
  currentYear,
  onSelect,
  minYear = currentYear - 10,
}: TProps) {
  const C = useTheme();

  // The year the grid is showing — seeded from the active year each open, then
  // driven by the stepper without committing until a month is tapped.
  const [viewYear, setViewYear] = useState(selectedYear);

  useEffect(() => {
    if (visible) setViewYear(selectedYear);
  }, [visible, selectedYear]);

  const atMaxYear = viewYear >= currentYear;
  const atMinYear = viewYear <= minYear;

  return (
    <Sheet visible={visible} onDismiss={onDismiss}>
      <Text style={[text.h3, styles.title, { color: C.text }]}>
        Select month
      </Text>

      <View style={styles.yearRow}>
        <TouchableOpacity
          onPress={() => setViewYear((y) => y - 1)}
          disabled={atMinYear}
          hitSlop={8}
          style={styles.yearChevron}
          accessibilityRole="button"
          accessibilityLabel="Previous year"
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={atMinYear ? C.textMuted : C.text}
          />
        </TouchableOpacity>

        <Text style={[text.h2, { color: C.text }]}>{viewYear}</Text>

        <TouchableOpacity
          onPress={() => setViewYear((y) => y + 1)}
          disabled={atMaxYear}
          hitSlop={8}
          style={styles.yearChevron}
          accessibilityRole="button"
          accessibilityLabel="Next year"
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={atMaxYear ? C.textMuted : C.text}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {MONTH_LABELS.map((label, i) => {
          const month = i + 1;
          const disabled = viewYear === currentYear && month > currentMonth;
          const active = month === selectedMonth && viewYear === selectedYear;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => {
                onSelect(month, viewYear);
                onDismiss();
              }}
              disabled={disabled}
              activeOpacity={0.8}
              style={[
                styles.monthCell,
                {
                  backgroundColor: active ? C.accentDim : C.surface2,
                  borderColor: active ? C.accentBorder : C.border,
                  opacity: disabled ? 0.4 : 1,
                },
              ]}
            >
              <Text
                style={[
                  text.bodyMd,
                  {
                    color: active
                      ? C.accentText
                      : disabled
                        ? C.textMuted
                        : C.text,
                  },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { textAlign: "center", marginBottom: spacing.md },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  yearChevron: { padding: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  monthCell: {
    // Three per row inside the sheet's horizontal padding.
    width: "31.5%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
