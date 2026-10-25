import React, { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";
import {
  Pencil,
  RotateCcw,
  RotateCw,
  Download,
  Eraser,
} from "lucide-react-native";
import { ColorPicker, ColorWheelIcon } from "./ColorPicker";
import type { EditorPalette } from "./PaperEditor";
import type { Note, SketchStroke } from "../types";
import { layout } from "../layout";
import { eraseAt, sketchSvg } from "../sketch";
import { exportSketchImage } from "../files";

const COLORS = [
  "#F2B23D",
  "#F5EBDD",
  "#E77C70",
  "#63BBB8",
  "#A8C66C",
  "#B49ADF",
  "#69AEEB",
  "#24201D",
];
const PAPERS = [
  { label: "Espresso", color: "#2B1B12" },
  { label: "Paper", color: "#F5EBDD" },
  { label: "White", color: "#FFFFFF" },
  { label: "Sage", color: "#E7EBDD" },
];

export function SketchEditor({
  note,
  onChange,
  palette,
}: {
  note: Note;
  onChange: (patch: Partial<Note>) => void;
  palette: EditorPalette;
}) {
  const [picker, setPicker] = useState(false);
  const [undo, setUndo] = useState<Note["sketchPaths"][]>([]),
    [redo, setRedo] = useState<Note["sketchPaths"][]>([]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen"),
    [exporting, setExporting] = useState(false),
    [message, setMessage] = useState("");
  const svgRef = useRef<Svg>(null);
  const canvasSize = useRef({ width: 360, height: 400 });
  const commit = (
    sketchPaths: Note["sketchPaths"],
    size?: { width: number; height: number },
  ) => {
    setUndo((all) => [...all.slice(-99), note.sketchPaths]);
    setRedo([]);
    onChange({ sketchPaths, ...(size ? { sketchSize: size } : {}) });
  };
  const exportImage = async () => {
    setExporting(true);
    setMessage("");
    try {
      await exportSketchImage(
        sketchSvg(note, note.sketchSize || canvasSize.current),
        note.title || "Notify-sketch",
        () =>
          new Promise<string>((resolve, reject) => {
            if (!svgRef.current)
              return reject(new Error("Canvas is not ready."));
            svgRef.current.toDataURL(resolve);
          }),
      );
      setMessage("Your PNG image is ready.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not export the image.",
      );
    } finally {
      setExporting(false);
    }
  };
  const color = note.sketchColor || COLORS[0];
  const width = note.sketchWidth || 3;
  const strokeStyle = note.sketchStyle || "solid";
  const background = note.sketchBackground || PAPERS[0].color;
  const custom = !COLORS.includes(color);
  const canUndo = undo.length > 0;
  return (
    <View testID="sketch-section" style={s.section}>
      <View style={s.heading}>
        <Text style={[s.title, { color: palette.cream }]}>Sketchpad</Text>
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo sketch stroke"
            disabled={!canUndo}
            onPress={() => {
              setRedo((all) => [...all, note.sketchPaths]);
              onChange({ sketchPaths: undo[undo.length - 1] });
              setUndo((all) => all.slice(0, -1));
            }}
            style={[s.action, { opacity: canUndo ? 1 : 0.35 }]}
          >
            <RotateCcw size={16} color={palette.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Redo sketch stroke"
            disabled={!redo.length}
            onPress={() => {
              setUndo((all) => [...all, note.sketchPaths]);
              onChange({ sketchPaths: redo[redo.length - 1] });
              setRedo((all) => all.slice(0, -1));
            }}
            style={[s.action, { opacity: redo.length ? 1 : 0.35 }]}
          >
            <RotateCw size={16} color={palette.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export sketch PNG"
            disabled={exporting}
            onPress={() => void exportImage()}
            style={s.action}
          >
            <Download size={16} color={palette.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear canvas"
            disabled={!note.sketchPaths.length}
            onPress={() => commit([])}
            style={[s.action, { opacity: note.sketchPaths.length ? 1 : 0.35 }]}
          >
            <Text style={[s.actionText, { color: palette.muted }]}>Clear</Text>
          </Pressable>
        </View>
      </View>
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.hintText, { color: palette.muted }]}
        >
          {message}
        </Text>
      ) : null}
      <View
        style={[
          s.tools,
          { backgroundColor: palette.panel, borderColor: palette.line },
        ]}
      >
        <View style={[s.segments, { backgroundColor: palette.bg }]}>
          {(["pen", "eraser"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={
                value === "pen" ? "Draw with pen" : "Erase strokes"
              }
              accessibilityState={{ selected: tool === value }}
              onPress={() => setTool(value)}
              style={[
                s.segment,
                { flexDirection: "row", gap: 8 },
                tool === value && { backgroundColor: palette.panel2 },
              ]}
            >
              {value === "pen" ? (
                <Pencil
                  size={16}
                  color={tool === value ? palette.accent : palette.muted}
                />
              ) : (
                <Eraser
                  size={16}
                  color={tool === value ? palette.accent : palette.muted}
                />
              )}
              <Text
                style={[
                  s.customText,
                  { color: tool === value ? palette.accent : palette.muted },
                ]}
              >
                {value === "pen" ? "Pen" : "Eraser"}
              </Text>
            </Pressable>
          ))}
        </View>
        {tool === "eraser" ? (
          <Text style={[s.hintText, { color: palette.muted }]}>
            Touch a stroke to erase it. Undo brings it back.
          </Text>
        ) : null}
        <View style={s.colorHeading}>
          <Text style={[s.label, { color: palette.muted }]}>Pen color</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open color wheel"
            onPress={() => setPicker(true)}
            style={[
              s.custom,
              {
                borderColor: custom ? color : palette.line,
                backgroundColor: palette.panel2,
              },
            ]}
          >
            <ColorWheelIcon size={17} />
            <Text style={[s.customText, { color: palette.cream }]}>
              {custom ? color : "Color wheel"}
            </Text>
          </Pressable>
        </View>
        <View style={s.swatches}>
          {COLORS.map((swatch) => (
            <Pressable
              key={swatch}
              accessibilityRole="button"
              accessibilityLabel={`Pen color ${swatch}`}
              accessibilityState={{ selected: color === swatch }}
              onPress={() => onChange({ sketchColor: swatch })}
              style={[
                s.swatchHit,
                {
                  borderColor: color === swatch ? palette.cream : "transparent",
                },
              ]}
            >
              <View
                style={[
                  s.swatch,
                  { backgroundColor: swatch, borderColor: palette.line },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <View style={[s.brushRows, { borderColor: palette.line }]}>
          <View style={s.brushGroup}>
            <Text style={[s.label, { color: palette.muted }]}>Stroke</Text>
            <View style={[s.segments, { backgroundColor: palette.bg }]}>
              {(["solid", "dashed", "dotted"] as const).map((style) => (
                <Pressable
                  key={style}
                  accessibilityRole="button"
                  accessibilityLabel={`${style[0].toUpperCase() + style.slice(1)} stroke`}
                  accessibilityState={{ selected: strokeStyle === style }}
                  onPress={() => onChange({ sketchStyle: style })}
                  style={[
                    s.segment,
                    strokeStyle === style && {
                      backgroundColor: palette.panel2,
                    },
                  ]}
                >
                  <Svg width={27} height={18}>
                    <Line
                      x1={3}
                      x2={24}
                      y1={9}
                      y2={9}
                      stroke={
                        strokeStyle === style ? palette.accent : palette.muted
                      }
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeDasharray={
                        style === "dashed"
                          ? "5 4"
                          : style === "dotted"
                            ? "1 5"
                            : undefined
                      }
                    />
                  </Svg>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={s.brushGroup}>
            <Text style={[s.label, { color: palette.muted }]}>Size</Text>
            <View style={[s.segments, { backgroundColor: palette.bg }]}>
              {[2, 4, 7].map((size, i) => {
                const active = size === width || (width === 3 && size === 4);
                return (
                  <Pressable
                    key={size}
                    accessibilityRole="button"
                    accessibilityLabel={`${["Fine", "Medium", "Bold"][i]} pen`}
                    accessibilityState={{ selected: active }}
                    onPress={() => onChange({ sketchWidth: size })}
                    style={[
                      s.segment,
                      active && { backgroundColor: palette.panel2 },
                    ]}
                  >
                    <View
                      style={{
                        width: 21,
                        height: size,
                        borderRadius: 5,
                        backgroundColor: active ? color : palette.muted,
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
        <View style={s.paperRow}>
          <Text style={[s.label, { color: palette.muted }]}>Canvas</Text>
          <View style={s.papers}>
            {PAPERS.map((paper) => (
              <Pressable
                key={paper.color}
                accessibilityRole="button"
                accessibilityLabel={`${paper.label} canvas`}
                accessibilityState={{ selected: background === paper.color }}
                onPress={() => onChange({ sketchBackground: paper.color })}
                style={[
                  s.paperHit,
                  {
                    borderColor:
                      background === paper.color
                        ? palette.accent
                        : "transparent",
                  },
                ]}
              >
                <View
                  style={[
                    s.paperSwatch,
                    { backgroundColor: paper.color, borderColor: palette.line },
                  ]}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <Canvas
        paths={note.sketchPaths}
        onChange={commit}
        color={color}
        width={width}
        strokeStyle={strokeStyle}
        background={background}
        border={palette.line}
        tool={tool}
        savedSize={note.sketchSize}
        svgRef={svgRef}
        onSize={(size) => {
          canvasSize.current = size;
        }}
      />
      {picker ? (
        <ColorPicker
          color={color}
          palette={palette}
          onClose={() => setPicker(false)}
          onSelect={(sketchColor) => {
            onChange({ sketchColor });
            setPicker(false);
          }}
        />
      ) : null}
    </View>
  );
}

function Canvas({
  paths,
  onChange,
  color,
  width,
  strokeStyle,
  background,
  border,
  tool,
  savedSize,
  svgRef,
  onSize,
}: {
  paths: Note["sketchPaths"];
  onChange: (
    paths: Note["sketchPaths"],
    size?: { width: number; height: number },
  ) => void;
  color: string;
  width: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  background: string;
  border: string;
  tool: "pen" | "eraser";
  savedSize?: { width: number; height: number };
  svgRef: React.RefObject<Svg | null>;
  onSize: (size: { width: number; height: number }) => void;
}) {
  const { height } = useWindowDimensions();
  const displayHeight = Math.max(300, Math.min(520, height * 0.43));
  const [displayWidth, setDisplayWidth] = useState(360),
    [current, setCurrent] = useState(""),
    [erasing, setErasing] = useState<Note["sketchPaths"] | null>(null);
  const pathRef = useRef(""),
    eraseRef = useRef<Note["sketchPaths"] | null>(null);
  const size = savedSize || { width: displayWidth, height: displayHeight };
  const latest = useRef({
    paths,
    onChange,
    color,
    width,
    strokeStyle,
    tool,
    size,
    displayWidth,
    displayHeight,
  });
  latest.current = {
    paths,
    onChange,
    color,
    width,
    strokeStyle,
    tool,
    size,
    displayWidth,
    displayHeight,
  };
  const point = (e: {
    nativeEvent: { locationX: number; locationY: number };
  }) => {
    const l = latest.current;
    return {
      x: (e.nativeEvent.locationX / l.displayWidth) * l.size.width,
      y: (e.nativeEvent.locationY / l.displayHeight) * l.size.height,
    };
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const { x, y } = point(e),
            l = latest.current;
          if (l.tool === "eraser") {
            eraseRef.current = eraseAt(
              l.paths,
              x,
              y,
              (12 * l.size.width) / l.displayWidth,
            );
            setErasing(eraseRef.current);
          } else {
            pathRef.current = `M ${x} ${y} L ${x + 0.01} ${y}`;
            setCurrent(pathRef.current);
          }
        },
        onPanResponderMove: (e) => {
          const { x, y } = point(e),
            l = latest.current;
          if (l.tool === "eraser") {
            eraseRef.current = eraseAt(
              eraseRef.current || l.paths,
              x,
              y,
              (12 * l.size.width) / l.displayWidth,
            );
            setErasing(eraseRef.current);
          } else {
            pathRef.current += ` L ${x} ${y}`;
            setCurrent(pathRef.current);
          }
        },
        onPanResponderRelease: () => {
          const l = latest.current;
          if (l.tool === "eraser") {
            if (eraseRef.current && eraseRef.current.length !== l.paths.length)
              l.onChange(eraseRef.current, l.size);
          } else if (pathRef.current)
            l.onChange(
              [
                ...l.paths,
                {
                  path: pathRef.current,
                  color: l.color,
                  width: l.width,
                  style: l.strokeStyle,
                },
              ],
              l.size,
            );
          pathRef.current = "";
          eraseRef.current = null;
          setCurrent("");
          setErasing(null);
        },
        onPanResponderTerminate: () => {
          pathRef.current = "";
          eraseRef.current = null;
          setCurrent("");
          setErasing(null);
        },
      }),
    [],
  );
  const strokes: Array<string | SketchStroke> =
    erasing ||
    (current
      ? [...paths, { path: current, color, width, style: strokeStyle }]
      : paths);
  const hint = ["#F5EBDD", "#FFFFFF", "#E7EBDD"].includes(background)
    ? "#8D8273"
    : "#9A8774";
  return (
    <View
      accessibilityLabel="Drawing canvas"
      onLayout={(e) => {
        setDisplayWidth(e.nativeEvent.layout.width);
        onSize({ width: e.nativeEvent.layout.width, height: displayHeight });
      }}
      style={[
        s.canvas,
        {
          height: displayHeight,
          backgroundColor: background,
          borderColor: border,
        },
      ]}
      {...responder.panHandlers}
    >
      <Svg
        ref={svgRef}
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Rect width={size.width} height={size.height} fill={background} />
        {strokes.map((stroke, i) => {
          const item =
            typeof stroke === "string"
              ? { path: stroke, color: COLORS[0], width: 3, style: "solid" }
              : stroke;
          return (
            <Path
              key={i}
              d={item.path}
              stroke={item.color}
              strokeWidth={item.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={
                item.style === "dashed"
                  ? "8 6"
                  : item.style === "dotted"
                    ? "1 6"
                    : undefined
              }
            />
          );
        })}
      </Svg>
      {!paths.length && !current ? (
        <View pointerEvents="none" style={s.canvasHint}>
          <Pencil size={23} color={hint} strokeWidth={1.5} />
          <Text style={[s.hintTitle, { color: hint }]}>Make a little mark</Text>
          <Text style={[s.hintText, { color: hint }]}>
            Draw with your finger or cursor
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: layout.contentGap },
  heading: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 6 },
  action: {
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 12, fontWeight: "600" },
  tools: {
    borderWidth: 0,
    borderRadius: 18,
    padding: layout.cardInset,
    gap: 12,
  },
  colorHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { fontSize: 12, fontWeight: "600" },
  custom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 9,
    borderWidth: 0,
    borderRadius: 10,
  },
  customText: { fontSize: 11, fontWeight: "600" },
  swatches: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  swatchHit: {
    width: 30,
    height: 34,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: { width: 23, height: 23, borderRadius: 9, borderWidth: 0 },
  brushRows: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 0,
    paddingTop: 12,
  },
  brushGroup: { flex: 1, gap: 8 },
  segments: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  segment: {
    flex: 1,
    minWidth: 0,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  paperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  papers: { flexDirection: "row", gap: 5 },
  paperHit: {
    width: 32,
    height: 32,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  paperSwatch: { width: 23, height: 23, borderRadius: 7, borderWidth: 0 },
  canvas: { borderRadius: 18, borderWidth: 0, overflow: "hidden" },
  canvasHint: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  hintTitle: { fontSize: 15, fontWeight: "600" },
  hintText: { fontSize: 12 },
});
