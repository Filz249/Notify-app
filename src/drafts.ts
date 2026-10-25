import { getSetting, setSetting } from "./storage";
import type { Note } from "./types";

let writes: Promise<unknown> = Promise.resolve();
export const hasContent = (note: Note) =>
  !!(
    note.title.trim() ||
    note.body.trim() ||
    note.quoteAuthor?.trim() ||
    note.items.length ||
    note.sketchPaths.length
  );
export async function loadDrafts(): Promise<Note[]> {
  const result = JSON.parse(await getSetting("drafts-v1", "[]"));
  return Array.isArray(result)
    ? result.filter(
        (n) => n && typeof n.id === "string" && typeof n.body === "string",
      )
    : [];
}
export function updateDrafts(
  change: (drafts: Note[]) => Note[],
): Promise<void> {
  const result = writes
    .catch(() => {})
    .then(async () =>
      setSetting("drafts-v1", JSON.stringify(change(await loadDrafts()))),
    );
  writes = result;
  return result;
}
export const saveDraft = (note: Note) =>
  updateDrafts((all) =>
    hasContent(note)
      ? [note, ...all.filter((n) => n.id !== note.id)]
      : all.filter((n) => n.id !== note.id),
  );
export const removeDraft = (id: string) =>
  updateDrafts((all) => all.filter((n) => n.id !== id));
export const flushDrafts = () => writes;
