import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Sheet, Action, sheetStyles as s } from "./Sheet";
import type { EditorPalette } from "./PaperEditor";
import type { Note } from "../types";
import { cleanTags } from "../backup";
import { COLLECTIONS } from "../organization";
export function OrganizeSheet({
  note,
  notes,
  palette,
  onClose,
  onApply,
}: {
  note: Note;
  notes: Note[];
  palette: EditorPalette;
  onClose: () => void;
  onApply: (collection: string, tags: string[]) => Promise<void>;
}) {
  const [collection, setCollection] = useState(
    COLLECTIONS.find(
      (value) => value.toLowerCase() === note.collection?.trim().toLowerCase(),
    ) ||
      note.collection ||
      "",
  );
  const [tags, setTags] = useState((note.tags || []).join(", "));
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const apply = async () => {
    if (applying) return;
    setApplying(true);
    setError("");
    try {
      await onApply(collection.trim(), cleanTags(tags));
    } catch {
      setError("Could not save the organization. Please try again.");
    } finally {
      setApplying(false);
    }
  };
  const choices = [
    ...new Set([
      ...COLLECTIONS,
      ...notes
        .map((n) => n.collection)
        .filter(
          (c): c is string =>
            !!c &&
            !COLLECTIONS.some(
              (value) => value.toLowerCase() === c.trim().toLowerCase(),
            ),
        ),
    ]),
  ];
  return (
    <Sheet
      title="Organize note"
      palette={palette}
      onClose={() => !applying && onClose()}
    >
      <Text style={[s.label, { color: palette.cream }]}>Collection</Text>
      <TextInput
        accessibilityLabel="Collection name"
        editable={!applying}
        maxLength={80}
        placeholder="Choose or create a collection"
        placeholderTextColor={palette.muted}
        value={collection}
        onChangeText={setCollection}
        style={[s.input, { backgroundColor: palette.bg, color: palette.cream }]}
      />
      <View style={s.row}>
        {["", ...choices].map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            disabled={applying}
            accessibilityState={{ selected: collection === c }}
            onPress={() => setCollection(c)}
            style={[
              s.chip,
              {
                backgroundColor:
                  collection === c ? palette.accent : palette.panel2,
              },
            ]}
          >
            <Text
              style={[
                s.chipText,
                { color: collection === c ? palette.bg : palette.cream },
              ]}
            >
              {c || "No collection"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[s.label, { color: palette.cream }]}>Tags</Text>
      <TextInput
        accessibilityLabel="Note tags"
        editable={!applying}
        value={tags}
        onChangeText={setTags}
        placeholder="ideas, weekend, inspiration"
        placeholderTextColor={palette.muted}
        style={[s.input, { backgroundColor: palette.bg, color: palette.cream }]}
      />
      <Text style={[s.hint, { color: palette.muted }]}>
        Separate tags with commas. Search finds tags and collections too.
      </Text>
      <View style={s.row}>
        {cleanTags(tags).map((tag) => (
          <Text key={tag} style={[s.chipText, { color: palette.accent }]}>
            #{tag}
          </Text>
        ))}
      </View>
      <Action
        label={applying ? "Applying…" : "Apply organization"}
        palette={palette}
        disabled={applying}
        onPress={apply}
      />
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}
export function LibraryFilters({
  notes,
  collection,
  tag,
  palette,
  onClose,
  onApply,
}: {
  notes: Note[];
  collection: string;
  tag: string;
  palette: EditorPalette;
  onClose: () => void;
  onApply: (collection: string, tag: string) => void;
}) {
  const [c, setC] = useState(collection),
    [t, setT] = useState(tag);
  const collections = [
    ...new Set(notes.map((n) => n.collection).filter((v): v is string => !!v)),
  ].sort();
  const tags = [...new Set(notes.flatMap((n) => n.tags || []))].sort();
  return (
    <Sheet title="Collections & tags" palette={palette} onClose={onClose}>
      <Text style={[s.label, { color: palette.cream }]}>Collections</Text>
      <View style={s.row}>
        {["", ...collections].map((v) => (
          <Pressable
            accessibilityRole="button"
            key={v}
            onPress={() => setC(v)}
            style={[
              s.chip,
              { backgroundColor: c === v ? palette.accent : palette.panel2 },
            ]}
          >
            <Text
              style={[
                s.chipText,
                { color: c === v ? palette.bg : palette.cream },
              ]}
            >
              {v || "All collections"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[s.label, { color: palette.cream }]}>Tags</Text>
      <View style={s.row}>
        {["", ...tags].map((v) => (
          <Pressable
            accessibilityRole="button"
            key={v}
            onPress={() => setT(v)}
            style={[
              s.chip,
              { backgroundColor: t === v ? palette.accent : palette.panel2 },
            ]}
          >
            <Text
              style={[
                s.chipText,
                { color: t === v ? palette.bg : palette.cream },
              ]}
            >
              {v ? "#" + v : "All tags"}
            </Text>
          </Pressable>
        ))}
      </View>
      {!collections.length && !tags.length ? (
        <Text style={[s.hint, { color: palette.muted }]}>
          Open a note and tap Organize to add a collection or tags.
        </Text>
      ) : null}
      <Action
        label="Show notes"
        palette={palette}
        onPress={() => onApply(c, t)}
      />
    </Sheet>
  );
}
