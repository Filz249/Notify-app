import type { Note, SketchStroke } from "./types";
const stroke = (p: string | SketchStroke): SketchStroke =>
  typeof p === "string"
    ? { path: p, color: "#F2B23D", width: 3, style: "solid" }
    : p;
// Parse stroke geometry once per eraser gesture, not on every touch event.
export function createStrokeEraser(paths: Note["sketchPaths"]) {
  let remaining = paths;
  let geometry = paths.map((p) => {
    const s = stroke(p);
    const points = (
      s.path.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || []
    ).map(Number);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i]);
      maxX = Math.max(maxX, points[i]);
      minY = Math.min(minY, points[i + 1]);
      maxY = Math.max(maxY, points[i + 1]);
    }
    return { p, points, width: s.width, minX, minY, maxX, maxY };
  });
  return (x: number, y: number, radius: number) => {
    const next = geometry.filter((g) => {
      const threshold = radius + g.width / 2;
      if (
        x < g.minX - threshold ||
        x > g.maxX + threshold ||
        y < g.minY - threshold ||
        y > g.maxY + threshold
      )
        return true;
      for (let i = 2; i < g.points.length; i += 2) {
        const ax = g.points[i - 2],
          ay = g.points[i - 1],
          bx = g.points[i],
          by = g.points[i + 1];
        const dx = bx - ax,
          dy = by - ay;
        const t = Math.max(
          0,
          Math.min(
            1,
            ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1),
          ),
        );
        if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= threshold)
          return false;
      }
      return true;
    });
    if (next.length !== geometry.length) {
      geometry = next;
      remaining = geometry.map((g) => g.p);
    }
    return remaining;
  };
}
export function eraseAt(
  paths: Note["sketchPaths"],
  x: number,
  y: number,
  radius: number,
): Note["sketchPaths"] {
  return createStrokeEraser(paths)(x, y, radius);
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
