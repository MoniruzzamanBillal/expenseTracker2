// Opt out of the React Compiler (app.json `reactCompiler: true`):
// react-native-android-widget calls widget components as plain functions
// outside React's renderer, so the compiler's injected memo-cache hook
// throws "Invalid hook call" and the widget never renders (stays blank).
"use no memo";

import { FlexWidget, TextWidget } from "react-native-android-widget";

// Hardcoded palette (not theme/colors.ts) — this renders outside the React
// tree via a headless task, with no access to ThemeProvider context. Values
// mirror theme/colors.ts's light/dark income/expense/surface/border tokens;
// tints are pre-mixed since widgets have no alpha blending of tokens.
const palette = {
  light: {
    surface: "#f7f8fe",
    border: "#dcdfee",
    textMuted: "#595d6c",
    income: "#3b7650",
    incomeBg: "#e6efeb",
    expense: "#b4453d",
    expenseBg: "#f6e9ea",
  },
  dark: {
    surface: "#232532",
    border: "#3f424d",
    textMuted: "#9397ab",
    income: "#7cbf8e",
    incomeBg: "#26352f",
    expense: "#e0786e",
    expenseBg: "#3a2a31",
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
        borderColor: C.border,
        borderWidth: 1,
        padding: 12,
      }}
    >
      <TextWidget
        text="QUICK ADD"
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: C.textMuted,
          letterSpacing: 1,
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
            borderColor: C.expense,
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
          }}
        >
          <TextWidget
            text="− Expense"
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
            borderColor: C.income,
            borderWidth: 1,
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
