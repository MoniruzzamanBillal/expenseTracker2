import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps, TouchableOpacity, TextStyle } from "react-native";
import { useTheme, text, spacing, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";

type TProps = TextInputProps & {
  label: string;
  error?: string;
  /** Red border with no inline message — for a field whose error is shown elsewhere (e.g. a banner above the submit button). */
  invalid?: boolean;
  passwordToggle?: boolean;
  inputStyle?: TextStyle;
  /** Use inputBgSheet instead of inputBg — for fields rendered inside a bottom sheet. */
  inSheet?: boolean;
};

export default function FormField({ label, error, invalid, passwordToggle, secureTextEntry, inputStyle, inSheet, ...inputProps }: TProps) {
  const C = useTheme();
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  return (
    <View style={label ? styles.wrap : undefined}>
      {label ? <Text style={[text.captionMd, { color: C.textSecondary, marginBottom: spacing.xs + 1 }]}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: inSheet ? C.inputBgSheet : C.inputBg, borderColor: error || invalid ? C.expense : C.border },
          (inputProps.editable === false) && { opacity: 0.45 },
        ]}
      >
        <TextInput
          {...inputProps}
          secureTextEntry={passwordToggle ? hidden : secureTextEntry}
          style={[styles.input, text.body, { color: C.text }, inputStyle]}
          placeholderTextColor={C.placeholder}
        />
        {passwordToggle ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} style={styles.eyeBtn}>
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={18} color={C.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color={C.expense} />
          <Text style={[text.caption, { color: C.expense }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  inputWrap: { flexDirection: "row", alignItems: "center", borderRadius: radius.card, borderWidth: 1, overflow: "hidden" },
  input: { flex: 1, height: spacing.field, paddingHorizontal: spacing.base },
  eyeBtn: { paddingHorizontal: spacing.base, height: spacing.field, justifyContent: "center" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.xs },
});
