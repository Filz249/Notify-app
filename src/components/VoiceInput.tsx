import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Mic, Square } from "lucide-react-native";
import { dictationLanguages } from "../dictation";
import type { DictationControls } from "../useDictation";
import type { EditorPalette } from "./PaperEditor";

type VoiceProps = {
  dictation: DictationControls;
  palette: EditorPalette;
};

export function VoiceInput({
  dictation,
  palette,
  disabled,
}: VoiceProps & { disabled: boolean }) {
  const active = dictation.phase !== "idle";
  const stopping = dictation.phase === "stopping";
  return (
    <Pressable
      testID="voice-input"
      accessibilityRole="button"
      accessibilityLabel={active ? "Stop voice typing" : "Start voice typing"}
      accessibilityHint={
        active
          ? "Finish dictation and keep your words."
          : "Add spoken words to this text. Choose the language in Settings."
      }
      accessibilityState={{ disabled: disabled || stopping, busy: stopping }}
      disabled={disabled || stopping}
      hitSlop={4}
      onPress={() => {
        void (active ? dictation.stop() : dictation.start());
      }}
      style={({ pressed }) => [
        s.microphone,
        active && { backgroundColor: palette.accent },
        { opacity: disabled || stopping ? 0.45 : pressed ? 0.65 : 1 },
      ]}
    >
      {active ? (
        <Square size={15} color={palette.bg} fill={palette.bg} />
      ) : (
        <Mic size={19} color={palette.muted} />
      )}
    </Pressable>
  );
}

export function VoiceInputStatus({ dictation, palette }: VoiceProps) {
  const active = dictation.phase !== "idle";
  if (!active && !dictation.error) return null;
  const status =
    dictation.phase === "requesting"
      ? "Allow microphone access…"
      : dictation.phase === "starting"
        ? "Starting…"
        : dictation.phase === "restarting"
          ? "Reconnecting…"
          : dictation.phase === "stopping"
            ? "Finishing…"
            : "Listening…";
  return (
    <View style={s.status}>
      {active ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.statusText, { color: palette.accent }]}
        >
          {status}
        </Text>
      ) : null}
      {dictation.interim ? (
        <Text
          testID="voice-transcript-preview"
          numberOfLines={3}
          style={[s.transcript, { color: palette.muted }]}
        >
          {dictation.interim}
        </Text>
      ) : null}
      {dictation.error ? (
        <Text
          accessibilityRole="alert"
          style={[s.statusText, { color: "#E77C70" }]}
        >
          {dictation.error}
        </Text>
      ) : null}
    </View>
  );
}

export function VoiceLanguage({ dictation, palette }: VoiceProps) {
  const active = dictation.phase !== "idle";
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Dictation language"
      style={s.languages}
    >
      {dictationLanguages.map((language) => {
        const selected = dictation.language === language.id;
        return (
          <Pressable
            key={language.id}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={language.id === "hr-HR" ? "Croatian" : "English"}
            accessibilityState={{ checked: selected, disabled: active }}
            disabled={active}
            onPress={() => dictation.setLanguage(language.id)}
            style={[
              s.language,
              {
                backgroundColor: selected ? palette.panel2 : "transparent",
                borderColor: selected ? palette.accent : palette.line,
              },
            ]}
          >
            <Text
              style={[
                s.languageText,
                { color: selected ? palette.accent : palette.muted },
              ]}
            >
              {language.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  microphone: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  status: { paddingHorizontal: 16, paddingBottom: 8, gap: 4 },
  statusText: { fontSize: 12, lineHeight: 18 },
  transcript: { fontSize: 14, lineHeight: 21 },
  languages: { flexDirection: "row", gap: 8 },
  language: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
  },
  languageText: { fontSize: 13, fontWeight: "600" },
});
