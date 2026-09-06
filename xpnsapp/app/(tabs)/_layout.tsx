import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme, fontFamily } from '@/theme';

const TAB_ICON: Record<string, string> = {
  index: '⌂',
  history: '▤',
  'smart-add': '✦',
  weeklyTransactions: '▦',
};

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

function AddTabIcon({ focused }: { focused: boolean }) {
  const C = useTheme();
  return (
    <View
      style={[
        styles.fab,
        { backgroundColor: C.accentDim, borderColor: focused ? C.accent : C.accentBorder },
      ]}
    >
      <Text style={{ fontSize: 20, color: C.accent, fontFamily: fontFamily.medium }}>+</Text>
    </View>
  );
}

export default function TabLayout() {
  const C = useTheme();

  const tabBarStyle = {
    backgroundColor: C.tabBarBg,
    borderTopColor: C.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 10,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontFamily: fontFamily.medium, letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon glyph={TAB_ICON.index} color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ color }) => <TabIcon glyph={TAB_ICON.history} color={color} /> }}
      />
      <Tabs.Screen
        name="addTransaction"
        options={{ title: '', tabBarIcon: ({ focused }) => <AddTabIcon focused={focused} /> }}
      />
      <Tabs.Screen
        name="smart-add"
        options={{ title: 'Smart', tabBarIcon: ({ color }) => <TabIcon glyph={TAB_ICON['smart-add']} color={color} /> }}
      />
      <Tabs.Screen
        name="weeklyTransactions"
        options={{ title: 'Week', tabBarIcon: ({ color }) => <TabIcon glyph={TAB_ICON.weeklyTransactions} color={color} /> }}
      />
      {/* Reached only by drilling in from History — not shown in the tab bar. */}
      <Tabs.Screen name="monthlyTransactions" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
  },
});
