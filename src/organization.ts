import type { Note } from "./types";

export const COLLECTIONS = [
  "Important",
  "Tasks",
  "Personal",
  "Creative",
] as const;
export type LibraryCategory =
  | "all"
  | "important"
  | "tasks"
  | "personal"
  | "creative";
const collectionKey = (note: Note) =>
  note.collection?.trim().toLowerCase() || "";
export const isImportant = (note: Note) =>
  note.important || collectionKey(note) === "important";

export function withImportance(note: Note, important: boolean): Note {
  return {
    ...note,
    important,
    collection:
      !important && collectionKey(note) === "important"
        ? undefined
        : note.collection,
  };
}

export function organizationChange(
  note: Note,
  collection: string,
  tags: string[],
): Partial<Note> {
  const name = collection.trim();
  const canonical =
    COLLECTIONS.find((value) => value.toLowerCase() === name.toLowerCase()) ||
    name;
  return {
    collection: canonical,
    tags,
    important: isImportant(note) || canonical === "Important",
  };
}

// Organization applies immediately, even while the note's content is a draft.
// Keep saved text and scheduled reminders untouched until the user saves them.
export function withDraftOrganization(note: Note, draft?: Note): Note {
  if (!draft || draft.id !== note.id || note.deletedAt) return note;
  return {
    ...note,
    collection: draft.collection,
    tags: draft.tags,
    important: isImportant(draft),
  };
}

export function libraryNotes(notes: Note[], drafts: Note[]): Note[] {
  const savedIds = new Set(notes.map((note) => note.id));
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]));
  return [
    ...notes
      .filter((note) => !note.deletedAt)
      .map((note) => withDraftOrganization(note, draftById.get(note.id))),
    ...drafts.filter((draft) => !draft.deletedAt && !savedIds.has(draft.id)),
  ];
}

export function matchesCategory(
  note: Note,
  category: LibraryCategory,
): boolean {
  if (category === "all") return true;
  if (category === "important") return isImportant(note);
  if (collectionKey(note) === category) return true;
  if (category === "tasks")
    return ["todo", "checklist", "shopping"].includes(note.type);
  if (category === "creative")
    return ["lyrics", "poem", "sketch", "brainstorm", "quote"].includes(
      note.type,
    );
  return false;
}
