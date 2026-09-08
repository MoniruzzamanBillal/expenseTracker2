import { Tabs } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontFamily, useTheme } from "@/theme";
import AuthGuard from "@/utils/AuthGuard";
import { MaterialCommunityIcons } from "@expo/vector-icons";

function TabIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
}) {
  return <MaterialCommunityIcons name={name} size={22} color={color} />;
}

function AddTabIcon({ focused }: { focused: boolean }) {
  const C = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 44,
          height: 44,
          borderRadius: 14,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.accentDim,
          borderColor: focused ? C.accent : C.accentBorder,
        }}
      >
        <MaterialCommunityIcons name="plus" size={22} color={C.accent} />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const C = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    backgroundColor: C.tabBarBg,
    borderTopColor: C.border,
    borderTopWidth: 1,
    height: (Platform.OS === "ios" ? 56 : 54) + insets.bottom,
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
            letterSpacing: 0.3,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          }}
        />

        <Tabs.Screen
          name="addTransaction"
          options={{
            title: "",
            tabBarIcon: ({ focused }) => <AddTabIcon focused={focused} />,
          }}
        />

        <Tabs.Screen
          name="monthlyTransactions"
          options={{
            title: "Monthly",
            tabBarIcon: ({ color }) => (
              <TabIcon name="calendar" color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color }) => (
              <TabIcon name="chart-line" color={color} />
            ),
          }}
        />

        {/* Reached only via the "Smart Add" button on Add Transaction — not shown in the tab bar. */}
        <Tabs.Screen name="smart-add" options={{ href: null }} />
      </Tabs>
    </AuthGuard>
  );
}
