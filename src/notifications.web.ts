import { loadNotes } from "./storage";
import type { Note } from "./types";
import { occurrence } from "./recurrence";

const DELIVERED_KEY = "notify:delivered-reminders:v1";
const NOTES_KEY = "notify:notes:v1";
const REMINDER_EVENT = "notify:reminder-due";
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;
let running = false;
let runAgain = false;

export async function requestReminderPermission(): Promise<
  "system" | "in-app"
> {
  if (!("Notification" in window)) return "in-app";
  try {
    const permission =
      Notification.permission === "default"
        ? await new Promise<NotificationPermission>((resolve) => {
            let finished = false;
            const finish = (result: NotificationPermission) => {
              if (finished) return;
              finished = true;
              clearTimeout(timeout);
              resolve(result);
            };
            // Embedded browsers can suppress the prompt without settling its promise.
            const timeout = setTimeout(() => finish("default"), 8_000);
            try {
              Notification.requestPermission().then(finish, () =>
                finish("denied"),
              );
            } catch {
              finish("denied");
            }
          })
        : Notification.permission;
    return permission === "granted" ? "system" : "in-app";
  } catch {
    return "in-app";
  }
}

export function subscribeToReminders(
  listener: (note: Note) => void,
): () => void {
  const handle = (event: Event) =>
    listener((event as CustomEvent<Note>).detail);
  window.addEventListener(REMINDER_EVENT, handle);
  return () => {
    window.removeEventListener(REMINDER_EVENT, handle);
  };
}

function showInApp(note: Note) {
  window.dispatchEvent(new CustomEvent<Note>(REMINDER_EVENT, { detail: note }));
}

export async function syncReminder(note: Note): Promise<string | undefined> {
  if (
    note.deletedAt ||
    (!(note.snoozedUntil && note.snoozedUntil > Date.now()) &&
      (!note.reminderAt ||
        (note.reminderAt <= Date.now() &&
          (!note.reminderRepeat || note.reminderRepeat === "none"))))
  )
    return undefined;
  // Saved notes are the schedule's source of truth. Nothing fires before saving.
  return `web:${note.id}:${note.reminderAt}`;
}

export async function cancelReminder(_identifier?: string): Promise<void> {
  // Removing/updating the saved note cancels its schedule through the storage event.
}

function announce(note: Note) {
  if (
    note.reminderDelivery !== "in-app" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      const notification = new Notification(
        note.important ? "★ Important · Notify" : "Notify reminder",
        {
          body:
            note.title.trim() || note.body.trim() || "You saved a reminder.",
          tag: `notify:${note.id}:${note.reminderAt}`,
        },
      );
      notification.onclick = () => {
        window.focus();
        notification.close();
        showInApp(note);
      };
    } catch (error) {
      console.warn(
        "Desktop notification unavailable; showing an in-app reminder.",
        error,
      );
    }
  }
  showInApp(note);
}

async function checkSchedule() {
  const notes = await loadNotes();
  const delivered = JSON.parse(
    localStorage.getItem(DELIVERED_KEY) ?? "{}",
  ) as Record<string, number>;
  const now = Date.now();
  let next = Infinity;
  const due: Note[] = [];
  const activeIds = new Set(
    notes
      .filter((n) => !n.deletedAt)
      .flatMap((note) => [note.id, `${note.id}/snooze`]),
  );
  for (const id of Object.keys(delivered))
    if (!activeIds.has(id)) delete delivered[id];
  for (const note of notes) {
    if (!note.notificationId || note.deletedAt) continue;
    const at = occurrence(note, now, "latest");
    if (
      at &&
      at <= now &&
      delivered[note.id] !== at &&
      at > (note.reminderCompletedAt || 0)
    ) {
      delivered[note.id] = at;
      due.push({ ...note, reminderAt: at });
    }
    const future = occurrence(note, now, "next");
    if (future && future > now) next = Math.min(next, future);
    const snooze = note.snoozedUntil,
      key = `${note.id}/snooze`;
    if (
      snooze &&
      snooze > (note.reminderCompletedAt || 0) &&
      delivered[key] !== snooze
    ) {
      if (snooze <= now) {
        delivered[key] = snooze;
        due.push({ ...note, reminderAt: snooze });
      } else next = Math.min(next, snooze);
    }
  }
  // Persist before notifying, so reopening the app doesn't repeat a reminder.
  localStorage.setItem(DELIVERED_KEY, JSON.stringify(delivered));
  due.forEach(announce);
  if (Number.isFinite(next))
    timer = setTimeout(
      refreshSchedule,
      Math.min(2_147_483_647, Math.max(1, next - Date.now())),
    );
}

async function refreshSchedule() {
  if (running) {
    runAgain = true;
    return;
  }
  running = true;
  clearTimeout(timer);
  timer = undefined;
  try {
    // Multiple open tabs must not each deliver the same system notification.
    if (navigator.locks)
      await navigator.locks.request("notify:reminders", checkSchedule);
    else await checkSchedule();
  } catch (error) {
    console.warn("Could not check reminders", error);
  } finally {
    running = false;
    if (runAgain) {
      runAgain = false;
      void refreshSchedule();
    }
  }
}

export async function prepareNotifications(): Promise<void> {
  if (started) return;
  started = true;
  window.addEventListener("notify:notes-changed", refreshSchedule);
  window.addEventListener("storage", (event) => {
    if (event.key === NOTES_KEY || event.key === null) void refreshSchedule();
    if (event.key === DELIVERED_KEY && event.newValue) {
      // The tab that claims delivery sends the OS notification. Every open tab
      // displays the in-app alert so the currently visible one cannot miss it.
      void (async () => {
        const previous = JSON.parse(event.oldValue ?? "{}") as Record<
          string,
          number
        >;
        const delivered = JSON.parse(event.newValue!) as Record<string, number>;
        const notes = await loadNotes();
        notes
          .filter((note) => !note.deletedAt && note.notificationId)
          .forEach((note) => {
            for (const key of [note.id, `${note.id}/snooze`])
              if (delivered[key] && delivered[key] !== previous[key])
                showInApp({ ...note, reminderAt: delivered[key] });
          });
      })().catch((error) => console.warn("Could not display reminder", error));
    }
  });
  window.addEventListener("focus", refreshSchedule);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshSchedule();
  });
  await refreshSchedule();
}
