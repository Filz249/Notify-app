import type { DrawingOverlay, Note } from "./types";

export const supportsDrawings = (note: Note) =>
  ["note", "lyrics", "poem", "brainstorm"].includes(note.type);

export function createDrawingOverlay(
  source: Note,
  id: string,
  index = 0,
): DrawingOverlay {
  if (!source.sketchPaths.length)
    throw new Error("Draw something before pasting it into a note.");
  return {
    id,
    name: source.title.trim().slice(0, 160) || "Untitled drawing",
    paths: source.sketchPaths.map((p) =>
      typeof p === "string" ? p : { ...p },
    ),
    size: { ...(source.sketchSize || { width: 360, height: 400 }) },
    x: 0.35,
    y: 24 + (index % 5) * 28,
    width: 0.55,
  };
}

export function placeDrawing(
  overlay: DrawingOverlay,
  change: Partial<Pick<DrawingOverlay, "x" | "y" | "width">>,
): DrawingOverlay {
  const width = Math.max(0.15, Math.min(0.95, change.width ?? overlay.width));
  return {
    ...overlay,
    width,
    x: Math.max(0, Math.min(1 - width, change.x ?? overlay.x)),
    y: Math.max(0, Math.min(10000, change.y ?? overlay.y)),
  };
}

export const drawingHeight = (overlay: DrawingOverlay, paperWidth: number) =>
  (overlay.width * paperWidth * overlay.size.height) / overlay.size.width;

export function sketchPoint(
  x: number,
  y: number,
  display: { width: number; height: number },
  size: { width: number; height: number },
) {
  const scale = Math.min(
    display.width / size.width,
    display.height / size.height,
  );
  const px = (x - (display.width - size.width * scale) / 2) / scale;
  const py = (y - (display.height - size.height * scale) / 2) / scale;
  return {
    x: Math.round(Math.max(0, Math.min(size.width, px)) * 100) / 100,
    y: Math.round(Math.max(0, Math.min(size.height, py)) * 100) / 100,
    inside: px >= 0 && py >= 0 && px <= size.width && py <= size.height,
  };
}
