import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ClipboardPaste, ChevronRight, Plus } from "lucide-react-native";
import { Sheet, sheetStyles as s } from "./Sheet";
import type { Note } from "../types";
import type { EditorPalette } from "./PaperEditor";
import { supportsDrawings } from "../drawings";

export function DrawingPicker({
  notes,
  palette,
  onClose,
  onPick,
}: {
  notes: Note[];
  palette: EditorPalette;
  onClose: () => void;
  onPick: (note: Note | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const candidates = notes.filter((n) => !n.deletedAt && supportsDrawings(n));
  const pick = async (note: Note | null) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onPick(note);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not paste the drawing. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title="Paste into a note"
      palette={palette}
      onClose={() => !busy && onClose()}
    >
      <Text style={[s.hint, { color: palette.muted }]}>
        Choose a note. Once pasted, touch and hold the drawing to move or resize
        it.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Paste into a new note"
        disabled={busy}
        onPress={() => void pick(null)}
        style={[
          s.card,
          {
            backgroundColor: palette.bg,
            flexDirection: "row",
            alignItems: "center",
          },
        ]}
      >
        <Plus size={21} color={palette.accent} />
        <Text style={[s.label, { color: palette.cream }]}>New note</Text>
      </Pressable>
      {candidates.map((note) => (
        <Pressable
          key={note.id}
          accessibilityRole="button"
          accessibilityLabel={`Paste into ${note.title || "Untitled note"}`}
          disabled={busy}
          onPress={() => void pick(note)}
          style={[
            s.card,
            {
              backgroundColor: palette.bg,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            },
          ]}
        >
          <ClipboardPaste size={20} color={palette.accent} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={1} style={[s.label, { color: palette.cream }]}>
              {note.title || "Untitled note"}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: palette.muted, fontSize: 11 }}
            >
              {note.body || "A place for your drawing"}
            </Text>
          </View>
          <ChevronRight size={18} color={palette.muted} />
        </Pressable>
      ))}
      {busy ? (
        <Text style={[s.hint, { color: palette.muted }]}>Pasting drawing…</Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}
