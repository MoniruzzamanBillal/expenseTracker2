import { FlexWidget, TextWidget } from "react-native-android-widget";

// Hardcoded palette (not theme/colors.ts) — this renders outside the React
// tree via a headless task, with no access to ThemeProvider context. Values
// mirror theme/colors.ts's light/dark income/expense/surface/text tokens.
const palette = {
  light: {
    surface: "#ffffff",
    text: "#1a1b2e",
    textMuted: "#6b6d88",
    income: "#1fa861",
    incomeBg: "#e3f5ec",
    expense: "#d94444",
    expenseBg: "#fbe7e7",
  },
  dark: {
    surface: "#161824",
    text: "#e8e9f4",
    textMuted: "#676985",
    income: "#52d48a",
    incomeBg: "#1c3529",
    expense: "#f07272",
    expenseBg: "#3a2323",
  },
} as const;

export function QuickAddWidget({
  colorScheme,
}: {
  colorScheme: "light" | "dark";
}) {
  const C = palette[colorScheme];

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <TextWidget
        text="Quick Add"
        style={{
          fontSize: 12,
          fontWeight: "600",
          color: C.textMuted,
          marginBottom: 8,
        }}
      />

      <FlexWidget
        style={{
          flexDirection: "row",
          width: "match_parent",
          flexGap: 8,
        }}
      >
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: "client://quick-add?type=expense" }}
          style={{
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: C.expenseBg,
            borderRadius: 12,
            paddingVertical: 12,
          }}
        >
          <TextWidget
            text="+ Expense"
            style={{ fontSize: 13, fontWeight: "700", color: C.expense }}
          />
        </FlexWidget>

        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: "client://quick-add?type=income" }}
          style={{
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: C.incomeBg,
            borderRadius: 12,
            paddingVertical: 12,
          }}
        >
          <TextWidget
            text="+ Income"
            style={{ fontSize: 13, fontWeight: "700", color: C.income }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
