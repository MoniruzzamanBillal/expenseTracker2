import { useFetchData } from "@/hooks/useApi";
import { radius, spacing, text, useTheme } from "@/theme";
import { TCategory } from "@/types/Category.types";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import Sheet from "./Sheet";

type TProps = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  label?: string;
  /**
   * Trigger field sits on `inputBgSheet` instead of `inputBg` — for a field rendered
   * inside a `Sheet`, whose own background is `surface` (and `inputBg === surface` in
   * both schemes, so the field would vanish). Same prop, same meaning, as `FormField`.
   */
  inSheet?: boolean;
};

/** Below this many categories a search box over the list is noise rather than help. */
const SEARCH_MIN = 8;
/**
 * The list needs a bounded height of its own to scroll internally: capping only the
 * sheet would clip the rows instead, since a `FlatList` in an unbounded parent sizes
 * to its content. ~7 rows.
 */
const LIST_MAX_H = 360;

/**
 * Spec 44: a select field that opens a searchable bottom sheet. Replaces
 * `CategoryPicker`'s horizontal chip row on Add Transaction and the edit modal, where
 * most categories were off-screen and each one cost a swipe.
 */
export default function CategorySelectField({
  value,
  onChange,
  label = "Category",
  inSheet,
}: TProps) {
  const C = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data, isPending, isError, error, refetch } = useFetchData<TCategory[]>(
    ["categories"],
    "/categories",
  );
  const categories = useMemo(() => data?.data ?? [], [data?.data]);

  const selected = categories.find((c) => c._id === value) ?? null;
  const showSearch = categories.length >= SEARCH_MIN;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c?.name?.toLowerCase().includes(q));
  }, [categories, query]);

  // The query is dropped on close so the next open starts on the full list.
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId);
    close();
  };

  return (
    <View>
      {label ? (
        <Text
          style={[
            text.captionMd,
            { color: C?.textSecondary, marginBottom: spacing.xs + 1 },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={[
          styles.field,
          {
            backgroundColor: inSheet ? C?.inputBgSheet : C?.inputBg,
            borderColor: C?.border,
          },
        ]}
      >
        {selected ? (
          <View style={[styles.iconTile, { backgroundColor: C?.accentDim }]}>
            <MaterialCommunityIcons
              name={(selected.icon as any) ?? "shape"}
              size={16}
              color={C?.accentText}
            />
          </View>
        ) : null}
        {/* Placeholder in every non-ready state too: the old chip row claimed
            "No categories yet" while the first fetch was still in flight. */}
        <Text
          style={[
            text.body,
            { color: selected ? C?.text : C?.placeholder, flex: 1 },
          ]}
          numberOfLines={1}
        >
          {selected ? selected.name : "Select category"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C?.textMuted} />
      </TouchableOpacity>

      <Sheet visible={open} onDismiss={close} maxHeightPct={80}>
        {/* Paper's Modal does no keyboard avoidance and this sheet is anchored to the
            bottom, so the search field would sit under the keyboard. This is the
            keyboard library the rest of the app already uses; a FlatList can't be
            nested in its KeyboardAwareScrollView, hence the AvoidingView. */}
        <KeyboardAvoidingView behavior="padding">
          <View style={styles.headRow}>
            <Text style={[text.h3, { color: C?.text }]}>Select category</Text>
            <TouchableOpacity onPress={close} hitSlop={8}>
              <Ionicons name="close" size={20} color={C?.textMuted} />
            </TouchableOpacity>
          </View>

          {showSearch ? (
            <View
              style={[
                styles.searchRow,
                { backgroundColor: C?.inputBgSheet, borderColor: C?.border },
              ]}
            >
              <Ionicons name="search-outline" size={17} color={C?.textMuted} />
              {/* A bare TextInput for the same reason AddTransactionPage's title row
                  uses one: this row already draws the border, background and height
                  FormField would duplicate, and FormField's root has no flex. */}
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search categories"
                placeholderTextColor={C?.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                underlineColorAndroid="transparent"
                style={[styles.searchInput, text.body, { color: C?.text }]}
              />
            </View>
          ) : null}

          {isPending ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={C?.accent} />
            </View>
          ) : isError ? (
            <ErrorState
              title="Couldn't load categories"
              message={(error as Error)?.message ?? "Network Error"}
              onRetry={refetch}
            />
          ) : categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              subtitle="Add one from Settings to tag your entries."
              icon="pricetags-outline"
            />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item._id}
              style={styles.list}
              // Without this the first tap only dismisses the keyboard.
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => (
                <View
                  style={[styles.divider, { backgroundColor: C?.divider }]}
                />
              )}
              ListEmptyComponent={
                <Text
                  style={[
                    text.caption,
                    { color: C?.textMuted, paddingVertical: spacing.md },
                  ]}
                >
                  No category matches “{query.trim()}”
                </Text>
              }
              // "No category" is an action, not a list entry, so it stays pinned at
              // the bottom and is never filtered out by the search.
              ListFooterComponent={
                <>
                  <View
                    style={[styles.divider, { backgroundColor: C?.divider }]}
                  />
                  <TouchableOpacity
                    onPress={() => handleSelect(null)}
                    activeOpacity={0.8}
                    style={[
                      styles.row,
                      !value && { backgroundColor: C?.accentDim },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconTile,
                        { backgroundColor: !value ? C?.surface : C?.surface2 },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="shape-outline"
                        size={16}
                        color={!value ? C?.accentText : C?.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        text.body,
                        {
                          flex: 1,
                          color: !value ? C?.accentText : C?.textSecondary,
                        },
                      ]}
                    >
                      No category
                    </Text>
                    {!value ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={C?.accentText}
                      />
                    ) : null}
                  </TouchableOpacity>
                </>
              }
              renderItem={({ item }) => {
                const active = value === item._id;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect(item._id)}
                    activeOpacity={0.8}
                    style={[
                      styles.row,
                      active && { backgroundColor: C?.accentDim },
                    ]}
                  >
                    {/* The tile steps to `surface` on a selected row: `surface2` on
                        `accentDim` is near-invisible in light mode. */}
                    <View
                      style={[
                        styles.iconTile,
                        { backgroundColor: active ? C?.surface : C?.surface2 },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={(item.icon as any) ?? "shape"}
                        size={16}
                        color={active ? C?.accentText : C?.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        text.body,
                        { flex: 1, color: active ? C?.accentText : C?.text },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {active ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={C?.accentText}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </KeyboardAvoidingView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  // No outer margin on the root: Add Transaction's content container already applies a
  // uniform `gap: spacing.md`, and the edit modal wraps the call site in its own
  // marginTop — the old `wrap: { marginBottom: spacing.lg }` double-spaced both.
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: radius.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 46,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  // outlineWidth kills the browser's focus ring on the web target, the same way
  // AddTransactionPage's title input does; the row's border is the focus affordance.
  searchInput: { flex: 1, height: "100%", padding: 0, outlineWidth: 0 },
  list: { flexGrow: 0, maxHeight: LIST_MAX_H },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: spacing.field,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.card,
  },
  divider: { height: 1 },
  stateWrap: { paddingVertical: spacing.xl, alignItems: "center" },
});
