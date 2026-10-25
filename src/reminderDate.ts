export function reminderTimestamp(
  day: Date,
  hour: string,
  minute: string,
  now = Date.now(),
): number {
  if (
    !/^\d{1,2}$/.test(hour) ||
    !/^\d{1,2}$/.test(minute) ||
    Number(hour) > 23 ||
    Number(minute) > 59
  ) {
    throw new Error("Enter a time between 00:00 and 23:59.");
  }
  const date = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Number(hour),
    Number(minute),
  );
  if (
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute)
  ) {
    throw new Error(
      "This time is skipped by the daylight-saving change. Choose another time.",
    );
  }
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now)
    throw new Error("Choose a date and time in the future.");
  return date.getTime();
}

export function defaultReminderDate(now = Date.now()): Date {
  return new Date(
    Math.ceil((now + 60 * 60 * 1000) / (15 * 60 * 1000)) * 15 * 60 * 1000,
  );
}
