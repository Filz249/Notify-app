import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { AlarmClock, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { requestReminderPermission } from "../notifications";
import { defaultReminderDate, reminderTimestamp } from "../reminderDate";
import type { Note, ReminderRepeat } from "../types";
import type { EditorPalette } from "./PaperEditor";
import { layout } from "../layout";
import { repeatStart } from "../recurrence";

export function ReminderPicker({
  value,
  initialRepeat = "none",
  palette,
  onClose,
  onSet,
  onRemove,
}: {
  value?: number;
  initialRepeat?: ReminderRepeat;
  palette: EditorPalette;
  onClose: () => void;
  onSet: (
    timestamp: number,
    delivery: NonNullable<Note["reminderDelivery"]>,
    repeat: ReminderRepeat,
  ) => void;
  onRemove: () => void;
}) {
  const { height } = useWindowDimensions();
  const initial =
    value && (initialRepeat !== "none" || value > Date.now())
      ? new Date(value)
      : defaultReminderDate();
  const [day, setDay] = useState(initial);
  const [month, setMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const [hour, setHour] = useState(String(initial.getHours()).padStart(2, "0"));
  const [minute, setMinute] = useState(
    String(initial.getMinutes()).padStart(2, "0"),
  );
  const [repeat, setRepeat] = useState<ReminderRepeat>(initialRepeat);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusedTime, setFocusedTime] = useState<"hour" | "minute" | null>(
    null,
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offset = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const canGoBack =
    month.getFullYear() > today.getFullYear() ||
    (month.getFullYear() === today.getFullYear() &&
      month.getMonth() > today.getMonth());

  const apply = async () => {
    setError("");
    try {
      const at =
        repeat === "none"
          ? reminderTimestamp(day, hour, minute)
          : repeatStart(repeat, day, hour, minute);
      setBusy(true);
      const delivery = await requestReminderPermission();
      if (!mounted.current) return;
      if (at <= Date.now())
        throw new Error("This time has passed. Choose a later time.");
      onSet(at, delivery, repeat);
    } catch (err) {
      if (mounted.current)
        setError(
          err instanceof Error
            ? err.message
            : "Could not enable notifications. Please try again.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              maxHeight: height - 40,
              backgroundColor: palette.panel,
              borderColor: palette.line,
            },
          ]}
        >
          <View style={styles.heading}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.cream }]}>
                Remember this later
              </Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>
                Choose when to be reminded.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close reminder picker"
              onPress={onClose}
              style={styles.close}
            >
              <X size={22} color={palette.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.repeatRow}>
              {(["none", "daily", "weekly"] as const).map((mode) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    mode === "none"
                      ? "Remind once"
                      : mode === "daily"
                        ? "Repeat daily"
                        : "Repeat weekly"
                  }
                  accessibilityState={{ selected: repeat === mode }}
                  key={mode}
                  onPress={() => {
                    setRepeat(mode);
                    setError("");
                  }}
                  style={[
                    styles.repeatOption,
                    {
                      backgroundColor:
                        repeat === mode ? palette.accent : palette.panel2,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.repeatText,
                      { color: repeat === mode ? palette.bg : palette.cream },
                    ]}
                  >
                    {mode === "none"
                      ? "Once"
                      : mode === "daily"
                        ? "Every day"
                        : "Every week"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {repeat === "none" ? (
              <>
                <View style={styles.monthRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    disabled={!canGoBack}
                    onPress={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      )
                    }
                    style={[
                      styles.monthButton,
                      { opacity: canGoBack ? 1 : 0.3 },
                    ]}
                  >
                    <ChevronLeft size={20} color={palette.cream} />
                  </Pressable>
                  <Text style={[styles.monthTitle, { color: palette.cream }]}>
                    {month.toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    onPress={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      )
                    }
                    style={styles.monthButton}
                  >
                    <ChevronRight size={20} color={palette.cream} />
                  </Pressable>
                </View>
                <View style={styles.calendar}>
                  {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
                    <View key={`weekday-${i}`} style={styles.dayCell}>
                      <Text style={[styles.weekday, { color: palette.muted }]}>
                        {label}
                      </Text>
                    </View>
                  ))}
                  {Array.from({ length: offset }, (_, i) => (
                    <View key={`blank-${i}`} style={styles.dayCell} />
                  ))}
                  {Array.from({ length: days }, (_, i) => {
                    const date = new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      i + 1,
                    );
                    const disabled = date < today;
                    const selected = date.toDateString() === day.toDateString();
                    return (
                      <View key={i} style={styles.dayCell}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={date.toLocaleDateString(
                            undefined,
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                          accessibilityState={{ selected, disabled }}
                          disabled={disabled}
                          onPress={() => {
                            setDay(date);
                            setError("");
                          }}
                          style={[
                            styles.dayButton,
                            {
                              backgroundColor: selected
                                ? palette.accent
                                : "transparent",
                              opacity: disabled ? 0.25 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              { color: selected ? palette.bg : palette.cream },
                            ]}
                          >
                            {i + 1}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : repeat === "weekly" ? (
              <View style={styles.repeatRow}>
                {[1, 2, 3, 4, 5, 6, 0].map((weekday, i) => (
                  <Pressable
                    key={weekday}
                    accessibilityRole="button"
                    accessibilityLabel={
                      [
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                      ][i]
                    }
                    accessibilityState={{ selected: day.getDay() === weekday }}
                    onPress={() => {
                      const next = new Date(day);
                      next.setDate(next.getDate() + weekday - next.getDay());
                      setDay(next);
                    }}
                    style={[
                      styles.weekdayChoice,
                      {
                        backgroundColor:
                          day.getDay() === weekday
                            ? palette.accent
                            : palette.bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.repeatText,
                        {
                          color:
                            day.getDay() === weekday
                              ? palette.bg
                              : palette.cream,
                        },
                      ]}
                    >
                      {["M", "T", "W", "T", "F", "S", "S"][i]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={[styles.help, { color: palette.muted }]}>
                Every day at the time below, starting with the next occurrence.
              </Text>
            )}
            <View style={[styles.timeRow, { borderTopColor: palette.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.timeTitle, { color: palette.cream }]}>
                  Time
                </Text>
                <Text style={[styles.timeCaption, { color: palette.muted }]}>
                  24-hour · local time
                </Text>
              </View>
              <TextInput
                accessibilityLabel="Reminder hour"
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                value={hour}
                onChangeText={(text) => {
                  setHour(text.replace(/\D/g, ""));
                  setError("");
                }}
                onFocus={() => setFocusedTime("hour")}
                onBlur={() => {
                  setFocusedTime(null);
                  if (hour) setHour(hour.padStart(2, "0"));
                }}
                style={[
                  styles.timeInput,
                  {
                    color: palette.cream,
                    backgroundColor: palette.bg,
                    borderColor: palette.line,
                  },
                ]}
              />
              <Text style={[styles.colon, { color: palette.muted }]}>:</Text>
              <TextInput
                accessibilityLabel="Reminder minute"
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                value={minute}
                onChangeText={(text) => {
                  setMinute(text.replace(/\D/g, ""));
                  setError("");
                }}
                onFocus={() => setFocusedTime("minute")}
                onBlur={() => {
                  setFocusedTime(null);
                  if (minute) setMinute(minute.padStart(2, "0"));
                }}
                style={[
                  styles.timeInput,
                  {
                    color: palette.cream,
                    backgroundColor: palette.bg,
                    borderColor: palette.line,
                  },
                ]}
              />
            </View>
            <Text style={[styles.help, { color: palette.muted }]}>
              {Platform.OS === "web"
                ? "Keep Notify open for browser reminders. Allow desktop notifications, or receive an alert here in the app."
                : "You’ll receive a notification at the selected time."}{" "}
              Your reminder starts when you save the note.
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={apply}
            style={[
              styles.submit,
              { backgroundColor: palette.accent, opacity: busy ? 0.65 : 1 },
            ]}
          >
            <AlarmClock size={19} color={palette.bg} />
            <Text style={[styles.submitText, { color: palette.bg }]}>
              {busy ? "Enabling…" : "Set reminder"}
            </Text>
          </Pressable>
          {value ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRemove}
              style={styles.remove}
            >
              <Text style={[styles.removeText, { color: palette.muted }]}>
                Remove reminder
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(7,4,2,.76)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 0,
    padding: layout.dialogInset,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.controlGap,
    marginBottom: layout.contentGap,
  },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  close: {
    minHeight: 40,
    width: 32,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  content: { paddingBottom: 16 },
  repeatRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  repeatOption: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatText: { fontSize: 12, fontWeight: "600" },
  weekdayChoice: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  monthButton: {
    width: 36,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { fontSize: 15, fontWeight: "700" },
  calendar: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  weekday: { fontSize: 11, fontWeight: "600" },
  dayButton: {
    width: "90%",
    maxWidth: 38,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 13, fontWeight: "600" },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
    paddingTop: 18,
    borderTopWidth: 0,
  },
  timeTitle: { fontSize: 14, fontWeight: "600" },
  timeCaption: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  timeInput: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 0,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
    outlineWidth: 0,
    outlineStyle: "solid",
  },
  colon: { fontSize: 20 },
  help: { fontSize: 12, lineHeight: 18, marginTop: 16 },
  error: { color: "#E77C70", fontSize: 13, lineHeight: 19, marginTop: 12 },
  submit: {
    minHeight: 48,
    flexDirection: "row",
    gap: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { fontSize: 14, fontWeight: "700" },
  remove: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  removeText: { fontSize: 13, fontWeight: "600" },
});
