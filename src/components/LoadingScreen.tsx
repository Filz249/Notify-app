import React, { useEffect, useId, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Check,
  ListChecks,
  Music2,
  NotebookPen,
  Pencil,
  PencilLine,
  StickyNote,
} from "lucide-react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import type { EditorPalette } from "./PaperEditor";

export const loadingVariants = ["signature", "paper", "ideas"] as const;
export type LoadingVariant = (typeof loadingVariants)[number];

const nativeDriver = Platform.OS !== "web";

export function LoadingScreen({
  ready,
  palette,
  onFinish,
  onLayout,
  initialVariant,
  statusBarStyle = "light",
}: {
  ready: boolean;
  palette: EditorPalette;
  onFinish: () => void;
  onLayout?: () => void;
  initialVariant?: LoadingVariant;
  statusBarStyle?: "light" | "dark";
}) {
  // Choose once per mount, so loading, theme changes and renders never reroll it.
  const [variant] = useState(
    () =>
      initialVariant ??
      loadingVariants[Math.floor(Math.random() * loadingVariants.length)],
  );
  const [laidOut, setLaidOut] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  const compact = height < 650;
  const patternId = useId().replace(/:/g, "");

  useEffect(() => {
    let active = true;
    let motionChanged = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        motionChanged = true;
        if (active) setReduceMotion(value);
      },
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !motionChanged) setReduceMotion(value);
      })
      .catch(() => {
        if (active && !motionChanged) setReduceMotion(true);
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      entrance.setValue(1);
      pulse.setValue(0.5);
      return;
    }
    const arrive = Animated.timing(entrance, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
      isInteraction: false,
    });
    const loading = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: nativeDriver,
        isInteraction: false,
      }),
    );
    arrive.start();
    loading.start();
    return () => {
      arrive.stop();
      loading.stop();
    };
  }, [entrance, pulse, reduceMotion]);

  useEffect(() => {
    if (!ready || !laidOut || reduceMotion === null) return;
    if (reduceMotion) {
      onFinish();
      return;
    }
    // Readiness drives dismissal. Never hold the user for a minimum splash time.
    const leave = Animated.timing(opacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: nativeDriver,
      isInteraction: false,
    });
    leave.start(({ finished }) => {
      if (finished) onFinish();
    });
    return () => leave.stop();
  }, [ready, laidOut, reduceMotion, opacity, onFinish]);

  const arrival = {
    opacity: entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [0.65, 1],
    }),
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  };
  const brand = (
    <Text
      accessibilityLabel="Notify"
      style={[s.brand, { color: palette.cream }]}
    >
      Notify<Text style={{ color: palette.accent }}>.</Text>
    </Text>
  );
  const serif = Platform.OS === "ios" ? "Georgia" : "serif";
  const status =
    variant === "signature"
      ? "A moment for your thoughts."
      : variant === "paper"
        ? "Opening your notebook"
        : "Getting your space ready";

  return (
    <SafeAreaView
      testID={`loading-${variant}`}
      style={[s.screen, { backgroundColor: palette.bg }]}
      onLayout={() => {
        if (!laidOut) {
          onLayout?.();
          setLaidOut(true);
        }
      }}
    >
      <StatusBar style={statusBarStyle} />
      {variant === "paper" ? (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          aria-hidden
        >
          <Defs>
            <Pattern
              id={patternId}
              width={19}
              height={19}
              patternUnits="userSpaceOnUse"
            >
              <Circle
                cx={2}
                cy={2}
                r={0.65}
                fill={palette.muted}
                opacity={0.09}
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </Svg>
      ) : null}
      <Animated.View
        style={[s.content, compact && s.compactContent, { opacity }]}
        accessibilityState={{ busy: true }}
      >
        {variant !== "signature" ? brand : null}
        {variant === "signature" ? (
          <Animated.View style={[s.signature, arrival]}>
            <NotebookPen
              size={35}
              color={palette.accent}
              strokeWidth={1.4}
              style={s.signatureIcon}
              aria-hidden
            />
            <Text
              accessibilityLabel="Notify"
              style={[s.wordmark, { color: palette.cream }]}
            >
              Notify<Text style={{ color: palette.accent }}>.</Text>
            </Text>
            <Text style={[s.caption, { color: palette.muted }]}>
              Your ideas, remembered.
            </Text>
          </Animated.View>
        ) : variant === "paper" ? (
          <View style={s.paperContent}>
            <View
              style={[s.paperScene, compact && s.compactScene]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Animated.View
                style={[
                  s.sheet,
                  s.backSheet,
                  {
                    backgroundColor: palette.line,
                    transform: [
                      {
                        rotate: entrance.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "-13deg"],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  s.sheet,
                  s.middleSheet,
                  {
                    backgroundColor: palette.accent,
                    opacity: 0.75,
                    transform: [
                      {
                        rotate: entrance.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "8deg"],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  s.sheet,
                  s.frontSheet,
                  {
                    transform: [
                      {
                        rotate: entrance.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "-3deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={[s.handwritten, { fontFamily: serif }]}>
                  a little idea
                </Text>
                <View style={s.writtenLine} />
                <View style={s.writtenLine} />
                <View style={[s.writtenLine, { width: "60%" }]} />
                <Check
                  size={21}
                  color="#8B682C"
                  strokeWidth={1.5}
                  style={s.paperCheck}
                />
              </Animated.View>
              <Pencil
                size={55}
                color={palette.accent}
                strokeWidth={1.4}
                style={s.pencil}
              />
            </View>
            <Animated.View style={[s.paperCopy, arrival]}>
              <Text
                style={[
                  s.paperTitle,
                  { color: palette.cream, fontFamily: serif },
                ]}
              >
                Good things start here.
              </Text>
              <Text style={[s.caption, { color: palette.muted }]}>
                A thought. A list. A little reminder.
              </Text>
            </Animated.View>
          </View>
        ) : (
          <View style={s.ideasContent}>
            <View
              style={[s.thoughtRow, compact && s.compactThoughtRow]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Animated.View
                style={[
                  s.thought,
                  arrival,
                  {
                    backgroundColor: palette.panel2,
                    transform: [{ rotate: "-12deg" }],
                  },
                ]}
              >
                <StickyNote
                  size={26}
                  color={palette.accent}
                  strokeWidth={1.4}
                />
              </Animated.View>
              <Animated.View
                style={[
                  s.thought,
                  arrival,
                  {
                    backgroundColor: "#2A3020",
                    transform: [{ rotate: "12deg" }],
                  },
                ]}
              >
                <ListChecks size={26} color="#A8C66C" strokeWidth={1.4} />
              </Animated.View>
            </View>
            <Animated.View style={arrival}>
              <Text
                style={[
                  s.ideasTitle,
                  {
                    color: palette.cream,
                    fontFamily: serif,
                    fontSize: width < 360 ? 39 : 46,
                    lineHeight: width < 360 ? 43 : 51,
                  },
                ]}
              >
                {"Make room\nfor a "}
                <Text style={{ color: palette.accent, fontStyle: "italic" }}>
                  thought.
                </Text>
              </Text>
              <Text style={[s.caption, { color: palette.muted }]}>
                {"For the things you want\nto come back to."}
              </Text>
            </Animated.View>
            <View
              style={[
                s.thoughtRow,
                s.lowerThoughtRow,
                compact && s.compactThoughtRow,
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Animated.View
                style={[
                  s.thought,
                  arrival,
                  {
                    backgroundColor: "#402733",
                    transform: [{ rotate: "9deg" }],
                  },
                ]}
              >
                <Music2 size={26} color="#D98EB5" strokeWidth={1.4} />
              </Animated.View>
              <Animated.View
                style={[
                  s.thought,
                  arrival,
                  {
                    backgroundColor: "#233432",
                    transform: [{ rotate: "-9deg" }],
                  },
                ]}
              >
                <PencilLine size={26} color="#63BBB8" strokeWidth={1.4} />
              </Animated.View>
            </View>
          </View>
        )}
        <View
          style={s.footer}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          accessibilityLabel={status}
        >
          {variant === "paper" ? (
            <View
              style={[s.track, { backgroundColor: palette.line }]}
              accessibilityElementsHidden
            >
              <Animated.View
                style={[
                  s.trackSegment,
                  {
                    backgroundColor: palette.accent,
                    transform: [
                      {
                        translateX: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-28, 88],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
          ) : (
            <View style={s.dots} accessibilityElementsHidden>
              {[0, 1, 2].map((index) => (
                <Animated.View
                  key={index}
                  style={[
                    s.dot,
                    {
                      backgroundColor:
                        variant === "ideas"
                          ? [palette.accent, "#A8C66C", "#D98EB5"][index]
                          : palette.accent,
                      opacity: pulse.interpolate({
                        inputRange: [0, 0.25, 0.5, 0.75, 1],
                        outputRange:
                          index === 0
                            ? [1, 0.65, 0.35, 0.65, 1]
                            : index === 1
                              ? [0.65, 1, 0.65, 0.35, 0.65]
                              : [0.35, 0.65, 1, 0.65, 0.35],
                      }),
                    },
                  ]}
                />
              ))}
            </View>
          )}
          <Text style={[s.caption, { color: palette.muted }]}>{status}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 32,
  },
  compactContent: { paddingTop: 18, paddingBottom: 18 },
  brand: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1.2,
    fontWeight: "700",
  },
  caption: { fontSize: 14, lineHeight: 22 },
  signature: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 28,
  },
  signatureIcon: { marginBottom: 26 },
  wordmark: {
    fontSize: 66,
    lineHeight: 80,
    fontWeight: "700",
    letterSpacing: -3.5,
    marginBottom: 10,
  },
  footer: { alignItems: "center", justifyContent: "center", minHeight: 64 },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 22,
    marginBottom: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  track: {
    width: 88,
    height: 2,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 20,
  },
  trackSegment: { width: 28, height: 2, borderRadius: 2 },
  paperContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  paperScene: { width: 212, height: 194, marginBottom: 28 },
  compactScene: { transform: [{ scale: 0.85 }], marginBottom: 6 },
  sheet: {
    position: "absolute",
    width: 142,
    height: 170,
    borderRadius: 6,
    top: 8,
  },
  backSheet: { left: 15 },
  middleSheet: { left: 48 },
  frontSheet: {
    left: 35,
    backgroundColor: "#F5EBDD",
    paddingHorizontal: 20,
    paddingVertical: 24,
    boxShadow: "0 12px 25px #100a0740",
  },
  handwritten: {
    color: "#4E3523",
    fontSize: 20,
    lineHeight: 25,
    fontStyle: "italic",
    marginBottom: 14,
  },
  writtenLine: {
    backgroundColor: "#C9B9A3",
    height: 2,
    borderRadius: 2,
    marginBottom: 12,
  },
  paperCheck: { position: "absolute", right: 16, bottom: 16 },
  pencil: {
    position: "absolute",
    right: -8,
    bottom: -1,
    transform: [{ rotate: "-15deg" }],
  },
  paperCopy: { alignItems: "center", gap: 10 },
  paperTitle: {
    fontSize: 27,
    lineHeight: 35,
    letterSpacing: -0.7,
    textAlign: "center",
  },
  ideasContent: { flex: 1, justifyContent: "center", paddingVertical: 22 },
  thoughtRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 14,
    marginBottom: 34,
  },
  lowerThoughtRow: { marginBottom: 0, marginTop: 34, paddingLeft: 18 },
  compactThoughtRow: { marginBottom: 18, marginTop: 10 },
  thought: {
    width: 51,
    height: 51,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ideasTitle: { letterSpacing: -1.7, marginBottom: 18 },
});
