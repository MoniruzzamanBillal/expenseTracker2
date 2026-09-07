import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps, TouchableOpacity, TextStyle } from "react-native";
import { useTheme, text, spacing, radius } from "@/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type TProps = TextInputProps & {
  label: string;
  error?: string;
  passwordToggle?: boolean;
  inputStyle?: TextStyle;
};

export default function FormField({ label, error, passwordToggle, secureTextEntry, inputStyle, ...inputProps }: TProps) {
  const C = useTheme();
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  return (
    <View style={label ? styles.wrap : undefined}>
      {label ? (
        <Text style={[text.label, { color: C.textSecondary, marginBottom: spacing.xs }]}>{label.toUpperCase()}</Text>
      ) : null}
      <View style={[styles.inputWrap, { backgroundColor: C.inputBg, borderColor: error ? C.expense : C.border }]}>
        <TextInput
          {...inputProps}
          secureTextEntry={passwordToggle ? hidden : secureTextEntry}
          style={[styles.input, text.body, { color: C.text }, inputStyle]}
          placeholderTextColor={C.placeholder}
        />
        {passwordToggle ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} style={styles.eyeBtn}>
            <MaterialCommunityIcons name={hidden ? "eye-off-outline" : "eye-outline"} size={18} color={C.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={[text.caption, { color: C.expense, marginTop: spacing.xs }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  inputWrap: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  input: { flex: 1, height: 52, paddingHorizontal: spacing.base },
  eyeBtn: { paddingHorizontal: spacing.base, height: 52, justifyContent: "center" },
});
