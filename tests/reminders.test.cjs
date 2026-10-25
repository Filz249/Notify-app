const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

process.env.TZ = "Europe/Zagreb";

function load(file, globals = {}, imports = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", file),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  vm.runInNewContext(
    outputText,
    {
      exports,
      console,
      require: (name) => {
        if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
        return imports[name];
      },
      ...globals,
    },
    { filename: file },
  );
  return exports;
}

const makeNote = (at) => ({
  id: "test-note",
  title: "Remember milk",
  body: "",
  important: false,
  reminderAt: at,
  reminderDelivery: "system",
  notificationId: `web:test-note:${at}`,
});

function browser({
  shared = new Map(),
  permission = "granted",
  notifications = true,
  pendingPermission = false,
} = {}) {
  let now = 1_800_000_000_000;
  let sequence = 0;
  const timers = new Map();
  const events = new Map();
  const shown = [];
  const alerts = [];
  class Clock extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
    static now() {
      return now;
    }
  }
  class Notification {
    static permission = permission;
    static async requestPermission() {
      return pendingPermission
        ? new Promise(() => {})
        : Notification.permission;
    }
    constructor(title, options) {
      shown.push({ title, ...options });
    }
    close() {}
  }
  const localStorage = {
    getItem: (key) => shared.get(key) ?? null,
    setItem: (key, value) => shared.set(key, value),
  };
  const addEventListener = (name, callback) =>
    events.set(name, [...(events.get(name) ?? []), callback]);
  const dispatchEvent = (event) => {
    for (const listener of events.get(event.type) ?? []) listener(event);
  };
  const api = load(
    "notifications.web.ts",
    {
      Date: Clock,
      localStorage,
      window: {
        ...(notifications ? { Notification } : {}),
        addEventListener,
        dispatchEvent,
        removeEventListener: (name, callback) =>
          events.set(
            name,
            (events.get(name) ?? []).filter((item) => item !== callback),
          ),
        focus() {},
      },
      CustomEvent: class {
        constructor(type, options) {
          this.type = type;
          this.detail = options.detail;
        }
      },
      Notification,
      document: { addEventListener, visibilityState: "visible" },
      navigator: { locks: { request: async (_name, callback) => callback() } },
      setTimeout: (callback, delay) => {
        const id = ++sequence;
        timers.set(id, { callback, at: now + delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
    {
      "./recurrence": load("recurrence.ts", { Date: Clock }),
      "./storage": {
        loadNotes: async () =>
          JSON.parse(localStorage.getItem("notify:notes:v1") ?? "[]"),
      },
    },
  );
  api.subscribeToReminders((note) => alerts.push(note));
  const event = async (name, data = {}) => {
    for (const listener of events.get(name) ?? []) await listener(data);
    await new Promise(setImmediate);
  };
  return {
    api,
    shown,
    alerts,
    shared,
    timers,
    now: () => now,
    event,
    async save(notes) {
      localStorage.setItem("notify:notes:v1", JSON.stringify(notes));
      await event("notify:notes-changed");
    },
    async advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of [...timers])
        if (timer.at <= now) {
          timers.delete(id);
          await timer.callback();
        }
    },
  };
}

test("a reminder starts only after the note is saved and fires once", async () => {
  const b = browser();
  await b.api.prepareNotifications();
  const note = makeNote(b.now() + 60_000);
  note.notificationId = await b.api.syncReminder(note);
  assert.equal(b.timers.size, 0);
  await b.save([note]);
  await b.advance(59_999);
  assert.equal(b.shown.length, 0);
  await b.advance(1);
  assert.equal(b.shown.length, 1);
  assert.equal(b.shown[0].body, "Remember milk");
  assert.equal(b.alerts.length, 1);
  await b.event("focus");
  assert.equal(b.shown.length, 1);
});

test("editing the date replaces the old timer", async () => {
  const b = browser();
  await b.api.prepareNotifications();
  await b.save([makeNote(b.now() + 1_000)]);
  await b.save([makeNote(b.now() + 5_000)]);
  await b.advance(1_000);
  assert.equal(b.shown.length, 0);
  await b.advance(4_000);
  assert.equal(b.shown.length, 1);
});

test("removing a reminder or deleting its note cancels delivery", async () => {
  const b = browser();
  await b.api.prepareNotifications();
  const note = makeNote(b.now() + 1_000);
  await b.save([note]);
  await b.save([{ ...note, reminderAt: undefined, notificationId: undefined }]);
  await b.advance(2_000);
  assert.equal(b.shown.length, 0);
  await b.save([makeNote(b.now() + 1_000)]);
  await b.save([]);
  await b.advance(2_000);
  assert.equal(b.shown.length, 0);
});

test("reopening restores pending reminders and never replays delivered ones", async () => {
  const first = browser();
  await first.save([makeNote(first.now() + 1_000)]);
  const second = browser({ shared: first.shared });
  await second.api.prepareNotifications();
  await second.advance(1_000);
  assert.equal(second.shown.length, 1);
  const third = browser({ shared: first.shared });
  await third.api.prepareNotifications();
  await third.advance(2_000);
  assert.equal(third.shown.length, 0);
});

test("denied or unavailable desktop notifications use an in-app alert", async () => {
  for (const options of [{ permission: "denied" }, { notifications: false }]) {
    const b = browser(options);
    await b.api.prepareNotifications();
    assert.equal(await b.api.requestReminderPermission(), "in-app");
    await b.save([
      { ...makeNote(b.now() + 1_000), reminderDelivery: "in-app" },
    ]);
    await b.advance(1_000);
    assert.equal(b.alerts.length, 1);
    assert.equal(b.shown.length, 0);
  }
});

test("long-term reminders do not overflow browser timers", async () => {
  const b = browser();
  await b.api.prepareNotifications();
  await b.save([makeNote(b.now() + 90 * 86_400_000)]);
  const timer = [...b.timers.values()][0];
  assert.equal(timer.at - b.now(), 2_147_483_647);
  await b.advance(2_147_483_647);
  assert.equal(b.shown.length, 0);
});

test("an embedded browser with an unanswered permission prompt falls back", async () => {
  const b = browser({ permission: "default", pendingPermission: true });
  const result = b.api.requestReminderPermission();
  await b.advance(8_000);
  assert.equal(await result, "in-app");
});

test("another tab receives the in-app alert without duplicating the desktop alert", async () => {
  const b = browser();
  await b.api.prepareNotifications();
  const note = makeNote(b.now() + 1_000);
  await b.save([note]);
  await b.event("storage", {
    key: "notify:delivered-reminders:v1",
    oldValue: "{}",
    newValue: JSON.stringify({ [note.id]: note.reminderAt }),
  });
  assert.equal(b.alerts.length, 1);
  assert.equal(b.shown.length, 0);
});

function native({ granted = true, failSchedule = false } = {}) {
  const events = [];
  const api = load(
    "notifications.ts",
    {},
    {
      "react-native": { Platform: { OS: "android" } },
      "./storage": { loadNotes: async () => [] },
      "expo-notifications": {
        setNotificationHandler() {},
        setNotificationChannelAsync: async () => {},
        AndroidImportance: { HIGH: 4 },
        IosAuthorizationStatus: { PROVISIONAL: 3 },
        getPermissionsAsync: async () => ({ granted }),
        requestPermissionsAsync: async () => ({ granted }),
        SchedulableTriggerInputTypes: {
          DATE: "date",
          DAILY: "daily",
          WEEKLY: "weekly",
        },
        scheduleNotificationAsync: async (request) => {
          events.push(["schedule", request]);
          if (failSchedule) throw new Error("schedule failed");
          return "new-id";
        },
        cancelScheduledNotificationAsync: async (id) => {
          events.push(["cancel", id]);
        },
      },
    },
  );
  return { api, events };
}

test("native replacement is scheduled before the old reminder is cancelled", async () => {
  const n = native();
  const note = { ...makeNote(Date.now() + 60_000), notificationId: "old-id" };
  assert.equal(await n.api.syncReminder(note), "new-id");
  assert.equal(n.events[0][0], "schedule");
  assert.equal(n.events[1][1], "old-id");
  assert.equal(n.events[0][1].trigger.date.getTime(), note.reminderAt);
});

test("native permission or scheduling failure preserves the previous reminder", async () => {
  for (const options of [{ granted: false }, { failSchedule: true }]) {
    const n = native(options);
    await assert.rejects(
      n.api.syncReminder({
        ...makeNote(Date.now() + 60_000),
        notificationId: "old-id",
      }),
    );
    assert.equal(n.events.filter(([kind]) => kind === "cancel").length, 0);
  }
});

test("clearing a native reminder cancels its retained identifier", async () => {
  const n = native();
  assert.equal(
    await n.api.syncReminder({
      ...makeNote(undefined),
      notificationId: "old-id",
    }),
    undefined,
  );
  assert.equal(n.events[0][1], "old-id");
});

test("date selection rejects invalid, past, and skipped daylight-saving times", () => {
  const { reminderTimestamp } = load("reminderDate.ts", { Date });
  const day = new Date(2026, 9, 25);
  const now = new Date(2026, 9, 25, 12).getTime();
  assert.equal(
    reminderTimestamp(day, "14", "30", now),
    new Date(2026, 9, 25, 14, 30).getTime(),
  );
  assert.throws(() => reminderTimestamp(day, "24", "00", now), /00:00/);
  assert.throws(() => reminderTimestamp(day, "14", "60", now), /00:00/);
  assert.throws(() => reminderTimestamp(day, "", "00", now), /00:00/);
  assert.throws(() => reminderTimestamp(day, "11", "00", now), /future/);
  assert.throws(
    () =>
      reminderTimestamp(
        new Date(2026, 2, 29),
        "02",
        "30",
        new Date(2026, 2, 28).getTime(),
      ),
    /daylight-saving/,
  );
});

test("daily browser reminders deliver once per day and snooze keeps the next repeat", async () => {
  const b = browser();
  await b.api.prepareNotifications();
  const start = new Date(b.now() + 60000);
  start.setSeconds(0, 0);
  const note = { ...makeNote(+start), reminderRepeat: "daily" };
  await b.save([note]);
  await b.advance(+start - b.now());
  assert.equal(b.shown.length, 1);
  const completed = b.now();
  await b.save([
    {
      ...note,
      reminderCompletedAt: completed,
      snoozedUntil: completed + 600000,
    },
  ]);
  await b.advance(600000);
  assert.equal(b.shown.length, 2);
  await b.event("focus");
  assert.equal(b.shown.length, 2);
  await b.advance(86400000);
  assert.equal(b.shown.length, 3);
});

test("trashed and paused reminders never fire", async () => {
  const b = browser();
  await b.api.prepareNotifications();
  await b.save([
    { ...makeNote(b.now() + 1000), deletedAt: b.now() },
    { ...makeNote(b.now() + 1000), id: "paused", notificationId: undefined },
  ]);
  await b.advance(2000);
  assert.equal(b.alerts.length, 0);
});

test("native daily and weekly repeats use calendar triggers; snooze adds a one-off", async () => {
  for (const repeat of ["daily", "weekly"]) {
    const n = native(),
      date = new Date(Date.now() + 3600000);
    await n.api.syncReminder({
      ...makeNote(+date),
      notificationId: undefined,
      reminderRepeat: repeat,
      snoozedUntil: +date + 600000,
    });
    const triggers = n.events
      .filter((e) => e[0] === "schedule")
      .map((e) => e[1].trigger);
    assert.equal(triggers[0].type, repeat);
    assert.equal(triggers[0].hour, date.getHours());
    assert.equal(triggers[0].minute, date.getMinutes());
    if (repeat === "weekly")
      assert.equal(triggers[0].weekday, date.getDay() + 1);
    assert.equal(triggers[1].type, "date");
  }
});

test("native cancellation clears every identifier belonging to a repeated and snoozed reminder", async () => {
  const n = native();
  await n.api.cancelReminder('["repeat-id","snooze-id"]');
  assert.deepEqual(
    n.events.map((e) => e[1]),
    ["repeat-id", "snooze-id"],
  );
});
