import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { QuickAddWidget } from "./widgets/QuickAddWidget";

const nameToWidget = {
  QuickAdd: QuickAddWidget,
} as const;

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const Widget =
    nameToWidget[props.widgetInfo.widgetName as keyof typeof nameToWidget];

  if (!Widget) return;

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      // Button taps are handled natively via each button's OPEN_URI
      // clickAction (see widgets/QuickAddWidget.tsx) — this handler only
      // ever needs to (re)render the widget's static UI.
      props.renderWidget({
        light: <Widget colorScheme="light" />,
        dark: <Widget colorScheme="dark" />,
      });
      break;

    default:
      break;
  }
}
