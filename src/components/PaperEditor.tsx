import React, { useEffect, useId, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import type { DrawingOverlay, Note } from "../types";
import { layout } from "../layout";
import { Minus, Plus, Trash2, Check } from "lucide-react-native";
import { DrawingOverlays } from "./DrawingOverlays";
import { drawingHeight, placeDrawing } from "../drawings";

export type EditorPalette = {
  bg: string;
  panel: string;
  panel2: string;
  line: string;
  cream: string;
  muted: string;
  accent: string;
};

export function PaperEditor({
  value,
  onChange,
  paperStyle = "plain",
  onStyleChange,
  palette,
  minHeight,
  placeholder,
  overlays = [],
  onOverlaysChange,
  onDrawingDragChange,
  voiceInput,
  voiceStatus,
}: {
  value: string;
  onChange: (value: string) => void;
  paperStyle: Note["paperStyle"];
  onStyleChange: (style: NonNullable<Note["paperStyle"]>) => void;
  palette: EditorPalette;
  minHeight: number;
  placeholder: string;
  overlays?: DrawingOverlay[];
  onOverlaysChange: (overlays: DrawingOverlay[]) => void;
  onDrawingDragChange: (dragging: boolean) => void;
  voiceInput?: React.ReactNode;
  voiceStatus?: React.ReactNode;
}) {
  const patternId = useId().replace(/:/g, "");
  const [contentHeight, setContentHeight] = useState(0);
  const [focused, setFocused] = useState(false);
  const [clearedText, setClearedText] = useState<string | null>(null);
  const [paperWidth, setPaperWidth] = useState(340);
  const [selected, setSelected] = useState<string | null>(null);
  const [removed, setRemoved] = useState<DrawingOverlay | null>(null);
  useEffect(() => {
    if (!removed) return;
    const timeout = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(timeout);
  }, [removed]);
  const selectedDrawing = overlays.find((item) => item.id === selected);
  const paperHeight = Math.max(
    minHeight,
    contentHeight,
    ...overlays.map((item) => item.y + drawingHeight(item, paperWidth) + 20),
  );
  const updateOverlay = (id: string, change: Partial<DrawingOverlay>) =>
    onOverlaysChange(
      overlays.map((item) =>
        item.id === id ? placeDrawing(item, change) : item,
      ),
    );

  return (
    <View
      testID="paper-editor"
      style={[
        styles.paper,
        { backgroundColor: palette.panel, borderColor: palette.line },
      ]}
    >
      <View style={[styles.toolbar, { borderBottomColor: palette.line }]}>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Paper style"
          style={styles.options}
        >
          {(["plain", "lines", "dots"] as const).map((style) => {
            const active = paperStyle === style;
            const color = active ? palette.accent : palette.muted;
            return (
              <Pressable
                key={style}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${style === "plain" ? "Plain" : style === "lines" ? "Lined" : "Dotted"} paper`}
                onPress={() => onStyleChange(style)}
                style={[
                  styles.option,
                  active && { backgroundColor: palette.panel2 },
                ]}
              >
                <Svg width={16} height={16} viewBox="0 0 16 16">
                  {style === "plain" ? (
                    <Rect
                      x={2}
                      y={2}
                      width={12}
                      height={12}
                      rx={3}
                      stroke={color}
                      fill="none"
                    />
                  ) : style === "lines" ? (
                    [4, 8, 12].map((y) => (
                      <Line
                        key={y}
                        x1={2}
                        x2={14}
                        y1={y}
                        y2={y}
                        stroke={color}
                        strokeWidth={1.5}
                      />
                    ))
                  ) : (
                    [4, 8, 12].flatMap((y) =>
                      [4, 10].map((x) => (
                        <Circle
                          key={`${x}-${y}`}
                          cx={x}
                          cy={y}
                          r={1}
                          fill={color}
                        />
                      )),
                    )
                  )}
                </Svg>
                <Text style={[styles.optionText, { color }]}>
                  {style === "plain"
                    ? "Plain"
                    : style === "lines"
                      ? "Lines"
                      : "Dots"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.toolbarActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              clearedText !== null && !value
                ? "Undo clear text"
                : "Clear note text"
            }
            disabled={!value && clearedText === null}
            onPress={() => {
              if (clearedText !== null && !value) {
                onChange(clearedText);
                setClearedText(null);
              } else {
                setClearedText(value);
                onChange("");
                setContentHeight(0);
              }
            }}
            style={styles.clear}
          >
            <Text
              style={[
                styles.clearText,
                {
                  color: palette.muted,
                  opacity: value || clearedText !== null ? 1 : 0.45,
                },
              ]}
            >
              {clearedText !== null && !value ? "Undo" : "Clear"}
            </Text>
          </Pressable>
          {voiceInput}
        </View>
      </View>
      {voiceStatus}
      <View
        style={styles.paperBody}
        onLayout={(event) => setPaperWidth(event.nativeEvent.layout.width)}
      >
        {paperStyle !== "plain" ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width="100%" height="100%">
              <Defs>
                <Pattern
                  id={patternId}
                  width={paperStyle === "lines" ? "100%" : 20}
                  height={28}
                  y={14}
                  patternUnits="userSpaceOnUse"
                >
                  {paperStyle === "lines" ? (
                    <Line
                      x1={0}
                      x2="100%"
                      y1={27}
                      y2={27}
                      stroke={palette.line}
                      strokeWidth={0.8}
                    />
                  ) : (
                    <Circle
                      cx={10}
                      cy={26}
                      r={1}
                      fill={palette.muted}
                      opacity={0.35}
                    />
                  )}
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
            </Svg>
          </View>
        ) : null}
        <TextInput
          accessibilityLabel="Note text"
          value={value}
          onChangeText={(text) => {
            onChange(text);
            if (text) setClearedText(null);
          }}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          onTouchStart={() => setSelected(null)}
          onFocus={() => {
            setFocused(true);
            setSelected(null);
          }}
          onBlur={() => setFocused(false)}
          onContentSizeChange={(event) =>
            setContentHeight(event.nativeEvent.contentSize.height)
          }
          style={[
            styles.input,
            {
              color: palette.cream,
              minHeight,
              height: paperHeight,
            },
          ]}
        />
        <DrawingOverlays
          overlays={overlays}
          width={paperWidth}
          height={paperHeight}
          selected={selected}
          onSelect={setSelected}
          onChange={updateOverlay}
          onDraggingChange={onDrawingDragChange}
          accent={palette.accent}
        />
        {selectedDrawing ? (
          <View
            testID="drawing-context-tools"
            style={[
              styles.drawingContext,
              {
                backgroundColor: palette.panel2,
                top: Math.max(4, selectedDrawing.y - 48),
                left: Math.max(
                  8,
                  Math.min(
                    paperWidth - 192,
                    selectedDrawing.x * paperWidth +
                      (selectedDrawing.width * paperWidth) / 2 -
                      92,
                  ),
                ),
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Make drawing smaller"
              onPress={() =>
                updateOverlay(selectedDrawing.id, {
                  width: selectedDrawing.width - 0.08,
                })
              }
              style={styles.drawingControl}
            >
              <Minus size={18} color={palette.cream} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Make drawing larger"
              onPress={() =>
                updateOverlay(selectedDrawing.id, {
                  width: selectedDrawing.width + 0.08,
                })
              }
              style={styles.drawingControl}
            >
              <Plus size={18} color={palette.cream} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove selected drawing"
              onPress={() => {
                setRemoved(selectedDrawing);
                onOverlaysChange(
                  overlays.filter((item) => item.id !== selectedDrawing.id),
                );
                setSelected(null);
              }}
              style={styles.drawingControl}
            >
              <Trash2 size={18} color={palette.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish moving drawing"
              onPress={() => setSelected(null)}
              style={styles.drawingControl}
            >
              <Check size={19} color={palette.accent} />
            </Pressable>
          </View>
        ) : null}
        {removed ? (
          <View
            style={[styles.removedToast, { backgroundColor: palette.panel2 }]}
          >
            <Text style={{ color: palette.muted, fontSize: 12 }}>
              Drawing removed
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo remove drawing"
              onPress={() => {
                onOverlaysChange([...overlays, removed]);
                setRemoved(null);
              }}
              style={styles.undoRemove}
            >
              <Text
                style={{
                  color: palette.accent,
                  fontWeight: "600",
                  fontSize: 12,
                }}
              >
                Undo
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawingContext: {
    position: "absolute",
    zIndex: 5,
    width: 184,
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    paddingHorizontal: 4,
  },
  drawingControl: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  removedToast: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    paddingLeft: 14,
    borderRadius: 12,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  undoRemove: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: layout.controlGap,
    padding: 12,
    borderBottomWidth: 0,
    flexWrap: "wrap",
  },
  options: { flexDirection: "row", gap: 4 },
  toolbarActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  option: {
    minHeight: 36,
    paddingHorizontal: 8,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  optionText: { fontSize: 12, fontWeight: "600" },
  clear: { minHeight: 36, paddingHorizontal: 8, justifyContent: "center" },
  clearText: { fontSize: 12, fontWeight: "600" },
  paper: { borderWidth: 0, borderRadius: 16, overflow: "hidden" },
  paperBody: { position: "relative" },
  input: {
    fontSize: 16,
    lineHeight: 28,
    paddingHorizontal: layout.cardInset,
    paddingTop: 14,
    paddingBottom: 18,
    outlineWidth: 0,
    outlineStyle: "solid",
    backgroundColor: "transparent",
  },
});
