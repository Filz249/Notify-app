import React from "react";
import { View } from "react-native";
import type { BrushSliderProps } from "./BrushSlider";
import { BrushTrack } from "./BrushTrack";
// A real range input provides keyboard, touch and screen-reader support on web.
export function BrushSlider({
  value,
  onChange,
  onCommit,
  palette,
}: BrushSliderProps) {
  return (
    <View style={{ height: 44, marginHorizontal: 12 }}>
      <BrushTrack value={value} palette={palette} />
      <input
        type="range"
        aria-label="Brush thickness"
        min={1}
        max={40}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        onPointerUp={(e) => onCommit(Number(e.currentTarget.value))}
        onKeyUp={(e) => onCommit(Number(e.currentTarget.value))}
        onBlur={(e) => onCommit(Number(e.currentTarget.value))}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: 44,
          margin: 0,
          opacity: 0,
          cursor: "pointer",
        }}
      />
    </View>
  );
}
