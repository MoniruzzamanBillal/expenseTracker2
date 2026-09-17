import CategoryManager from "@/components/main/Settings/CategoryManager";
import FormField from "@/components/main/shared/FormField";
import { useUserContext } from "@/context/user.context";
import { useFetchData, usePatch } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { IUser } from "@/types/global.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function SettingsPage() {
  const C = useTheme();
  const router = useRouter();
  const { user, handleSetUser, logoutFunction } = useUserContext();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  const { data: profile } = useFetchData<IUser>(["profile"], "/auth/me");
  const updateProfileMutation = usePatch([["profile"]]);

  const startEdit = () => {
    setName(profile?.data?.name ?? user?.name ?? "");
    setEditingName(true);
  };

  const cancelEdit = () => setEditingName(false);

  const saveName = async () => {
    if (!name.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Field",
        text2: "Please enter your name",
        position: "bottom",
      });
      return;
    }

    try {
      const result = await updateProfileMutation.mutateAsync({
        url: "/auth/update-profile",
        payload: { name: name.trim() },
      });

      if (result?.success) {
        await handleSetUser({ ...(user as IUser), name: name.trim() });
        Toast.show({
          type: "success",
          text1: result?.message,
          position: "top",
        });
        setEditingName(false);
      }
    } catch (error) {
      console.log("error = ", error);
    }
  };

  const handleLogoutPress = () => {
    // react-native-web's Alert.alert is a hard no-op — use window.confirm there
    // instead, same fix spec 08 already applied to Home's logout button.
    if (Platform.OS === "web") {
      if (window.confirm("Log out?")) {
        logoutFunction();
      }
      return;
    }

    Alert.alert("Log out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logoutFunction },
    ]);
  };

  const displayName = profile?.data?.name ?? user?.name ?? "";
  const displayEmail = profile?.data?.email ?? user?.email ?? "";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.screenPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[text.navTitle, { color: C.text, marginBottom: spacing.xl }]}
        >
          Settings
        </Text>

        <Text
          style={[text.label, { color: C.textSecondary, marginBottom: spacing.sm }]}
        >
          PROFILE
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: C.surface, borderColor: C.border },
          ]}
        >
          {editingName ? (
            <View>
              <FormField
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={cancelEdit}
                  style={[styles.smallBtn, { borderColor: C.border }]}
                >
                  <Text style={[text.bodyMd, { color: C.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveName}
                  style={[
                    styles.smallBtn,
                    { borderColor: C.accentBorder, backgroundColor: C.accentDim },
                  ]}
                >
                  <Text style={[text.bodyMd, { color: C.accent }]}>
                    {updateProfileMutation.isPending ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.profileRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                  <Text
                    style={[text.bodyMd, { color: C.text }]}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  <TouchableOpacity onPress={startEdit} style={styles.editIcon}>
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={14}
                      color={C.accent}
                    />
                  </TouchableOpacity>
                </View>
                <Text
                  style={[text.caption, { color: C.textSecondary, marginTop: 2 }]}
                  numberOfLines={1}
                >
                  {displayEmail}
                </Text>
              </View>
            </View>
          )}
        </View>

        <Text
          style={[
            text.label,
            { color: C.textSecondary, marginTop: spacing.xl, marginBottom: spacing.sm },
          ]}
        >
          CATEGORIES
        </Text>
        <CategoryManager />

        <TouchableOpacity
          onPress={() => router.push("/budgets")}
          activeOpacity={0.8}
          style={[
            styles.navRow,
            { backgroundColor: C.surface, borderColor: C.border, marginTop: spacing.xl },
          ]}
        >
          <MaterialCommunityIcons
            name="chart-donut"
            size={18}
            color={C.textSecondary}
          />
          <Text style={[text.bodyMd, { color: C.text, flex: 1 }]}>Budgets</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={C.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogoutPress}
          activeOpacity={0.8}
          style={[
            styles.navRow,
            { backgroundColor: C.surface, borderColor: C.border, marginTop: spacing.md },
          ]}
        >
          <MaterialCommunityIcons name="logout" size={18} color={C.expense} />
          <Text style={[text.bodyMd, { color: C.expense, flex: 1 }]}>
            Log Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  editIcon: { padding: 2 },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  smallBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
});
