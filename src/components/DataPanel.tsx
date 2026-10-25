import React, { useState } from "react";
import { Text, View } from "react-native";
import { Sheet, Action, sheetStyles as s } from "./Sheet";
import type { EditorPalette } from "./PaperEditor";
import type { Note } from "../types";
import { loadNotes, saveNotes, deleteNote } from "../storage";
import { flushDrafts, loadDrafts, updateDrafts } from "../drafts";
import { makeBackup, parseBackup, planImport, type Backup } from "../backup";
import { exportBackupFile, pickBackupFile } from "../files";

export function DataPanel({
  notes,
  palette,
  onClose,
  onChanged,
  onRestore,
}: {
  notes: Note[];
  palette: EditorPalette;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onRestore: (note: Note) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [backup, setBackup] = useState<Backup | null>(null),
    [confirmDelete, setConfirmDelete] = useState<Note | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const trash = notes
    .filter((n) => n.deletedAt)
    .sort((a, b) => b.deletedAt! - a.deletedAt!);
  return (
    <Sheet title="Trash & backups" onClose={onClose} palette={palette}>
      <Text style={[s.label, { color: palette.cream }]}>Keep a copy</Text>
      <Text style={[s.hint, { color: palette.muted }]}>
        A backup includes notes, sketches, drafts, collections, tags and Trash.
        Save the file somewhere you can find it again.
      </Text>
      <Action
        label={busy ? "Working…" : "Export backup"}
        disabled={busy}
        palette={palette}
        onPress={() =>
          void run(async () => {
            await flushDrafts();
            await exportBackupFile(
              makeBackup(await loadNotes(), await loadDrafts()),
            );
            setMessage("Backup file is ready.");
          })
        }
      />
      <Action
        label="Choose backup to import"
        disabled={busy}
        secondary
        palette={palette}
        onPress={() =>
          void run(async () => {
            const raw = await pickBackupFile();
            if (raw) setBackup(parseBackup(raw));
          })
        }
      />
      {backup ? (
        <View style={[s.card, { backgroundColor: palette.bg }]}>
          <Text style={[s.title, { color: palette.cream }]}>
            {backup.notes.length} notes · {backup.drafts.length} drafts
          </Text>
          <Text style={[s.hint, { color: palette.muted }]}>
            Identical notes are skipped. Different versions become separate
            copies. Imported reminders remain paused until you save each note.
          </Text>
          <Action
            label="Import backup"
            disabled={busy}
            palette={palette}
            onPress={() =>
              void run(async () => {
                await flushDrafts();
                const plan = planImport(
                  backup,
                  await loadNotes(),
                  await loadDrafts(),
                  () =>
                    Date.now().toString(36) +
                    Math.random().toString(36).slice(2),
                );
                await saveNotes(plan.notes);
                await updateDrafts((all) => [...plan.drafts, ...all]);
                await onChanged();
                setBackup(null);
                setMessage(
                  `Imported ${plan.notes.length} ${plan.notes.length === 1 ? "note" : "notes"} and ${plan.drafts.length} ${plan.drafts.length === 1 ? "draft" : "drafts"}. Existing notes were kept.`,
                );
              })
            }
          />
          <Action
            label="Cancel import"
            secondary
            palette={palette}
            onPress={() => setBackup(null)}
          />
        </View>
      ) : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.hint, { color: palette.accent }]}
        >
          {message}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
      <Text style={[s.label, { color: palette.cream }]}>
        Trash · {trash.length}
      </Text>
      <Text style={[s.hint, { color: palette.muted }]}>
        {trash.length
          ? "Deleted notes stay here until you restore or permanently delete them."
          : "Nothing in Trash."}
      </Text>
      {trash.map((note) => (
        <View key={note.id} style={[s.card, { backgroundColor: palette.bg }]}>
          <Text style={[s.title, { color: palette.cream }]}>
            {note.title || note.type}
          </Text>
          <Text numberOfLines={2} style={[s.hint, { color: palette.muted }]}>
            {note.body ||
              `${note.items.length} items · ${note.sketchPaths.length} strokes`}
          </Text>
          <Action
            label={`Restore ${note.title || note.type}`}
            disabled={busy}
            palette={palette}
            onPress={() =>
              void run(async () => {
                await onRestore(note);
                setMessage("Note restored.");
              })
            }
          />
          {confirmDelete?.id === note.id ? (
            <>
              <Text style={s.error}>
                Delete this note forever? This cannot be undone.
              </Text>
              <Action
                label="Delete forever"
                disabled={busy}
                secondary
                palette={palette}
                onPress={() =>
                  void run(async () => {
                    await deleteNote(note.id);
                    await onChanged();
                    setConfirmDelete(null);
                    setMessage("Note permanently deleted.");
                  })
                }
              />
              <Action
                label="Keep in Trash"
                secondary
                palette={palette}
                onPress={() => setConfirmDelete(null)}
              />
            </>
          ) : (
            <Action
              label={`Permanently delete ${note.title || note.type}`}
              secondary
              disabled={busy}
              palette={palette}
              onPress={() => setConfirmDelete(note)}
            />
          )}
        </View>
      ))}
    </Sheet>
  );
}
