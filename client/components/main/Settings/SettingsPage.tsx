import CategoryManager from "@/components/main/Settings/CategoryManager";
import ConfirmModal from "@/components/main/shared/ConfirmModal";
import FormField from "@/components/main/shared/FormField";
import PrimaryButton from "@/components/main/shared/PrimaryButton";
import Sheet from "@/components/main/shared/Sheet";
import UserAvatar from "@/components/main/shared/UserAvatar";
import { useUserContext } from "@/context/user.context";
import { useDeleteData, useFetchData, usePatch, usePutOutcome } from "@/hooks/useApi";
import { radius, spacing, text, useTheme, useThemePreference, TThemePreference } from "@/theme";
import { IUser } from "@/types/global.types";
import { isAdmin } from "@/utils/isAdmin";
import { prepareAvatarImage } from "@/utils/prepareAvatarImage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [name, setName] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const { data: profile } = useFetchData<IUser>(["profile"], "/auth/me");
  const updateProfileMutation = usePatch([["profile"]]);
  const uploadPhotoMutation = usePutOutcome([["profile"]]);
  const removePhotoMutation = useDeleteData([["profile"]]);
  const photoBusy = uploadPhotoMutation.isPending || removePhotoMutation.isPending;

  useEffect(() => {
    if (editOpen) setName(profile?.data?.name ?? user?.name ?? "");
  }, [editOpen, profile, user]);

  const saveName = async () => {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Missing Field", text2: "Please enter your name", position: "bottom" });
      return;
    }

    try {
      const result = await updateProfileMutation?.mutateAsync({
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

  const displayName = profile?.data?.name ?? user?.name ?? "";
  const displayEmail = profile?.data?.email ?? user?.email ?? "";
  // The context copy wins when it has an opinion (string or explicit null): right after an
  // upload/remove the ["profile"] query is stale until its refetch lands, and preferring it
  // would flash the old photo. A session stored before spec 46 has `undefined` and falls
  // through to the query.
  const photoUrl = user?.profilePicture !== undefined ? user.profilePicture : (profile?.data?.profilePicture ?? null);

  // Single place that updates the context, so Home (which reads the context, not the
  // ["profile"] query) can never lag behind Settings.
  const applyPhoto = async (profilePicture: string | null) => {
    await handleSetUser({ ...(user as IUser), profilePicture });
  };

  // No try/catch around the mutation: under FETCH-1 the axios interceptor resolves instead of
  // rejecting, so a catch is dead code. usePutOutcome resolves a TWriteOutcome (spec 35).
  const pickPhoto = async (source: "camera" | "library") => {
    setSourceOpen(false);

    const permission =
      source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission?.granted) {
      Toast.show({
        type: "error",
        text1: "Permission denied",
        text2: source === "camera" ? "Camera access is required to take a photo" : "Photo library access is required to choose a photo",
        position: "top",
      });
      return;
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: false, quality: 0.8 };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result?.canceled || !result?.assets?.[0]) return;

    const asset = result.assets[0];
    const file = await prepareAvatarImage(
      { uri: asset.uri, name: asset.fileName ?? "avatar.jpg", type: asset.mimeType ?? "image/jpeg" },
      asset.width,
      asset.height,
    );

    // TEMP (spec 46 debugging)
    console.log("avatar upload asset = ", { uri: asset.uri, w: asset.width, h: asset.height, mime: asset.mimeType, size: asset.fileSize });
    console.log("avatar upload prepared = ", file);

    const formData = new FormData();
    formData.append("file", file as any);

    let outcome = await uploadPhotoMutation.mutateAsync({ url: "/auth/profile-picture", payload: formData });

    // TEMP (spec 46 debugging): if the re-encoded file can't be sent, retry once with the
    // picker's original. A 400 "too large" back (it is a 2.3MB PNG) proves transport works.
    if (!outcome?.ok && outcome?.offline) {
      const retryForm = new FormData();
      retryForm.append("file", { uri: asset.uri, name: asset.fileName ?? "orig.png", type: asset.mimeType ?? "image/png" } as any);
      outcome = await uploadPhotoMutation.mutateAsync({ url: "/auth/profile-picture", payload: retryForm });
      console.log("avatar retry with original = ", outcome);
    }

    if (outcome?.ok) {
      await applyPhoto(outcome?.body?.data?.profilePicture ?? null);
      Toast.show({ type: "success", text1: outcome?.body?.message ?? "Profile picture updated", position: "top" });
      return;
    }

    Toast.show({
      type: "error",
      text1: "Photo didn't upload",
      text2: outcome?.offline ? "You appear to be offline. Try again when you're back online." : outcome?.message,
      position: "top",
    });
  };

  const removePhoto = async () => {
    setRemoveOpen(false);

    // useDeleteData has no outcome variant, so success is read off the response body. On
    // failure the interceptor has already toasted - do not toast a second time.
    const result = await removePhotoMutation.mutateAsync({ url: "/auth/profile-picture" });
    if (result?.success) {
      await applyPhoto(null);
      Toast.show({ type: "success", text1: result?.message, position: "top" });
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C?.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screenPad }]} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router?.back()} hitSlop={8} style={{ marginLeft: -10 }}>
            <Ionicons name="chevron-back" size={22} color={C?.text} />
          </TouchableOpacity>
          <Text style={[text.h2, { color: C?.text }]}>Settings</Text>
        </View>

        <TouchableOpacity onPress={() => setEditOpen(true)} activeOpacity={0.8} style={[styles.profileCard, { backgroundColor: C?.surface, borderColor: C?.border }]}>
          <View>
            <UserAvatar name={displayName} uri={photoUrl} size={48} />
            {/* Decorative affordance only - the whole card is already one touch target that
                opens the edit sheet, and a nested touchable here is what causes dead taps. */}
            <View style={[styles.cameraBadge, { backgroundColor: C?.surface, borderColor: C?.border }]}>
              <Ionicons name="camera" size={10} color={C?.accent} />
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[text.bodyMd, { color: C?.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[text.bodySm, { color: C?.textSecondary }]} numberOfLines={1}>
              {displayEmail}
            </Text>
          </View>
          <View style={[styles.editBtn, { borderColor: C?.accentBorder }]}>
            <Text style={[text.bodySm, { color: C?.accent }]}>Edit</Text>
          </View>
        </TouchableOpacity>

        <Text style={[text.kicker, { color: C?.textSecondary, marginTop: spacing.xl, marginBottom: spacing.sm }]}>Appearance</Text>
        <View style={[styles.appearanceTrack, { backgroundColor: C?.surface2, borderColor: C?.border }]}>
          {APPEARANCE_OPTIONS.map((opt) => {
            const active = preference === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setPreference(opt.key)}
                style={[styles.appearanceOpt, active && { backgroundColor: C?.surface, borderColor: C?.border, borderWidth: 1 }]}
              >
                <Ionicons name={opt.icon} size={15} color={active ? C?.text : C?.textSecondary} />
                <Text style={[text.bodySm, { color: active ? C?.text : C?.textSecondary }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <CategoryManager />
        </View>

        {/* Admin-only entry to the error-log viewer (spec 36). Gated on `user` from the
            context, not on `profile?.data` — /auth/me's select omits userRole, so only the
            login response carries it. That also means this is visible exactly when the
            stored token carries the claim the server's adminCheck reads. */}
        {isAdmin(user) ? (
          <TouchableOpacity
            onPress={() => router?.push("/error-logs")}
            activeOpacity={0.8}
            style={[styles.adminRow, { backgroundColor: C?.surface, borderColor: C?.border }]}
          >
            <Ionicons name="bug-outline" size={18} color={C?.accent} />
            <Text style={[text.bodyMd, { color: C?.text, flex: 1 }]}>Error logs</Text>
            <Ionicons name="chevron-forward" size={18} color={C?.textMuted} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={() => setLogoutOpen(true)} activeOpacity={0.8} style={[styles.logoutBtn, { borderColor: `${C?.expense}80` }]}>
          <Ionicons name="log-out-outline" size={18} color={C?.expense} />
          <Text style={[text.bodyMd, { color: C?.expense }]}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Sheet visible={editOpen} onDismiss={() => setEditOpen(false)}>
        <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }} bottomOffset={20} extraKeyboardSpace={10} showsVerticalScrollIndicator={false}>
          <Text style={[text.h3, { color: C?.text, marginBottom: spacing.lg }]}>Edit profile</Text>

          <View style={styles.photoBlock}>
            <View>
              <UserAvatar name={displayName} uri={photoUrl} size={88} />
              {photoBusy ? (
                <View style={[styles.photoOverlay, { backgroundColor: `${C?.background}B3` }]}>
                  <ActivityIndicator color={C?.accent} />
                </View>
              ) : null}
            </View>
            <View style={styles.photoActions}>
              <TouchableOpacity onPress={() => setSourceOpen(true)} disabled={photoBusy} activeOpacity={0.8} style={[styles.photoBtn, photoBusy && { opacity: 0.5 }]}>
                <Ionicons name="camera-outline" size={16} color={C?.accent} />
                <Text style={[text.bodySm, { color: C?.accent }]}>{photoUrl ? "Change photo" : "Add photo"}</Text>
              </TouchableOpacity>
              {photoUrl ? (
                <TouchableOpacity onPress={() => setRemoveOpen(true)} disabled={photoBusy} activeOpacity={0.8} style={[styles.photoBtn, photoBusy && { opacity: 0.5 }]}>
                  <Ionicons name="trash-outline" size={16} color={C?.expense} />
                  <Text style={[text.bodySm, { color: C?.expense }]}>Remove photo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <FormField label="Name" value={name} onChangeText={setName} placeholder="Your name" inSheet />
          <FormField label="Email" value={displayEmail} editable={false} inSheet />
          <Text style={[text.caption, { color: C?.textMuted, marginTop: -spacing.md, marginBottom: spacing.lg }]}>
            Email can&apos;t be changed from the app yet.
          </Text>

          <PrimaryButton label={updateProfileMutation?.isPending ? "Saving…" : "Save"} onPress={saveName} loading={updateProfileMutation?.isPending} height={spacing.cta} />
        </KeyboardAwareScrollView>
      </Sheet>

      <Sheet visible={sourceOpen} onDismiss={() => setSourceOpen(false)}>
        <Text style={[text.h3, { color: C?.text, marginBottom: spacing.md }]}>Profile photo</Text>
        {Platform.OS !== "web" ? (
          <TouchableOpacity onPress={() => pickPhoto("camera")} activeOpacity={0.8} style={[styles.sourceRow, { borderColor: C?.border }]}>
            <Ionicons name="camera-outline" size={20} color={C?.accent} />
            <Text style={[text.bodyMd, { color: C?.text }]}>Take photo</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => pickPhoto("library")} activeOpacity={0.8} style={[styles.sourceRow, { borderColor: C?.border }]}>
          <Ionicons name="images-outline" size={20} color={C?.accent} />
          <Text style={[text.bodyMd, { color: C?.text }]}>Choose from library</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSourceOpen(false)} activeOpacity={0.8} style={styles.sourceCancel}>
          <Text style={[text.bodyMd, { color: C?.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </Sheet>

      <ConfirmModal
        visible={removeOpen}
        icon="trash-outline"
        title="Remove photo?"
        message="Your initials will be shown instead."
        confirmLabel="Remove"
        onCancel={() => setRemoveOpen(false)}
        onConfirm={removePhoto}
      />

      <ConfirmModal
        visible={logoutOpen}
        icon="log-out-outline"
        title="Log out?"
        message="You'll need to sign in again to see your transactions."
        confirmLabel="Log out"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          logoutFunction();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  nav: { flexDirection: "row", alignItems: "center", gap: spacing.xs, height: 44, marginBottom: spacing.base },
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.card, padding: spacing.md },
  cameraBadge: { position: "absolute", right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  editBtn: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  appearanceTrack: { flexDirection: "row", height: 40, padding: 3, borderRadius: radius.card, borderWidth: 1 },
  appearanceOpt: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.sm + 1 },
  adminRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: spacing.field, paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.card, marginTop: spacing.xl },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: spacing.field, borderWidth: 1, borderRadius: radius.card, marginTop: spacing.xl },
  photoBlock: { alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  photoOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  photoActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.xs },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: spacing.field, borderBottomWidth: 1 },
  sourceCancel: { height: spacing.field, alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
});
