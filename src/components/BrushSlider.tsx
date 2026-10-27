import React, { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import type { EditorPalette } from "./PaperEditor";
import { BrushTrack } from "./BrushTrack";

export type BrushSliderProps = {
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  palette: EditorPalette;
};
export function BrushSlider({
  value,
  onChange,
  onCommit,
  palette,
}: BrushSliderProps) {
  const [trackWidth, setTrackWidth] = useState(200);
  const latest = useRef({ value, onChange, onCommit, trackWidth });
  latest.current = { value, onChange, onCommit, trackWidth };
  const gesture = useRef({ start: value, value });
  const update = (next: number) => {
    gesture.current.value = Math.max(1, Math.min(40, Math.round(next)));
    latest.current.onChange(gesture.current.value);
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          update(
            1 + (39 * e.nativeEvent.locationX) / latest.current.trackWidth,
          );
          gesture.current.start = gesture.current.value;
        },
        onPanResponderMove: (_, state) =>
          update(
            gesture.current.start + (39 * state.dx) / latest.current.trackWidth,
          ),
        onPanResponderRelease: () =>
          latest.current.onCommit(gesture.current.value),
        onPanResponderTerminate: () =>
          latest.current.onCommit(gesture.current.value),
      }),
    [],
  );
  return (
    <View
      style={s.hit}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Brush thickness"
      accessibilityValue={{
        min: 1,
        max: 40,
        now: value,
        text: `${value} pixels`,
      }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const next = Math.max(
          1,
          Math.min(
            40,
            value + (e.nativeEvent.actionName === "increment" ? 1 : -1),
          ),
        );
        onChange(next);
        onCommit(next);
      }}
      {...responder.panHandlers}
    >
      <BrushTrack value={value} palette={palette} />
    </View>
  );
}
const s = StyleSheet.create({
  hit: { height: 44, marginHorizontal: 12 },
});
