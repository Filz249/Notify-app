import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Note } from "./types";
import { loadNotes } from "./storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function prepareNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("notify-reminders", {
      name: "Notify reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: "#F2B23D",
    });
  }
}

export async function requestReminderPermission(): Promise<
  "system" | "in-app"
> {
  await prepareNotifications();
  const existing = await Notifications.getPermissionsAsync();
  let granted =
    existing.granted ||
    existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted =
      requested.granted ||
      requested.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  if (!granted)
    throw new Error(
      "Allow notifications for Notify in your device settings, then try again.",
    );
  return "system";
}

export function subscribeToReminders(
  listener: (note: Note) => void,
): () => void {
  const show = async (notification: Notifications.Notification) => {
    const note = (await loadNotes()).find(
      (n) => n.id === notification.request.content.data?.noteId && !n.deletedAt,
    );
    if (note) listener(note);
  };
  const received = Notifications.addNotificationReceivedListener((n) => {
    void show(n).catch(console.warn);
  });
  const responded = Notifications.addNotificationResponseReceivedListener(
    (r) => {
      void show(r.notification).catch(console.warn);
      Notifications.clearLastNotificationResponse();
    },
  );
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    void show(last.notification).catch(console.warn);
    Notifications.clearLastNotificationResponse();
  }
  return () => {
    received.remove();
    responded.remove();
  };
}

export async function cancelReminder(identifier?: string): Promise<void> {
  if (!identifier) return;
  let ids = [identifier];
  if (identifier.startsWith("[")) {
    try {
      const parsed = JSON.parse(identifier);
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string"))
        ids = parsed;
    } catch {}
  }
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
}

export async function syncReminder(note: Note): Promise<string | undefined> {
  const repeat = note.reminderRepeat && note.reminderRepeat !== "none";
  const main = note.reminderAt && (repeat || note.reminderAt > Date.now());
  const snooze = note.snoozedUntil && note.snoozedUntil > Date.now();
  if (note.deletedAt || (!main && !snooze)) {
    await cancelReminder(note.notificationId);
    return undefined;
  }
  await requestReminderPermission();

  const content = {
    title: note.important ? "★ Important · Notify" : "Notify reminder",
    body: note.title.trim() || note.body.trim() || "You saved a reminder.",
    sound: true,
    data: { noteId: note.id },
  };
  const channel =
    Platform.OS === "android" ? { channelId: "notify-reminders" } : {};
  const ids: string[] = [];
  try {
    if (main) {
      const date = new Date(note.reminderAt!);
      const trigger: Notifications.NotificationTriggerInput =
        note.reminderRepeat === "daily"
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: date.getHours(),
              minute: date.getMinutes(),
              ...channel,
            }
          : note.reminderRepeat === "weekly"
            ? {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: date.getDay() + 1,
                hour: date.getHours(),
                minute: date.getMinutes(),
                ...channel,
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date,
                ...channel,
              };
      ids.push(
        await Notifications.scheduleNotificationAsync({ content, trigger }),
      );
    }
    if (snooze)
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(note.snoozedUntil!),
            ...channel,
          },
        }),
      );
  } catch (error) {
    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
    throw error;
  }
  const identifier = ids.length === 1 ? ids[0] : JSON.stringify(ids);
  // Keep the old reminder until its replacement has been scheduled successfully.
  if (note.notificationId && note.notificationId !== identifier) {
    try {
      await cancelReminder(note.notificationId);
    } catch (error) {
      await cancelReminder(identifier);
      throw error;
    }
  }
  return identifier;
}
