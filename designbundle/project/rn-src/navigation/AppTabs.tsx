// expo-router tab layout — copy this into app/(app)/_layout.tsx
// Usage: this IS your _layout.tsx file; adjust paths as needed.

import React from 'react';
import { useColorScheme, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '../theme/colors';

// Minimal inline SVG-based tab icons (Expo/RN friendly via Ionicons/Feather)
// Install: npx expo install @expo/vector-icons
// Then replace these Text icons with <Ionicons> or <Feather> components.

export default function AppTabsLayout() {
  const scheme = useColorScheme();
  const C = scheme === 'light' ? colors.light : colors.dark;

  const tabBar = {
    backgroundColor: C.tabBarBg,
    borderTopColor:  C.border,
    borderTopWidth:  1,
    height:          Platform.OS === 'ios' ? 84 : 64,
    paddingBottom:   Platform.OS === 'ios' ? 28 : 10,
    paddingTop:      10,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown:          false,
        tabBarStyle:          tabBar,
        tabBarActiveTintColor:   C.accent,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: {
          fontSize:    10,
          fontFamily:  'Inter_500Medium',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home' /* tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} /> */ }}
      />
      <Tabs.Screen
        name="history/index"
        options={{ title: 'History' /* tabBarIcon: ... */ }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarStyle: { ...tabBar, display: 'none' }, // hide bar on Add screen
          // tabBarIcon: ({ color }) => <AddTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="smart-add"
        options={{ title: 'Smart' }}
      />
      <Tabs.Screen
        name="weekly"
        options={{ title: 'Week' }}
      />
    </Tabs>
  );
}
