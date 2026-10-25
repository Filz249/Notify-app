import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronDown, ChevronUp, FileText, Plus } from "lucide-react-native";
import type { EditorPalette } from "./PaperEditor";
import { layout } from "../layout";

export function DetailsNote({
  value,
  onChange,
  palette,
}: {
  value: string;
  onChange: (value: string) => void;
  palette: EditorPalette;
}) {
  const [open, setOpen] = useState(Boolean(value));
  return (
    <View
      testID="details-section"
      style={[
        s.section,
        {
          borderColor: palette.line,
          backgroundColor: open ? palette.panel : "transparent",
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          open ? "Collapse additional notes" : "Expand additional notes"
        }
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={s.toggle}
      >
        <FileText size={17} color={palette.muted} />
        <Text style={[s.label, { color: palette.muted }]}>
          {value || open ? "Additional notes" : "Add a note"}
        </Text>
        {open ? (
          <ChevronUp size={17} color={palette.muted} />
        ) : value ? (
          <ChevronDown size={17} color={palette.muted} />
        ) : (
          <Plus size={17} color={palette.muted} />
        )}
      </Pressable>
      {open ? (
        <TextInput
          accessibilityLabel="Additional notes"
          value={value}
          onChangeText={onChange}
          multiline
          textAlignVertical="top"
          placeholder="Details, links, anything helpful…"
          placeholderTextColor={palette.muted}
          style={[s.input, { color: palette.cream }]}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: { borderRadius: 16, borderWidth: 0, overflow: "hidden" },
  toggle: {
    minHeight: 50,
    paddingHorizontal: layout.cardInset,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.controlGap,
  },
  label: { fontSize: 13, fontWeight: "600", flex: 1 },
  input: {
    minHeight: 142,
    fontSize: 15,
    lineHeight: 24,
    paddingHorizontal: layout.cardInset,
    paddingBottom: layout.cardInset,
    paddingTop: 0,
    outlineWidth: 0,
    outlineStyle: "solid",
  },
});
