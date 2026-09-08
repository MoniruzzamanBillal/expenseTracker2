import { StyleSheet, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useTheme } from "@/theme";

export default function SplashScreen() {
  const C = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
