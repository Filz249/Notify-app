import type { Note } from "./types";
const KEY = "notify:setting:drafts-v1";
export const hasContent = (note: Note) =>
  !!(
    note.title.trim() ||
    note.body.trim() ||
    note.quoteAuthor?.trim() ||
    note.items.length ||
    note.sketchPaths.length
  );
const read = (): Note[] => JSON.parse(localStorage.getItem(KEY) || "[]");
export async function loadDrafts() {
  return read();
}
export async function updateDrafts(change: (drafts: Note[]) => Note[]) {
  localStorage.setItem(KEY, JSON.stringify(change(read())));
}
export const saveDraft = (note: Note) =>
  updateDrafts((all) =>
    hasContent(note)
      ? [note, ...all.filter((n) => n.id !== note.id)]
      : all.filter((n) => n.id !== note.id),
  );
export const removeDraft = (id: string) =>
  updateDrafts((all) => all.filter((n) => n.id !== id));
export const flushDrafts = async () => {};
