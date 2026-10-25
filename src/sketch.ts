import type { Note, SketchStroke } from "./types";
const stroke = (p: string | SketchStroke): SketchStroke =>
  typeof p === "string"
    ? { path: p, color: "#F2B23D", width: 3, style: "solid" }
    : p;
export function eraseAt(
  paths: Note["sketchPaths"],
  x: number,
  y: number,
  radius: number,
): Note["sketchPaths"] {
  return paths.filter((p) => {
    const s = stroke(p),
      numbers = (s.path.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || []).map(
        Number,
      ),
      threshold = radius + s.width / 2;
    for (let i = 2; i < numbers.length; i += 2) {
      const ax = numbers[i - 2],
        ay = numbers[i - 1],
        bx = numbers[i],
        by = numbers[i + 1],
        dx = bx - ax,
        dy = by - ay;
      const t = Math.max(
        0,
        Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
      );
      if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= threshold)
        return false;
    }
    return true;
  });
}
const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
export function sketchSvg(
  note: Note,
  size = note.sketchSize || { width: 360, height: 400 },
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size.width)}" height="${Math.ceil(size.height)}" viewBox="0 0 ${size.width} ${size.height}"><rect width="100%" height="100%" fill="${escape(note.sketchBackground || "#2B1B12")}"/>${note.sketchPaths
    .map((p) => {
      const s = stroke(p);
      return `<path d="${escape(s.path)}" stroke="${escape(s.color)}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"${s.style === "dashed" ? ' stroke-dasharray="8 6"' : s.style === "dotted" ? ' stroke-dasharray="1 6"' : ""}/>`;
    })
    .join("")}</svg>`;
}
