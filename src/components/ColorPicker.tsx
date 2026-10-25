import React, { useId, useMemo, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { Check, X } from "lucide-react-native";
import { clamp, hexToHsv, hsvToHex, wheelColor, type HSV } from "../color";
import type { EditorPalette } from "./PaperEditor";
import { layout } from "../layout";

const wedges = Array.from({ length: 120 }, (_, i) => {
  const a = (i * 3 * Math.PI) / 180,
    b = ((i * 3 + 3.5) * Math.PI) / 180;
  return {
    color: hsvToHex({ h: i * 3, s: 1, v: 1 }),
    path: `M 100 100 L ${100 + 100 * Math.cos(a)} ${100 + 100 * Math.sin(a)} A 100 100 0 0 1 ${100 + 100 * Math.cos(b)} ${100 + 100 * Math.sin(b)} Z`,
  };
});

export function ColorWheelIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {wedges.map((w, i) => (
        <Path key={i} d={w.path} fill={w.color} />
      ))}
      <Circle cx={100} cy={100} r={40} fill="#F5EBDD" />
    </Svg>
  );
}

export function ColorPicker({
  color,
  palette,
  onClose,
  onSelect,
}: {
  color: string;
  palette: EditorPalette;
  onClose: () => void;
  onSelect: (color: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(240, width - 96);
  const id = useId().replace(/:/g, "");
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [hex, setHex] = useState(color.toUpperCase());
  const latest = useRef(hsv);
  latest.current = hsv;
  const selected = hsvToHex(hsv);
  const valid = /^#[\da-f]{6}$/i.test(hex);
  const update = (next: HSV) => {
    latest.current = next;
    setHsv(next);
    setHex(hsvToHex(next));
  };
  const wheel = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) =>
          update(
            wheelColor(
              e.nativeEvent.locationX,
              e.nativeEvent.locationY,
              size,
              latest.current.v,
            ),
          ),
        onPanResponderMove: (e) =>
          update(
            wheelColor(
              e.nativeEvent.locationX,
              e.nativeEvent.locationY,
              size,
              latest.current.v,
            ),
          ),
      }),
    [size],
  );
  const brightness = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) =>
          update({
            ...latest.current,
            v: clamp((e.nativeEvent.locationX - 10) / (size - 20)),
          }),
        onPanResponderMove: (e) =>
          update({
            ...latest.current,
            v: clamp((e.nativeEvent.locationX - 10) / (size - 20)),
          }),
      }),
    [size],
  );
  const angle = (hsv.h * Math.PI) / 180;
  const adjustHue = (delta: number) =>
    update({ ...latest.current, h: latest.current.h + delta });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.shade}>
        <View
          style={[
            s.sheet,
            {
              backgroundColor: palette.panel,
              borderColor: palette.line,
              maxHeight: height - 40,
            },
          ]}
        >
          <View style={s.heading}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: palette.cream }]}>
                Find your color
              </Text>
              <Text style={[s.caption, { color: palette.muted }]}>
                A shade for every idea.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close color picker"
              onPress={onClose}
              style={s.close}
            >
              <X size={21} color={palette.muted} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            <View
              accessibilityRole="adjustable"
              accessibilityLabel="Color wheel"
              accessibilityValue={{ text: selected }}
              accessibilityActions={[
                { name: "increment" },
                { name: "decrement" },
              ]}
              onAccessibilityAction={(e) =>
                adjustHue(e.nativeEvent.actionName === "increment" ? 15 : -15)
              }
              style={{ width: size, height: size }}
              {...wheel.panHandlers}
            >
              <Svg
                pointerEvents="none"
                width={size}
                height={size}
                viewBox="0 0 200 200"
              >
                <Defs>
                  <RadialGradient id={`${id}white`} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="white" stopOpacity={1} />
                    <Stop offset="1" stopColor="white" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                {wedges.map((w, i) => (
                  <Path key={i} d={w.path} fill={w.color} />
                ))}
                <Circle cx={100} cy={100} r={100} fill={`url(#${id}white)`} />
                <Circle
                  cx={100}
                  cy={100}
                  r={100}
                  fill="black"
                  opacity={1 - hsv.v}
                />
                <Circle
                  cx={100 + Math.cos(angle) * hsv.s * 94}
                  cy={100 + Math.sin(angle) * hsv.s * 94}
                  r={6}
                  fill={selected}
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                />
              </Svg>
            </View>
            <View style={{ width: size }}>
              <View style={s.brightnessLabel}>
                <Text style={[s.label, { color: palette.muted }]}>
                  Brightness
                </Text>
                <Text style={[s.label, { color: palette.muted }]}>
                  {Math.round(hsv.v * 100)}%
                </Text>
              </View>
              <View
                accessibilityRole="adjustable"
                accessibilityLabel="Color brightness"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(hsv.v * 100),
                }}
                accessibilityActions={[
                  { name: "increment" },
                  { name: "decrement" },
                ]}
                onAccessibilityAction={(e) =>
                  update({
                    ...latest.current,
                    v: clamp(
                      latest.current.v +
                        (e.nativeEvent.actionName === "increment"
                          ? 0.05
                          : -0.05),
                    ),
                  })
                }
                style={{ width: size, height: 40 }}
                {...brightness.panHandlers}
              >
                <Svg pointerEvents="none" width={size} height={40}>
                  <Defs>
                    <LinearGradient id={`${id}brightness`} x1="0%" x2="100%">
                      <Stop offset="0" stopColor="#000000" />
                      <Stop offset="1" stopColor={hsvToHex({ ...hsv, v: 1 })} />
                    </LinearGradient>
                  </Defs>
                  <Rect
                    x={10}
                    y={10}
                    width={size - 20}
                    height={20}
                    rx={10}
                    fill={`url(#${id}brightness)`}
                  />
                  <Circle
                    cx={10 + hsv.v * (size - 20)}
                    cy={20}
                    r={10}
                    fill={selected}
                    stroke="#FFFFFF"
                    strokeWidth={2.5}
                  />
                </Svg>
              </View>
            </View>
            <View
              style={[
                s.preview,
                { borderColor: palette.line, backgroundColor: palette.bg },
              ]}
            >
              <View
                style={[
                  s.swatch,
                  { backgroundColor: selected, borderColor: palette.line },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: palette.muted }]}>
                  HEX COLOR
                </Text>
                <TextInput
                  accessibilityLabel="Hex color"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={7}
                  value={hex}
                  onChangeText={(text) => {
                    const next =
                      "#" +
                      text
                        .replace(/[^\da-f]/gi, "")
                        .slice(0, 6)
                        .toUpperCase();
                    setHex(next);
                    if (/^#[\da-f]{6}$/i.test(next)) setHsv(hexToHsv(next));
                  }}
                  style={[s.hex, { color: palette.cream }]}
                />
              </View>
            </View>
            {!valid ? (
              <Text
                accessibilityRole="alert"
                style={[s.caption, { color: palette.muted }]}
              >
                Enter all six color digits.
              </Text>
            ) : null}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            disabled={!valid}
            onPress={() => onSelect(selected)}
            style={[
              s.apply,
              { backgroundColor: palette.accent, opacity: valid ? 1 : 0.5 },
            ]}
          >
            <Check size={18} color={palette.bg} />
            <Text style={[s.applyText, { color: palette.bg }]}>Use color</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  shade: {
    flex: 1,
    backgroundColor: "rgba(7,4,2,.76)",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: layout.dialogInset,
    borderWidth: 0,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.controlGap,
    marginBottom: layout.sectionGap,
  },
  title: { fontSize: 21, lineHeight: 27, fontWeight: "700" },
  caption: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  close: {
    width: 36,
    height: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: layout.contentGap,
    paddingBottom: layout.dialogInset,
  },
  brightnessLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  preview: {
    width: "100%",
    borderWidth: 0,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  swatch: { width: 44, height: 44, borderRadius: 12, borderWidth: 0 },
  hex: {
    fontSize: 17,
    fontWeight: "600",
    paddingVertical: 5,
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  apply: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyText: { fontSize: 14, fontWeight: "700" },
});
