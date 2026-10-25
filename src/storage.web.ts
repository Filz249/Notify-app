import type { Note } from "./types";

const NOTES_KEY = "notify:notes:v1";
const settingKey = (key: string) => `notify:setting:${key}`;

// Keep browser preview data separate from the mobile SQLite database.
export async function loadNotes(): Promise<Note[]> {
  const notes = JSON.parse(localStorage.getItem(NOTES_KEY) ?? "[]") as Note[];
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveNote(note: Note): Promise<void> {
  const notes = JSON.parse(localStorage.getItem(NOTES_KEY) ?? "[]") as Note[];
  localStorage.setItem(
    NOTES_KEY,
    JSON.stringify([
      note,
      ...notes.filter((existing) => existing.id !== note.id),
    ]),
  );
  window.dispatchEvent(new Event("notify:notes-changed"));
}

export async function deleteNote(id: string): Promise<void> {
  const notes = JSON.parse(localStorage.getItem(NOTES_KEY) ?? "[]") as Note[];
  localStorage.setItem(
    NOTES_KEY,
    JSON.stringify(notes.filter((note) => note.id !== id)),
  );
  window.dispatchEvent(new Event("notify:notes-changed"));
}

export async function saveNotes(incoming: Note[]): Promise<void> {
  const all = JSON.parse(localStorage.getItem(NOTES_KEY) ?? "[]") as Note[];
  const merged = new Map(all.map((note) => [note.id, note]));
  incoming.forEach((note) => merged.set(note.id, note));
  localStorage.setItem(NOTES_KEY, JSON.stringify([...merged.values()]));
  window.dispatchEvent(new Event("notify:notes-changed"));
}

export async function getSetting(
  key: string,
  fallback: string,
): Promise<string> {
  return localStorage.getItem(settingKey(key)) ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  localStorage.setItem(settingKey(key), value);
}
