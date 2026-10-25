import React, { useId, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import type { Note } from "../types";
import { layout } from "../layout";

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
}: {
  value: string;
  onChange: (value: string) => void;
  paperStyle: Note["paperStyle"];
  onStyleChange: (style: NonNullable<Note["paperStyle"]>) => void;
  palette: EditorPalette;
  minHeight: number;
  placeholder: string;
}) {
  const patternId = useId().replace(/:/g, "");
  const [contentHeight, setContentHeight] = useState(0);
  const [focused, setFocused] = useState(false);
  const [clearedText, setClearedText] = useState<string | null>(null);

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
      </View>
      <View style={styles.paperBody}>
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onContentSizeChange={(event) =>
            setContentHeight(event.nativeEvent.contentSize.height)
          }
          style={[
            styles.input,
            {
              color: palette.cream,
              minHeight,
              height: Math.max(minHeight, contentHeight),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
