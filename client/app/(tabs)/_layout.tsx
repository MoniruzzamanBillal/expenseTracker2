import { Tabs } from "expo-router";
import React from "react";

import { useUserContext } from "@/context/user.context";
import AuthGuard from "@/utils/AuthGuard";
import { COLORS } from "@/utils/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function TabLayout() {
  const { logoutFunction } = useUserContext();

  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textLight,
          headerTitleAlign: "center",
          headerTitleStyle: {
            color: COLORS.primary,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="home" size={size} color={color} />
            ),
            headerRight: () => (
              <MaterialCommunityIcons
                name="logout"
                style={{ marginRight: 20 }}
                size={24}
                color={COLORS.primary}
                onPress={() => logoutFunction()}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="monthlyTransactions"
          options={{
            title: "Monthly Transaction",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="calendar"
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="addTransaction"
          options={{
            title: "Add Transaction",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="plus" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}
