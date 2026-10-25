import React from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import type { EditorPalette } from "./PaperEditor";
import { layout } from "../layout";

const serif =
  Platform.OS === "ios"
    ? "Georgia"
    : Platform.OS === "web"
      ? "Georgia, serif"
      : "serif";

export function QuoteEditor({
  value,
  author,
  onChange,
  onAuthorChange,
  palette,
  accent,
}: {
  value: string;
  author: string;
  onChange: (text: string) => void;
  onAuthorChange: (text: string) => void;
  palette: EditorPalette;
  accent: string;
}) {
  return (
    <View testID="quote-section" style={s.section}>
      <View style={[s.paper, { backgroundColor: palette.panel }]}>
        <Text
          accessible={false}
          aria-hidden
          style={[s.mark, { color: accent }]}
        >
          “
        </Text>
        <View style={s.writingArea}>
          <Text
            aria-hidden
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[s.writing, s.measure]}
          >
            {(value || "A few words worth keeping…") + "\u200b"}
          </Text>
          <TextInput
            accessibilityLabel="Quote text"
            value={value}
            onChangeText={onChange}
            placeholder="A few words worth keeping…"
            placeholderTextColor={palette.muted}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            style={[
              s.writing,
              StyleSheet.absoluteFill,
              { color: palette.cream },
            ]}
          />
        </View>
        <Text
          accessible={false}
          aria-hidden
          style={[s.mark, s.closingMark, { color: accent }]}
        >
          ”
        </Text>
      </View>
      <View style={s.authorSection}>
        <Text style={[s.label, { color: palette.muted }]}>Author</Text>
        <View style={[s.authorField, { backgroundColor: palette.panel }]}>
          <Text
            accessible={false}
            aria-hidden
            style={[s.dash, { color: accent }]}
          >
            —
          </Text>
          <TextInput
            accessibilityLabel="Quote author"
            value={author}
            onChangeText={onAuthorChange}
            placeholder="Who said it?"
            placeholderTextColor={palette.muted}
            maxLength={200}
            autoCapitalize="words"
            style={[s.authorInput, { color: palette.cream }]}
          />
        </View>
      </View>
    </View>
  );
}

export function QuotePreview({
  value,
  author,
  palette,
}: {
  value: string;
  author?: string;
  palette: EditorPalette;
}) {
  return (
    <View style={s.preview}>
      <Text numberOfLines={5} style={[s.previewText, { color: palette.cream }]}>
        “{value}”
      </Text>
      {author?.trim() ? (
        <Text
          numberOfLines={2}
          style={[s.previewAuthor, { color: palette.muted }]}
        >
          — {author.trim()}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: layout.contentGap },
  paper: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  mark: { fontFamily: serif, fontSize: 72, lineHeight: 64, height: 60 },
  closingMark: { textAlign: "right", height: 48 },
  writingArea: { minWidth: 0 },
  measure: { opacity: 0 },
  writing: {
    fontFamily: serif,
    fontSize: 23,
    lineHeight: 34,
    padding: 0,
    margin: 0,
    minHeight: 180,
    outlineWidth: 0,
    outlineStyle: "solid",
  },
  authorSection: { gap: 8 },
  label: { fontSize: 12, fontWeight: "600" },
  authorField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  dash: { fontSize: 20 },
  authorInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingVertical: 14,
    fontSize: 15,
    outlineWidth: 0,
    outlineStyle: "solid",
  },
  preview: { marginTop: 16, gap: 12 },
  previewText: { fontFamily: serif, fontSize: 20, lineHeight: 29 },
  previewAuthor: { fontSize: 12, lineHeight: 18 },
});
