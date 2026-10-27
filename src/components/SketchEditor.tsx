import React, { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";
import {
  ArrowLeft,
  Check,
  Pencil,
  RotateCcw,
  RotateCw,
  Download,
  Eraser,
  Palette,
  Ellipsis,
  Expand,
  ClipboardPaste,
} from "lucide-react-native";
import { ColorPicker, ColorWheelIcon } from "./ColorPicker";
import { SketchCanvas, SketchPreview } from "./SketchCanvas";
import { BrushSlider } from "./BrushSlider";
import { Action, Sheet, sheetStyles } from "./Sheet";
import type { EditorPalette } from "./PaperEditor";
import type { Note } from "../types";
import { sketchSvg } from "../sketch";
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
  onPasteIntoNote,
}: {
  note: Note;
  onChange: (patch: Partial<Note>) => void;
  palette: EditorPalette;
  onPasteIntoNote: () => void;
}) {
  const [workspace, setWorkspace] = useState(!note.sketchPaths.length);
  const [picker, setPicker] = useState(false),
    [more, setMore] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [brushWidth, setBrushWidth] = useState(
    Math.max(1, Math.min(40, note.sketchWidth || 3)),
  );
  const [undo, setUndo] = useState<Note["sketchPaths"][]>([]),
    [redo, setRedo] = useState<Note["sketchPaths"][]>([]);
  const [exporting, setExporting] = useState(false),
    [message, setMessage] = useState("");
  const latest = useRef(note);
  latest.current = note;
  const svgRef = useRef<Svg>(null),
    canvasSize = useRef({ width: 360, height: 400 });
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const landscape = screenWidth > screenHeight + 120;
  const color = note.sketchColor || COLORS[0],
    background = note.sketchBackground || PAPERS[0].color;
  const commit = (
    sketchPaths: Note["sketchPaths"],
    size?: NonNullable<Note["sketchSize"]>,
  ) => {
    setUndo((all) => [...all.slice(-49), latest.current.sketchPaths]);
    setRedo([]);
    onChange({ sketchPaths, ...(size ? { sketchSize: size } : {}) });
  };
  const done = () => {
    onChange({ sketchWidth: brushWidth });
    setWorkspace(false);
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
  const swatch = (value: string) => (
    <Pressable
      key={value}
      accessibilityRole="button"
      accessibilityLabel={`Pen color ${value}`}
      accessibilityState={{ selected: color === value }}
      onPress={() => onChange({ sketchColor: value })}
      style={[
        s.swatchHit,
        { borderColor: color === value ? palette.cream : "transparent" },
      ]}
    >
      <View style={[s.swatch, { backgroundColor: value }]} />
    </Pressable>
  );
  const tools = [
    {
      label: "Pen",
      name: "Draw with pen",
      Icon: Pencil,
      selected: tool === "pen",
      action: () => setTool("pen"),
      disabled: false,
    },
    {
      label: "Eraser",
      name: "Erase strokes",
      Icon: Eraser,
      selected: tool === "eraser",
      action: () => setTool("eraser"),
      disabled: false,
    },
    {
      label: "Color",
      name: "Open color wheel",
      Icon: Palette,
      action: () => setPicker(true),
      disabled: false,
    },
    {
      label: "Undo",
      name: "Undo sketch stroke",
      Icon: RotateCcw,
      disabled: !undo.length,
      action: () => {
        setRedo((all) => [...all, note.sketchPaths]);
        onChange({ sketchPaths: undo[undo.length - 1] });
        setUndo((all) => all.slice(0, -1));
      },
    },
    {
      label: "Redo",
      name: "Redo sketch stroke",
      Icon: RotateCw,
      disabled: !redo.length,
      action: () => {
        setUndo((all) => [...all, note.sketchPaths]);
        onChange({ sketchPaths: redo[redo.length - 1] });
        setRedo((all) => all.slice(0, -1));
      },
    },
    {
      label: "More",
      name: "More sketch tools",
      Icon: Ellipsis,
      action: () => setMore(true),
      disabled: false,
    },
  ];
  return (
    <View testID="sketch-section" style={{ gap: 12 }}>
      <View style={s.previewHeading}>
        <Text style={[s.sectionTitle, { color: palette.cream }]}>
          Your sketch
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open sketchpad"
          onPress={() => setWorkspace(true)}
          style={s.open}
        >
          <Pencil size={16} color={palette.accent} />
          <Text
            style={{ color: palette.accent, fontWeight: "600", fontSize: 13 }}
          >
            Draw
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit drawing in full screen"
        onPress={() => setWorkspace(true)}
        style={[s.preview, { backgroundColor: background }]}
      >
        <SketchPreview
          paths={note.sketchPaths}
          size={note.sketchSize}
          background={background}
        />
        <View style={[s.expand, { backgroundColor: palette.panel2 }]}>
          <Expand size={18} color={palette.cream} />
        </View>
        {!note.sketchPaths.length ? (
          <Text style={[s.emptyPreview, { color: palette.muted }]}>
            Tap to start drawing
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Paste drawing into a note"
        disabled={!note.sketchPaths.length}
        onPress={onPasteIntoNote}
        style={[
          s.paste,
          {
            backgroundColor: palette.panel2,
            opacity: note.sketchPaths.length ? 1 : 0.4,
          },
        ]}
      >
        <ClipboardPaste size={18} color={palette.accent} />
        <Text style={{ color: palette.cream, fontWeight: "600", fontSize: 13 }}>
          Paste into a note
        </Text>
      </Pressable>
      <Modal visible={workspace} animationType="slide" onRequestClose={done}>
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
          <View style={s.workspace}>
            <View style={s.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back from sketchpad"
                onPress={done}
                style={[s.back, { backgroundColor: palette.panel }]}
              >
                <ArrowLeft size={22} color={palette.cream} />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={[s.title, { color: palette.cream }]}>
                  Sketchpad
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: palette.muted, fontSize: 13 }}
                >
                  {note.title || "Untitled sketch"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done drawing"
                onPress={done}
                style={[s.done, { backgroundColor: palette.accent }]}
              >
                <Check size={17} color={palette.bg} />
                <Text
                  style={{ color: palette.bg, fontWeight: "700", fontSize: 15 }}
                >
                  Done
                </Text>
              </Pressable>
            </View>
            <View style={[s.body, landscape && { flexDirection: "row" }]}>
              <SketchCanvas
                note={note}
                tool={tool}
                brushWidth={brushWidth}
                onChange={commit}
                svgRef={svgRef}
                onSize={(size) => {
                  canvasSize.current = size;
                }}
              />
              <View
                style={[
                  s.controls,
                  landscape && { width: 250, justifyContent: "center" },
                ]}
              >
                <View
                  testID="brush-controls"
                  style={[s.brushPanel, { backgroundColor: palette.panel }]}
                >
                  <View style={s.colors}>
                    {COLORS.slice(0, 6).map(swatch)}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Choose custom pen color"
                      onPress={() => setPicker(true)}
                      style={s.swatchHit}
                    >
                      <ColorWheelIcon size={28} />
                    </Pressable>
                  </View>
                  <View style={s.sliderLabel}>
                    <Text style={[s.label, { color: palette.cream }]}>
                      Brush size
                    </Text>
                    <Text
                      accessibilityLiveRegion="polite"
                      style={{
                        color: palette.cream,
                        fontSize: 13,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {brushWidth} px
                    </Text>
                  </View>
                  <View style={s.sliderRow}>
                    <View style={{ flex: 1 }}>
                      <BrushSlider
                        value={brushWidth}
                        onChange={setBrushWidth}
                        onCommit={(sketchWidth) => onChange({ sketchWidth })}
                        palette={palette}
                      />
                      <View style={s.endpoints}>
                        <Text style={{ color: palette.muted, fontSize: 10 }}>
                          1 px
                        </Text>
                        <Text style={{ color: palette.muted, fontSize: 10 }}>
                          40 px
                        </Text>
                      </View>
                    </View>
                    <View
                      accessibilityLabel={`Brush preview ${brushWidth} pixels`}
                      style={s.brushPreview}
                    >
                      <View
                        style={{
                          width: brushWidth,
                          height: brushWidth,
                          borderRadius: 20,
                          backgroundColor: color,
                        }}
                      />
                    </View>
                  </View>
                </View>
                <View
                  testID="sketch-toolbar"
                  style={[s.toolbar, { backgroundColor: palette.panel }]}
                >
                  {tools.map(
                    ({ label, name, Icon, action, selected, disabled }) => (
                      <Pressable
                        key={label}
                        accessibilityRole="button"
                        accessibilityLabel={name}
                        accessibilityState={{ selected: !!selected, disabled }}
                        disabled={disabled}
                        onPress={action}
                        style={[
                          s.tool,
                          {
                            backgroundColor: selected
                              ? palette.panel2
                              : "transparent",
                            opacity: disabled ? 0.35 : 1,
                          },
                        ]}
                      >
                        <Icon
                          size={22}
                          strokeWidth={1.7}
                          color={selected ? palette.accent : palette.cream}
                        />
                        <Text
                          style={{
                            color: selected ? palette.accent : palette.muted,
                            fontSize: 10,
                            fontWeight: "600",
                          }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
            </View>
          </View>
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
          {more ? (
            <Sheet
              title="Sketch tools"
              palette={palette}
              onClose={() => setMore(false)}
            >
              <Text style={[sheetStyles.label, { color: palette.cream }]}>
                Stroke style
              </Text>
              <View style={sheetStyles.row}>
                {(["solid", "dashed", "dotted"] as const).map((style) => (
                  <Pressable
                    key={style}
                    accessibilityRole="button"
                    accessibilityLabel={`${style[0].toUpperCase() + style.slice(1)} stroke`}
                    accessibilityState={{
                      selected: (note.sketchStyle || "solid") === style,
                    }}
                    onPress={() => onChange({ sketchStyle: style })}
                    style={[
                      s.styleButton,
                      {
                        backgroundColor:
                          (note.sketchStyle || "solid") === style
                            ? palette.panel2
                            : palette.bg,
                      },
                    ]}
                  >
                    <Svg width={38} height={16}>
                      <Line
                        x1={3}
                        x2={35}
                        y1={8}
                        y2={8}
                        stroke={color}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={
                          style === "dashed"
                            ? "6 5"
                            : style === "dotted"
                              ? "1 5"
                              : undefined
                        }
                      />
                    </Svg>
                    <Text style={{ color: palette.cream, fontSize: 12 }}>
                      {style[0].toUpperCase() + style.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[sheetStyles.label, { color: palette.cream }]}>
                More colors
              </Text>
              <View style={sheetStyles.row}>{COLORS.map(swatch)}</View>
              <Text style={[sheetStyles.label, { color: palette.cream }]}>
                Canvas background
              </Text>
              <View style={sheetStyles.row}>
                {PAPERS.map((p) => (
                  <Pressable
                    key={p.color}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.label} canvas`}
                    accessibilityState={{ selected: background === p.color }}
                    onPress={() => onChange({ sketchBackground: p.color })}
                    style={[s.paper, { backgroundColor: palette.bg }]}
                  >
                    <View
                      style={{
                        width: 23,
                        height: 23,
                        borderRadius: 8,
                        backgroundColor: p.color,
                      }}
                    />
                    <Text
                      style={{
                        color:
                          background === p.color
                            ? palette.accent
                            : palette.cream,
                        fontSize: 12,
                      }}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Action
                label="Paste into a note"
                disabled={!note.sketchPaths.length}
                palette={palette}
                onPress={() => {
                  setMore(false);
                  done();
                  onPasteIntoNote();
                }}
              />
              <Action
                label={exporting ? "Preparing PNG…" : "Export sketch PNG"}
                disabled={exporting}
                secondary
                palette={palette}
                onPress={() => void exportImage()}
              />
              <Action
                label="Clear canvas"
                disabled={!note.sketchPaths.length}
                secondary
                palette={palette}
                onPress={() => {
                  commit([]);
                  setMore(false);
                }}
              />
              {message ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: palette.muted, fontSize: 12 }}
                >
                  {message}
                </Text>
              ) : null}
            </Sheet>
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  workspace: {
    flex: 1,
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
  },
  back: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "700" },
  done: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  body: { flex: 1, gap: 12 },
  controls: { gap: 10 },
  brushPanel: {
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 7,
  },
  colors: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  swatchHit: {
    width: 34,
    height: 40,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  sliderLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
  },
  label: { fontSize: 14, fontWeight: "600" },
  sliderRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  endpoints: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 1,
  },
  brushPreview: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbar: { flexDirection: "row", padding: 6, borderRadius: 21, gap: 2 },
  tool: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    borderRadius: 16,
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  previewHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  open: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 8,
    minHeight: 40,
  },
  preview: { height: 290, borderRadius: 22, overflow: "hidden" },
  expand: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPreview: {
    position: "absolute",
    top: "48%",
    alignSelf: "center",
    fontSize: 14,
  },
  paste: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 46,
    borderRadius: 14,
  },
  styleButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  paper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    minHeight: 40,
    borderRadius: 12,
  },
});
