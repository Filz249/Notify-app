import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export function TitleField({
  value,
  onChange,
  placeholder,
  color,
  muted,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={s.wrap}>
      {/* Matching text keeps the title tall enough as its content or width changes. */}
      <Text
        aria-hidden
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[s.type, s.measure]}
      >
        {(value || placeholder) + "\u200b"}
      </Text>
      <TextInput
        accessibilityLabel="Note title"
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={muted}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
        style={[s.type, StyleSheet.absoluteFill, { color }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
  type: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
    paddingHorizontal: 0,
    paddingVertical: 4,
    minHeight: 46,
    outlineWidth: 0,
    outlineStyle: "solid",
  },
  measure: { opacity: 0 },
});
