import CategoryManager from "@/components/main/Settings/CategoryManager";
import FormField from "@/components/main/shared/FormField";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import Sheet from "@/components/main/shared/Sheet";
import { useUserContext } from "@/context/user.context";
import { useFetchData, usePatch } from "@/hooks/useApi";
import { radius, spacing, text, useTheme, useThemePreference, TThemePreference } from "@/theme";
import { IUser } from "@/types/global.types";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const APPEARANCE_OPTIONS: { key: TThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "dark", label: "Dark", icon: "moon-outline" },
  { key: "light", label: "Light", icon: "sunny-outline" },
  { key: "system", label: "System", icon: "phone-portrait-outline" },
];

export default function SettingsPage() {
  const C = useTheme();
  const router = useRouter();
  const { user, handleSetUser, logoutFunction } = useUserContext();
  const { preference, setPreference } = useThemePreference();

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: profile } = useFetchData<IUser>(["profile"], "/auth/me");
  const updateProfileMutation = usePatch([["profile"]]);

  useEffect(() => {
    if (editOpen) setName(profile?.data?.name ?? user?.name ?? "");
  }, [editOpen, profile, user]);

  const saveName = async () => {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Missing Field", text2: "Please enter your name", position: "bottom" });
      return;
    }

    try {
      const result = await updateProfileMutation.mutateAsync({
        url: "/auth/update-profile",
        payload: { name: name.trim() },
      });

      if (result?.success) {
        await handleSetUser({ ...(user as IUser), name: name.trim() });
        Toast.show({ type: "success", text1: result?.message, position: "top" });
        setEditOpen(false);
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
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ marginLeft: -10 }}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[text.h2, { color: C.text }]}>Settings</Text>
        </View>

        <TouchableOpacity onPress={() => setEditOpen(true)} activeOpacity={0.8} style={[styles.profileCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={[styles.avatar, { backgroundColor: C.accentDim }]}>
            <Text style={[text.bodyMd, { color: C.accentText }]}>{initials(displayName)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[text.bodyMd, { color: C.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[text.bodySm, { color: C.textSecondary }]} numberOfLines={1}>
              {displayEmail}
            </Text>
          </View>
          <View style={[styles.editBtn, { borderColor: C.accentBorder }]}>
            <Text style={[text.bodySm, { color: C.accent }]}>Edit</Text>
          </View>
        </TouchableOpacity>

        <Text style={[text.kicker, { color: C.textSecondary, marginTop: spacing.xl, marginBottom: spacing.sm }]}>Appearance</Text>
        <View style={[styles.appearanceTrack, { backgroundColor: C.surface2, borderColor: C.border }]}>
          {APPEARANCE_OPTIONS.map((opt) => {
            const active = preference === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setPreference(opt.key)}
                style={[styles.appearanceOpt, active && { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 }]}
              >
                <Ionicons name={opt.icon} size={15} color={active ? C.text : C.textSecondary} />
                <Text style={[text.bodySm, { color: active ? C.text : C.textSecondary }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <CategoryManager />
        </View>

        <TouchableOpacity onPress={handleLogoutPress} activeOpacity={0.8} style={[styles.logoutBtn, { borderColor: `${C.expense}80` }]}>
          <Ionicons name="log-out-outline" size={18} color={C.expense} />
          <Text style={[text.bodyMd, { color: C.expense }]}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Sheet visible={editOpen} onDismiss={() => setEditOpen(false)}>
        <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }} bottomOffset={20} extraKeyboardSpace={10} showsVerticalScrollIndicator={false}>
          <View style={styles.editHeadRow}>
            <View style={[styles.avatarLg, { backgroundColor: C.accentDim }]}>
              <Text style={[text.h3, { color: C.accentText }]}>{initials(displayName)}</Text>
            </View>
            <Text style={[text.h3, { color: C.text }]}>Edit profile</Text>
          </View>

          <FormField label="Name" value={name} onChangeText={setName} placeholder="Your name" inSheet />
          <FormField label="Email" value={displayEmail} editable={false} inSheet />
          <Text style={[text.caption, { color: C.textMuted, marginTop: -spacing.md, marginBottom: spacing.lg }]}>
            Email and photo can&apos;t be changed from the app yet.
          </Text>

          <PrimaryButton label={updateProfileMutation.isPending ? "Saving…" : "Save"} onPress={saveName} loading={updateProfileMutation.isPending} height={spacing.cta} />
        </KeyboardAwareScrollView>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  nav: { flexDirection: "row", alignItems: "center", gap: spacing.xs, height: 44, marginBottom: spacing.base },
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.card, padding: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarLg: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  editBtn: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  appearanceTrack: { flexDirection: "row", height: 40, padding: 3, borderRadius: radius.card, borderWidth: 1 },
  appearanceOpt: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.sm + 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: spacing.field, borderWidth: 1, borderRadius: radius.card, marginTop: spacing.xl },
  editHeadRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
});
