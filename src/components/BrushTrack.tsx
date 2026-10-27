import React from "react";
import { StyleSheet, View } from "react-native";
import type { EditorPalette } from "./PaperEditor";
export function BrushTrack({
  value,
  palette,
}: {
  value: number;
  palette: EditorPalette;
}) {
  const percent = ((value - 1) / 39) * 100;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[s.track, { backgroundColor: palette.line }]}>
        <View
          style={{
            height: "100%",
            width: `${percent}%`,
            backgroundColor: palette.accent,
            borderRadius: 8,
          }}
        />
      </View>
      <View
        style={[
          s.thumb,
          {
            left: `${percent}%`,
            backgroundColor: palette.accent,
            borderColor: palette.cream,
          },
        ]}
      />
    </View>
  );
}
const s = StyleSheet.create({
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 18,
    height: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumb: {
    position: "absolute",
    top: 10,
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
    borderWidth: 3,
  },
});
