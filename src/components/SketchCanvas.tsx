import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { Pencil } from "lucide-react-native";
import type { Note, SketchStroke } from "../types";
import { createStrokeEraser } from "../sketch";
import { sketchPoint } from "../drawings";

export const StrokePaths = memo(function StrokePaths({
  paths,
}: {
  paths: Note["sketchPaths"];
}) {
  return (
    <G>
      {paths.map((stroke, i) => (
        <StrokePath key={i} stroke={stroke} />
      ))}
    </G>
  );
});
function StrokePath({ stroke }: { stroke: string | SketchStroke }) {
  const item =
    typeof stroke === "string"
      ? { path: stroke, color: "#F2B23D", width: 3, style: "solid" }
      : stroke;
  return (
    <Path
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
}
export function SketchPreview({
  paths,
  size,
  background = "transparent",
}: {
  paths: Note["sketchPaths"];
  size?: Note["sketchSize"];
  background?: string;
}) {
  const canvas = size || { width: 360, height: 400 };
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {background !== "transparent" ? (
        <Rect width={canvas.width} height={canvas.height} fill={background} />
      ) : null}
      <StrokePaths paths={paths} />
    </Svg>
  );
}
export function SketchCanvas({
  note,
  tool,
  brushWidth,
  onChange,
  svgRef,
  onSize,
}: {
  note: Note;
  tool: "pen" | "eraser";
  brushWidth: number;
  onChange: (
    paths: Note["sketchPaths"],
    size: NonNullable<Note["sketchSize"]>,
  ) => void;
  svgRef: React.RefObject<Svg | null>;
  onSize: (size: NonNullable<Note["sketchSize"]>) => void;
}) {
  const [display, setDisplay] = useState({ width: 360, height: 400 });
  const [live, setLive] = useState<SketchStroke | null>(null);
  const [erasing, setErasing] = useState<Note["sketchPaths"] | null>(null);
  const frame = useRef<number | null>(null);
  const gesture = useRef<{
    size: NonNullable<Note["sketchSize"]>;
    stroke: SketchStroke | null;
    last: { x: number; y: number };
    erased: Note["sketchPaths"];
    erase: ReturnType<typeof createStrokeEraser> | null;
  } | null>(null);
  const size = note.sketchSize || display;
  const latest = useRef({ note, tool, brushWidth, onChange, display, size });
  latest.current = { note, tool, brushWidth, onChange, display, size };
  const cancelFrame = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  const paint = () => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const active = gesture.current;
      if (!active) return;
      if (active.stroke) setLive({ ...active.stroke });
      else setErasing(active.erased);
    });
  };
  const finish = () => {
    cancelFrame();
    const active = gesture.current,
      l = latest.current;
    gesture.current = null;
    if (active?.stroke)
      l.onChange([...l.note.sketchPaths, active.stroke], active.size);
    else if (active && active.erased !== l.note.sketchPaths)
      l.onChange(active.erased, active.size);
    setLive(null);
    setErasing(null);
  };
  useEffect(() => () => cancelFrame(), []);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e, state) => {
          const l = latest.current;
          return (
            state.numberActiveTouches <= 1 &&
            sketchPoint(
              e.nativeEvent.locationX,
              e.nativeEvent.locationY,
              l.display,
              l.size,
            ).inside
          );
        },
        onMoveShouldSetPanResponder: () => !!gesture.current,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const l = latest.current;
          const point = sketchPoint(
            e.nativeEvent.locationX,
            e.nativeEvent.locationY,
            l.display,
            l.size,
          );
          const erase =
            l.tool === "eraser" ? createStrokeEraser(l.note.sketchPaths) : null;
          gesture.current = {
            size: { ...l.size },
            last: point,
            erase,
            erased: erase
              ? erase(
                  point.x,
                  point.y,
                  (Math.max(8, l.brushWidth) * l.size.width) / l.display.width,
                )
              : l.note.sketchPaths,
            stroke: erase
              ? null
              : {
                  path: `M ${point.x} ${point.y} L ${point.x + 0.01} ${point.y}`,
                  color: l.note.sketchColor || "#F2B23D",
                  width: l.brushWidth,
                  style: l.note.sketchStyle || "solid",
                },
          };
          paint();
        },
        onPanResponderMove: (e, state) => {
          const active = gesture.current,
            l = latest.current;
          if (!active || state.numberActiveTouches > 1) return;
          const point = sketchPoint(
            e.nativeEvent.locationX,
            e.nativeEvent.locationY,
            l.display,
            active.size,
          );
          const distance = Math.hypot(
            point.x - active.last.x,
            point.y - active.last.y,
          );
          if (distance < (0.7 * active.size.width) / l.display.width) return;
          if (active.erase) {
            // Sample the swept eraser segment so quick swipes do not miss a stroke.
            const radius =
              (Math.max(8, l.brushWidth) * active.size.width) / l.display.width;
            const steps = Math.max(
              1,
              Math.ceil(distance / Math.max(1, radius / 2)),
            );
            for (let i = 1; i <= steps; i++)
              active.erased = active.erase(
                active.last.x + ((point.x - active.last.x) * i) / steps,
                active.last.y + ((point.y - active.last.y) * i) / steps,
                radius,
              );
          } else if (active.stroke)
            active.stroke.path += ` L ${point.x} ${point.y}`;
          active.last = point;
          paint();
        },
        onPanResponderRelease: finish,
        // Android can cancel a gesture on app/background changes. Keep the work made so far.
        onPanResponderTerminate: finish,
      }),
    [],
  );
  const background = note.sketchBackground || "#2B1B12";
  const hint = ["#FFFFFF", "#F5EBDD", "#E7EBDD"].includes(background)
    ? "#8D8273"
    : "#BBA995";
  return (
    <View
      testID="drawing-canvas"
      accessibilityLabel="Drawing canvas"
      {...responder.panHandlers}
      onLayout={(e) => {
        const next = {
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        };
        if (next.width > 0 && next.height > 0) {
          setDisplay(next);
          onSize(next);
        }
      }}
      style={[
        s.canvas,
        { backgroundColor: background },
        Platform.OS === "web" &&
          ({ touchAction: "none", userSelect: "none" } as object),
      ]}
    >
      <Svg
        ref={svgRef}
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={StyleSheet.absoluteFill}
      >
        <Rect width={size.width} height={size.height} fill={background} />
        <StrokePaths paths={erasing || note.sketchPaths} />
        {live ? <StrokePath stroke={live} /> : null}
      </Svg>
      {!note.sketchPaths.length && !live ? (
        <View pointerEvents="none" style={s.hint}>
          <Pencil color={hint} size={25} strokeWidth={1.5} />
          <Text style={{ color: hint, fontSize: 15, fontWeight: "600" }}>
            Make a little mark
          </Text>
          <Text style={{ color: hint, fontSize: 12 }}>
            Your canvas, your ideas
          </Text>
        </View>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  canvas: { flex: 1, minHeight: 100, borderRadius: 22, overflow: "hidden" },
  hint: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});
