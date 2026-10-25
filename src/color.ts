export type HSV = { h: number; s: number; v: number };
export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export function hsvToHex({ h, s, v }: HSV): string {
  h = ((h % 360) + 360) % 360;
  s = clamp(s);
  v = clamp(v);
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    rgb
      .map((channel) =>
        Math.round((channel + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

export function hexToHsv(hex: string): HSV {
  const [r, g, b] = [1, 3, 5].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const hue = !delta
    ? 0
    : max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
}

export function wheelColor(
  x: number,
  y: number,
  size: number,
  value: number,
): HSV {
  const dx = x - size / 2,
    dy = y - size / 2;
  return {
    h: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360,
    s: clamp(Math.hypot(dx, dy) / (size / 2)),
    v: clamp(value),
  };
}
