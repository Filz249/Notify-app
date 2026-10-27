import type { Note, SketchStroke } from "./types";
export type Backup = {
  app: "Notify";
  version: 1;
  exportedAt: number;
  notes: Note[];
  drafts: Note[];
};
const types = [
  "note",
  "checklist",
  "todo",
  "shopping",
  "lyrics",
  "poem",
  "sketch",
  "brainstorm",
  "quote",
];
const hex = (v: unknown) => typeof v === "string" && /^#[\da-f]{6}$/i.test(v);
const finite = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const text = (v: unknown, max = 500_000): v is string =>
  typeof v === "string" && v.length <= max;
const validPaths = (paths: Array<string | SketchStroke>) =>
  Array.isArray(paths) &&
  paths.length <= 20000 &&
  paths.every((p) =>
    typeof p === "string"
      ? text(p, 1_000_000) && /^[MLml\d.,eE+\-\s]+$/.test(p)
      : !!p &&
        text(p.path, 1_000_000) &&
        /^[MLml\d.,eE+\-\s]+$/.test(p.path) &&
        hex(p.color) &&
        finite(p.width) &&
        p.width <= 100 &&
        (!p.style || ["solid", "dashed", "dotted"].includes(p.style)),
  );
const validSize = (size: Note["sketchSize"]) =>
  !!size &&
  finite(size.width) &&
  finite(size.height) &&
  size.width >= 1 &&
  size.height >= 1 &&
  size.width <= 10000 &&
  size.height <= 10000;
export const cleanTags = (value: string) =>
  [
    ...new Set(
      value
        .split(",")
        .map((t) => t.trim().replace(/^#+/, "").slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, 20);

export function validateNote(value: unknown): Note {
  const n = value as Note;
  if (
    !n ||
    !text(n.id, 128) ||
    !n.id ||
    !text(n.title) ||
    !text(n.body) ||
    !types.includes(n.type) ||
    !finite(n.createdAt) ||
    !finite(n.updatedAt) ||
    !Array.isArray(n.items) ||
    n.items.length > 10000 ||
    !Array.isArray(n.sketchPaths) ||
    n.sketchPaths.length > 20000
  )
    throw new Error(
      "This backup contains an invalid note. Nothing was imported.",
    );
  if (
    n.items.some(
      (i) =>
        !i ||
        !text(i.id, 128) ||
        !text(i.text) ||
        typeof i.checked !== "boolean" ||
        (i.price !== undefined && !finite(i.price)) ||
        (i.quantity !== undefined && !finite(i.quantity)),
    )
  )
    throw new Error("This backup contains an invalid list item.");
  if (!validPaths(n.sketchPaths))
    throw new Error("This backup contains an invalid sketch.");
  if (
    n.drawingOverlays !== undefined &&
    (!Array.isArray(n.drawingOverlays) ||
      n.drawingOverlays.length > 20 ||
      new Set(n.drawingOverlays.map((o) => o?.id)).size !==
        n.drawingOverlays.length ||
      n.drawingOverlays.some(
        (o) =>
          !o ||
          !text(o.id, 128) ||
          !o.id ||
          !text(o.name, 160) ||
          !validPaths(o.paths) ||
          !o.paths.length ||
          !validSize(o.size) ||
          !finite(o.width) ||
          o.width < 0.15 ||
          o.width > 0.95 ||
          !finite(o.x) ||
          o.x > 1 - o.width + 0.000001 ||
          !finite(o.y) ||
          o.y > 10000,
      ))
  )
    throw new Error("This backup contains an invalid drawing overlay.");
  for (const field of [
    "reminderAt",
    "snoozedUntil",
    "reminderCompletedAt",
    "deletedAt",
  ] as const)
    if (n[field] !== undefined && !finite(n[field]))
      throw new Error("This backup contains an invalid date.");
  if (
    n.reminderRepeat &&
    !["none", "daily", "weekly"].includes(n.reminderRepeat)
  )
    throw new Error("This reminder repeat option is not supported.");
  if (n.quoteAuthor !== undefined && !text(n.quoteAuthor, 500))
    throw new Error("Invalid quote author.");
  if (n.collection !== undefined && !text(n.collection, 80))
    throw new Error("Invalid collection name.");
  if (
    n.tags !== undefined &&
    (!Array.isArray(n.tags) ||
      n.tags.length > 20 ||
      n.tags.some((t) => !text(t, 40)))
  )
    throw new Error("Invalid tags.");
  if (
    n.sketchSize &&
    (!finite(n.sketchSize.width) ||
      !finite(n.sketchSize.height) ||
      n.sketchSize.width < 1 ||
      n.sketchSize.height < 1 ||
      n.sketchSize.width > 10000 ||
      n.sketchSize.height > 10000)
  )
    throw new Error("Invalid canvas size.");
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    quoteAuthor: n.quoteAuthor,
    important: !!n.important,
    color: hex(n.color) ? n.color : "#F2B23D",
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    items: n.items.map((i) => ({
      id: i.id,
      text: i.text,
      checked: i.checked,
      category: text(i.category, 80) ? i.category : undefined,
      price: i.price,
      quantity: i.quantity,
    })),
    sketchPaths: n.sketchPaths.map((p) =>
      typeof p === "string"
        ? p
        : { path: p.path, color: p.color, width: p.width, style: p.style },
    ),
    paperStyle: ["plain", "lines", "dots"].includes(n.paperStyle || "")
      ? n.paperStyle
      : "plain",
    sketchColor: hex(n.sketchColor) ? n.sketchColor : undefined,
    sketchBackground: hex(n.sketchBackground) ? n.sketchBackground : undefined,
    sketchWidth:
      typeof n.sketchWidth === "number" &&
      Number.isFinite(n.sketchWidth) &&
      n.sketchWidth > 0 &&
      n.sketchWidth <= 100
        ? n.sketchWidth
        : 3,
    sketchStyle: ["solid", "dashed", "dotted"].includes(n.sketchStyle || "")
      ? n.sketchStyle
      : "solid",
    sketchSize: n.sketchSize,
    drawingOverlays: n.drawingOverlays?.map((o) => ({
      id: o.id,
      name: o.name,
      x: o.x,
      y: o.y,
      width: o.width,
      size: { width: o.size.width, height: o.size.height },
      paths: o.paths.map((p) =>
        typeof p === "string"
          ? p
          : { path: p.path, color: p.color, width: p.width, style: p.style },
      ),
    })),
    reminderAt: n.reminderAt,
    reminderRepeat: n.reminderRepeat,
    reminderCompletedAt: n.reminderCompletedAt,
    snoozedUntil: n.snoozedUntil,
    reminderDelivery: n.reminderDelivery === "system" ? "system" : "in-app",
    collection: n.collection?.trim(),
    tags: n.tags,
    deletedAt: n.deletedAt,
  };
}

export function makeBackup(notes: Note[], drafts: Note[]): string {
  return JSON.stringify(
    {
      app: "Notify",
      version: 1,
      exportedAt: Date.now(),
      notes: notes.map(validateNote),
      drafts: drafts.map(validateNote),
    },
    null,
    2,
  );
}
export function parseBackup(raw: string): Backup {
  if (raw.length > 25_000_000)
    throw new Error("This backup is larger than 25 MB.");
  let data: Backup;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Choose a valid Notify JSON backup.");
  }
  if (
    data?.app !== "Notify" ||
    data.version !== 1 ||
    !Array.isArray(data.notes) ||
    !Array.isArray(data.drafts) ||
    data.notes.length + data.drafts.length > 10000
  )
    throw new Error("This file is not a supported Notify backup.");
  const notes = data.notes.map(validateNote),
    drafts = data.drafts.map(validateNote);
  if (
    new Set(notes.map((n) => n.id)).size !== notes.length ||
    new Set(drafts.map((n) => n.id)).size !== drafts.length
  )
    throw new Error("This backup contains duplicate note IDs.");
  return { ...data, notes, drafts };
}

// Identical records are skipped. Conflicting records are imported as separate copies.
export function planImport(
  backup: Backup,
  existing: Note[],
  drafts: Note[],
  id: () => string,
) {
  const taken = new Set([...existing, ...drafts].map((n) => n.id));
  const mapped = new Map<string, string>();
  const allocate = () => {
    let next = id();
    while (taken.has(next)) next = id();
    taken.add(next);
    return next;
  };
  const same = (a: Note, b: Note) =>
    JSON.stringify(validateNote(a)) === JSON.stringify(validateNote(b));
  const notes = backup.notes.flatMap((note) => {
    const old = existing.find((n) => same({ ...n, id: note.id }, note));
    if (old) {
      mapped.set(note.id, old.id);
      return [];
    }
    const nextId = taken.has(note.id) ? allocate() : note.id;
    taken.add(nextId);
    mapped.set(note.id, nextId);
    return [{ ...note, id: nextId, notificationId: undefined }];
  });
  const importedDrafts = backup.drafts.flatMap((note) => {
    const target = mapped.get(note.id) || note.id,
      old = drafts.find((n) => n.id === target);
    if (old && same(old, { ...note, id: target })) return [];
    const nextId =
      old || (!mapped.has(note.id) && taken.has(target)) ? allocate() : target;
    taken.add(nextId);
    return [{ ...note, id: nextId, notificationId: undefined }];
  });
  return { notes, drafts: importedDrafts };
}
