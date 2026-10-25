import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { X } from "lucide-react-native";
import type { EditorPalette } from "./PaperEditor";
export function Sheet({
  title,
  onClose,
  palette,
  children,
}: {
  title: string;
  onClose: () => void;
  palette: EditorPalette;
  children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.shade}>
        <View
          style={[
            s.sheet,
            { backgroundColor: palette.panel, maxHeight: height - 48 },
          ]}
        >
          <View style={s.head}>
            <Text style={[s.title, { color: palette.cream }]}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title.toLowerCase()}`}
              onPress={onClose}
              style={s.close}
            >
              <X size={21} color={palette.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function Action({
  label,
  onPress,
  palette,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  palette: EditorPalette;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.action,
        {
          backgroundColor: secondary ? palette.panel2 : palette.accent,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text
        style={[
          s.actionText,
          { color: secondary ? palette.cream : palette.bg },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export const sheetStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600" },
  hint: { fontSize: 12, lineHeight: 19 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    outlineWidth: 0,
    outlineStyle: "solid",
  },
  chip: {
    maxWidth: "100%",
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 12,
    justifyContent: "center",
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  error: { color: "#E77C70", fontSize: 13, lineHeight: 19 },
  card: { padding: 16, borderRadius: 16, gap: 10 },
  title: { fontSize: 15, fontWeight: "600" },
});
const s = StyleSheet.create({
  shade: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(7,4,2,.76)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: { width: "100%", maxWidth: 480, borderRadius: 24, padding: 20 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  title: { flex: 1, fontSize: 21, fontWeight: "700" },
  close: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { gap: 16, paddingBottom: 4 },
  action: {
    minHeight: 46,
    padding: 12,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 13, fontWeight: "700" },
});
