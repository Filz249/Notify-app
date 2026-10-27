import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";
import type { DrawingOverlay } from "../types";
import { drawingHeight, placeDrawing } from "../drawings";
import { SketchPreview } from "./SketchCanvas";

export function DrawingOverlays({
  overlays,
  width,
  height,
  selected,
  onSelect,
  onChange,
  onDraggingChange,
  accent,
}: {
  overlays: DrawingOverlay[];
  width: number;
  height: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, change: Partial<DrawingOverlay>) => void;
  onDraggingChange: (dragging: boolean) => void;
  accent: string;
}) {
  return (
    <>
      {overlays.map((overlay, index) => (
        <PlacedDrawing
          key={overlay.id}
          overlay={overlay}
          index={index}
          width={width}
          height={height}
          selected={selected === overlay.id}
          onSelect={onSelect}
          onChange={onChange}
          onDraggingChange={onDraggingChange}
          accent={accent}
        />
      ))}
    </>
  );
}
function PlacedDrawing(props: {
  overlay: DrawingOverlay;
  index: number;
  width: number;
  height: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, change: Partial<DrawingOverlay>) => void;
  onDraggingChange: (dragging: boolean) => void;
  accent: string;
}) {
  const { overlay, width, selected, index, accent } = props;
  const offset = useRef(new Animated.ValueXY()).current;
  const latest = useRef(props);
  latest.current = props;
  const start = useRef(overlay),
    pending = useRef(overlay);
  const armed = useRef(false),
    dragging = useRef(false);
  const select = () => latest.current.onSelect(latest.current.overlay.id);
  const hold = () => {
    armed.current = true;
    select();
    latest.current.onDraggingChange(true);
  };
  const releasePress = () => {
    if (dragging.current) return;
    armed.current = false;
    latest.current.onDraggingChange(false);
  };
  useEffect(() => {
    offset.setValue({ x: 0, y: 0 });
  }, [overlay.x, overlay.y, overlay.width, width, offset]);
  const finish = () => {
    const l = latest.current;
    dragging.current = false;
    armed.current = false;
    l.onDraggingChange(false);
    if (pending.current.x !== l.overlay.x || pending.current.y !== l.overlay.y)
      l.onChange(l.overlay.id, { x: pending.current.x, y: pending.current.y });
    offset.setValue({ x: 0, y: 0 });
  };
  useEffect(
    () => () => props.onDraggingChange(false),
    [props.onDraggingChange],
  );
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => latest.current.selected,
        onMoveShouldSetPanResponderCapture: () => {
          if (!armed.current && !latest.current.selected) return false;
          // Set this before Pressable releases its responder, so onPressOut
          // cannot unlock the page in the middle of the handoff to dragging.
          dragging.current = true;
          return true;
        },
        onStartShouldSetPanResponder: () => latest.current.selected,
        onMoveShouldSetPanResponder: () =>
          armed.current || latest.current.selected,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const l = latest.current;
          dragging.current = true;
          l.onDraggingChange(true);
          l.onSelect(l.overlay.id);
          start.current = l.overlay;
          pending.current = l.overlay;
        },
        onPanResponderMove: (_, state) => {
          const l = latest.current;
          const next = placeDrawing(start.current, {
            x: start.current.x + state.dx / l.width,
            y: Math.min(
              l.height - drawingHeight(start.current, l.width),
              start.current.y + state.dy,
            ),
          });
          pending.current = next;
          offset.setValue({
            x: (next.x - start.current.x) * l.width,
            y: next.y - start.current.y,
          });
        },
        onPanResponderRelease: finish,
        onPanResponderTerminate: finish,
      }),
    [],
  );
  return (
    <Animated.View
      testID={`drawing-overlay-${index}`}
      {...responder.panHandlers}
      style={[
        s.placed,
        {
          left: overlay.x * width,
          top: overlay.y,
          width: overlay.width * width,
          height: drawingHeight(overlay, width),
          borderColor: selected ? accent : "transparent",
          transform: offset.getTranslateTransform(),
        },
        Platform.OS === "web" &&
          selected &&
          ({
            touchAction: "none",
            userSelect: "none",
            cursor: "move",
          } as object),
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Drawing ${index + 1}: ${overlay.name}`}
        accessibilityHint="Touch and hold to move or resize. Swipe to scroll."
        accessibilityState={{ selected }}
        delayLongPress={400}
        onLongPress={hold}
        onPressOut={releasePress}
        accessibilityActions={[
          { name: "activate", label: "Move or resize drawing" },
        ]}
        onAccessibilityAction={select}
        {...(Platform.OS === "web"
          ? {
              onKeyDown: (event: {
                key: string;
                preventDefault: () => void;
              }) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  select();
                }
              },
            }
          : {})}
        style={{ flex: 1 }}
      >
        <SketchPreview paths={overlay.paths} size={overlay.size} />
      </Pressable>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  placed: {
    position: "absolute",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 6,
  },
});
