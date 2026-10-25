import type { Note, ReminderRepeat } from "./types";

export function repeatStart(
  repeat: ReminderRepeat,
  day: Date,
  hour: string,
  minute: string,
  now = Date.now(),
): number {
  if (
    !/^\d{1,2}$/.test(hour) ||
    !/^\d{1,2}$/.test(minute) ||
    +hour > 23 ||
    +minute > 59
  )
    throw new Error("Enter a time between 00:00 and 23:59.");
  const at = new Date(now);
  if (repeat === "weekly")
    at.setDate(at.getDate() + ((day.getDay() - at.getDay() + 7) % 7));
  at.setHours(+hour, +minute, 0, 0);
  while (+at <= now || at.getHours() !== +hour || at.getMinutes() !== +minute) {
    at.setDate(at.getDate() + (repeat === "weekly" ? 7 : 1));
    at.setHours(+hour, +minute, 0, 0);
  }
  return +at;
}

// Calendar arithmetic keeps recurring reminders at the chosen local time through DST.
export function occurrence(
  note: Note,
  now = Date.now(),
  direction: "next" | "latest" = "next",
): number | undefined {
  if (!note.reminderAt || note.deletedAt) return undefined;
  const anchor = new Date(note.reminderAt);
  if (!note.reminderRepeat || note.reminderRepeat === "none")
    return note.reminderAt;
  if (now < note.reminderAt)
    return direction === "next" ? note.reminderAt : undefined;
  const candidate = new Date(now);
  const step = note.reminderRepeat === "weekly" ? 7 : 1;
  if (step === 7)
    candidate.setDate(
      candidate.getDate() - ((candidate.getDay() - anchor.getDay() + 7) % 7),
    );
  candidate.setHours(anchor.getHours(), anchor.getMinutes(), 0, 0);
  if (direction === "next" && +candidate <= now) {
    candidate.setDate(candidate.getDate() + step);
    candidate.setHours(anchor.getHours(), anchor.getMinutes(), 0, 0);
  }
  if (direction === "latest" && +candidate > now) {
    candidate.setDate(candidate.getDate() - step);
    candidate.setHours(anchor.getHours(), anchor.getMinutes(), 0, 0);
  }
  return +candidate >= note.reminderAt ? +candidate : undefined;
}

export function agendaAt(note: Note, now = Date.now()): number | undefined {
  if (note.deletedAt || !note.notificationId) return undefined;
  const snooze =
    note.snoozedUntil && note.snoozedUntil > (note.reminderCompletedAt || 0)
      ? note.snoozedUntil
      : undefined;
  const repeated = note.reminderRepeat && note.reminderRepeat !== "none";
  const at = repeated
    ? occurrence(note, now)
    : note.reminderAt && note.reminderAt > (note.reminderCompletedAt || 0)
      ? note.reminderAt
      : undefined;
  return snooze && at ? Math.min(snooze, at) : snooze || at;
}

export function matchesAgenda(
  note: Note,
  view: "today" | "upcoming",
  now = Date.now(),
): boolean {
  if (note.deletedAt) return false;
  const at = agendaAt(note, now);
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  if (view === "upcoming") return !!at && at >= +tomorrow;
  return at
    ? at < +tomorrow
    : ["todo", "checklist", "shopping"].includes(note.type) &&
        note.items.some((item) => !item.checked);
}
