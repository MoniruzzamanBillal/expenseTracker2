import { Tabs } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontFamily, radius, spacing, useTheme } from "@/theme";
import AuthGuard from "@/utils/AuthGuard";
import { Ionicons } from "@expo/vector-icons";

function TabIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
}) {
  return <Ionicons name={name} size={21} color={color} />;
}

function AddTabIcon() {
  const C = useTheme();
  return (
    <View
      style={{
        marginTop: 8,
        width: 52,
        height: 38,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: C.accent,
        backgroundColor: C.accentDim,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="add" size={22} color={C.accent} />
    </View>
  );
}

export default function TabLayout() {
  const C = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    backgroundColor: C.background,
    borderTopColor: C.border,
    borderTopWidth: 1,
    height: spacing.tabBar + insets.bottom,
    paddingBottom: insets.bottom + (Platform.OS === "ios" ? 8 : 10),
    paddingTop: 10,
  };

  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarActiveTintColor: C.accent,
          tabBarInactiveTintColor: C.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: fontFamily.medium,
            letterSpacing: 0.2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Today",
            tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "home" : "home-outline"} color={color} />,
          }}
        />

        <Tabs.Screen
          name="monthlyTransactions"
          options={{
            title: "Activity",
            tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "calendar-clear" : "calendar-clear-outline"} color={color} />,
          }}
        />

        <Tabs.Screen
          name="addTransaction"
          options={{
            title: "",
            tabBarIcon: () => <AddTabIcon />,
          }}
        />

        <Tabs.Screen
          name="history"
          options={{
            title: "Insights",
            tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "stats-chart" : "stats-chart-outline"} color={color} />,
          }}
        />

        <Tabs.Screen
          name="budgets"
          options={{
            title: "Budgets",
            tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "pie-chart" : "pie-chart-outline"} color={color} />,
          }}
        />

        {/* Reached only via the avatar on Today — not shown in the tab bar. */}
        <Tabs.Screen name="settings" options={{ href: null }} />

        {/* Reached only via the "Smart Add" button on Add — not shown in the tab bar. */}
        <Tabs.Screen name="smart-add" options={{ href: null }} />

        {/* Reached only via the tray icon on Today — not shown in the tab bar. */}
        <Tabs.Screen name="transaction-requests" options={{ href: null }} />
      </Tabs>
    </AuthGuard>
  );
}
