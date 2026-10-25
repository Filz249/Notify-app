const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
process.env.TZ = "Europe/Zagreb";
function load(file, globals = {}, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      console,
      require: (n) => {
        if (!(n in imports)) throw Error(n);
        return imports[n];
      },
      ...globals,
    },
  );
  return exports;
}
const note = (change = {}) => ({
  id: "n1",
  type: "note",
  title: "An idea",
  body: "Keep this",
  important: false,
  color: "#F2B23D",
  createdAt: 1,
  updatedAt: 2,
  items: [],
  sketchPaths: [],
  ...change,
});
const plain = (x) => JSON.parse(JSON.stringify(x));
const date = (month, day, hour = 10, minute = 0) =>
  +new Date(2026, month - 1, day, hour, minute);
const recurrence = load("recurrence.ts", { Date });
const backup = load("backup.ts", { Date });
const sketch = load("sketch.ts");

test("daily and weekly reminders keep local wall time across daylight saving", () => {
  const daily = note({ reminderAt: date(10, 24, 9), reminderRepeat: "daily" });
  assert.equal(recurrence.occurrence(daily, date(10, 24, 10)), date(10, 25, 9));
  assert.equal(
    recurrence.occurrence(daily, date(10, 25, 10), "latest"),
    date(10, 25, 9),
  );
  assert.equal(
    recurrence.occurrence(
      { ...daily, reminderRepeat: "weekly" },
      date(10, 24, 10),
    ),
    date(10, 31, 9),
  );
  assert.equal(
    recurrence.repeatStart(
      "weekly",
      new Date(2026, 9, 25),
      "09",
      "00",
      date(10, 25, 10),
    ),
    date(11, 1, 9),
  );
  assert.equal(
    recurrence.repeatStart("daily", new Date(), "09", "00", date(10, 24, 10)),
    date(10, 25, 9),
  );
  assert.throws(
    () => recurrence.repeatStart("daily", new Date(), "27", "00"),
    /time/,
  );
});

test("agenda separates overdue, future, unfinished, completed, trashed and paused notes", () => {
  const now = date(10, 25, 12),
    active = { notificationId: "active" };
  assert.equal(
    recurrence.matchesAgenda(
      note({ ...active, reminderAt: date(10, 24) }),
      "today",
      now,
    ),
    true,
  );
  assert.equal(
    recurrence.matchesAgenda(
      note({ ...active, reminderAt: date(10, 26) }),
      "upcoming",
      now,
    ),
    true,
  );
  assert.equal(
    recurrence.matchesAgenda(
      note({ reminderAt: date(10, 26) }),
      "upcoming",
      now,
    ),
    false,
  );
  assert.equal(
    recurrence.matchesAgenda(
      note({
        ...active,
        reminderAt: date(10, 24),
        reminderCompletedAt: date(10, 25),
      }),
      "today",
      now,
    ),
    false,
  );
  assert.equal(
    recurrence.matchesAgenda(
      note({ ...active, reminderAt: date(10, 24), deletedAt: 1 }),
      "today",
      now,
    ),
    false,
  );
  assert.equal(
    recurrence.matchesAgenda(
      note({ type: "todo", items: [{ id: "i", text: "Try", checked: false }] }),
      "today",
      now,
    ),
    true,
  );
  assert.equal(
    recurrence.matchesAgenda(
      note({ type: "todo", items: [{ id: "i", text: "Try", checked: true }] }),
      "today",
      now,
    ),
    false,
  );
  assert.equal(
    recurrence.agendaAt(
      note({
        ...active,
        reminderAt: date(10, 24),
        reminderRepeat: "daily",
        reminderCompletedAt: now,
        snoozedUntil: now + 600000,
      }),
      now,
    ),
    now + 600000,
  );
});

test("backup round trip preserves content and organization while stripping notification identifiers", () => {
  const original = note({
    collection: "Work",
    tags: ["design"],
    deletedAt: 100,
    reminderRepeat: "weekly",
    notificationId: "device-specific",
    sketchSize: { width: 400, height: 300 },
    sketchPaths: [
      { path: "M 10 10 L 50 50", width: 3, color: "#ffffff", style: "dotted" },
    ],
  });
  const parsed = backup.parseBackup(
    backup.makeBackup([original], [note({ id: "draft" })]),
  );
  assert.equal(parsed.notes[0].notificationId, undefined);
  assert.equal(parsed.notes[0].deletedAt, 100);
  assert.equal(parsed.notes[0].collection, "Work");
  assert.equal(parsed.drafts[0].id, "draft");
  assert.deepEqual(plain(parsed.notes[0].sketchPaths), original.sketchPaths);
});

test("backup validation rejects malformed files, duplicate IDs and unsafe sketch markup", () => {
  assert.throws(() => backup.parseBackup("{"), /valid/);
  assert.throws(
    () =>
      backup.parseBackup(
        JSON.stringify({ app: "Other", version: 1, notes: [], drafts: [] }),
      ),
    /supported/,
  );
  assert.throws(
    () =>
      backup.makeBackup([note({ items: [{ id: "x", checked: true }] })], []),
    /invalid list/,
  );
  assert.throws(
    () =>
      backup.makeBackup(
        [
          note({
            sketchPaths: [{ path: "<script>", width: 3, color: "#ffffff" }],
          }),
        ],
        [],
      ),
    /invalid sketch/,
  );
  assert.throws(
    () => backup.parseBackup(backup.makeBackup([note(), note()], [])),
    /duplicate/,
  );
});

test("import skips identical records and preserves conflicting notes and drafts as separate copies", () => {
  const old = note(),
    incoming = backup.parseBackup(
      backup.makeBackup([old], [note({ id: "draft", body: "Imported" })]),
    );
  let id = 0;
  let plan = backup.planImport(incoming, [old], [], () => `copy-${++id}`);
  assert.equal(plan.notes.length, 0);
  assert.equal(plan.drafts.length, 1);
  const existingDraft = note({ id: "draft", body: "Local" });
  plan = backup.planImport(
    incoming,
    [note({ body: "Changed locally" })],
    [existingDraft],
    () => `copy-${++id}`,
  );
  assert.notEqual(plan.notes[0].id, old.id);
  assert.equal(plan.notes[0].body, "Keep this");
  assert.notEqual(plan.drafts[0].id, existingDraft.id);
  assert.equal(existingDraft.body, "Local");
});

test("draft import keeps the edited draft associated with its imported saved note", () => {
  let id = 0;
  const data = backup.parseBackup(
    backup.makeBackup([note()], [note({ body: "Draft text", updatedAt: 3 })]),
  );
  const plan = backup.planImport(
    data,
    [note({ body: "Unrelated local edit" })],
    [],
    () => `copy-${++id}`,
  );
  assert.equal(plan.notes[0].id, plan.drafts[0].id);
  assert.notEqual(plan.notes[0].id, "n1");
});

test("native draft writes are serialized, and deletion cannot be overtaken by an older write", async () => {
  let value = "[]";
  const drafts = load(
    "drafts.ts",
    {},
    {
      "./storage": {
        getSetting: async () => value,
        setSetting: async (_key, next) => {
          await new Promise(setImmediate);
          value = next;
        },
      },
    },
  );
  const first = drafts.saveDraft(note({ body: "First" })),
    second = drafts.saveDraft(note({ body: "Latest" }));
  await Promise.all([first, second]);
  assert.equal((await drafts.loadDrafts())[0].body, "Latest");
  const pending = drafts.saveDraft(note({ body: "Typing" }));
  const deleted = drafts.removeDraft("n1");
  await Promise.all([pending, deleted]);
  await drafts.flushDrafts();
  assert.deepEqual(JSON.parse(value), []);
});

test("web drafts persist before saveDraft returns and keep separate drafts", async () => {
  const data = new Map();
  const drafts = load("drafts.web.ts", {
    localStorage: {
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
    },
  });
  const pending = drafts.saveDraft(note());
  assert.equal(JSON.parse([...data.values()][0])[0].body, "Keep this");
  await pending;
  await drafts.saveDraft(note({ id: "other" }));
  await drafts.removeDraft("n1");
  assert.equal((await drafts.loadDrafts())[0].id, "other");
});

test("concurrent web saves and batch import retain unrelated notes", async () => {
  const data = new Map();
  const storage = load("storage.web.ts", {
    localStorage: {
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
    },
    window: { dispatchEvent() {} },
    Event: class {},
  });
  await Promise.all([
    storage.saveNote(note()),
    storage.saveNote(note({ id: "other" })),
  ]);
  await storage.saveNotes([note({ id: "imported" })]);
  assert.equal((await storage.loadNotes()).length, 3);
});

test("eraser hits stroke segments and leaves nearby unrelated strokes intact", () => {
  const paths = [
    { path: "M 0 0 L 100 100", width: 4, color: "#ffffff", style: "solid" },
    { path: "M 0 60 L 100 60", width: 3, color: "#ffffff", style: "solid" },
  ];
  assert.deepEqual(plain(sketch.eraseAt(paths, 30, 30, 3)), [paths[1]]);
  assert.equal(sketch.eraseAt(paths, 200, 200, 3).length, 2);
  assert.equal(sketch.eraseAt(paths, 0, 0, 3).length, 1);
});

test("sketch export retains dimensions, background and stroke style and escapes markup", () => {
  const svg = sketch.sketchSvg(
    note({
      sketchSize: { width: 320, height: 420 },
      sketchBackground: "#ffffff",
      sketchPaths: [
        { path: "M 0 0 L 50 50", width: 4, color: "#123456", style: "dotted" },
      ],
    }),
  );
  assert.match(svg, /width="320" height="420"/);
  assert.match(svg, /fill="#ffffff"/);
  assert.match(svg, /stroke-dasharray="1 6"/);
  assert.doesNotMatch(
    sketch.sketchSvg(note({ sketchBackground: '" onload="bad' })),
    /fill="" onload/,
  );
});

test("reimporting a conflicting backup recognizes the previously imported copy", () => {
  let id = 0;
  const data = backup.parseBackup(backup.makeBackup([note()], [])),
    local = note({ body: "Local version" });
  const first = backup.planImport(data, [local], [], () => `copy-${++id}`);
  const second = backup.planImport(
    data,
    [local, ...first.notes],
    [],
    () => `copy-${++id}`,
  );
  assert.equal(first.notes.length, 1);
  assert.equal(second.notes.length, 0);
  assert.equal(local.body, "Local version");
});

test("a skipped spring clock hour does not shift subsequent daily or weekly reminders", () => {
  const anchor = note({
    reminderAt: date(3, 28, 2, 30),
    reminderRepeat: "daily",
  });
  assert.equal(
    recurrence.occurrence(anchor, date(3, 29, 12)),
    date(3, 30, 2, 30),
  );
  assert.equal(
    recurrence.occurrence(
      { ...anchor, reminderRepeat: "weekly" },
      date(3, 29, 12),
      "latest",
    ),
    date(3, 28, 2, 30),
  );
  assert.equal(
    recurrence.repeatStart(
      "daily",
      new Date(2026, 2, 29),
      "02",
      "30",
      date(3, 29, 0),
    ),
    date(3, 30, 2, 30),
  );
});

const organization = load("organization.ts");
test("each built-in collection routes a plain note to its matching library category without changing its format", () => {
  for (const name of organization.COLLECTIONS) {
    const original = note(),
      assigned = {
        ...original,
        ...organization.organizationChange(
          original,
          ` ${name.toLowerCase()} `,
          ["keep"],
        ),
      };
    assert.equal(assigned.collection, name);
    assert.equal(assigned.type, "note");
    assert.equal(
      organization.matchesCategory(assigned, name.toLowerCase()),
      true,
    );
    assert.deepEqual(plain(assigned.tags), ["keep"]);
  }
});
test("typed task and creative notes keep their format filters when assigned a personal collection", () => {
  assert.equal(
    organization.matchesCategory(
      note({ type: "shopping", collection: "Personal" }),
      "tasks",
    ),
    true,
  );
  assert.equal(
    organization.matchesCategory(
      note({ type: "sketch", collection: "Personal" }),
      "creative",
    ),
    true,
  );
  assert.equal(
    organization.matchesCategory(
      note({ type: "sketch", collection: "Personal" }),
      "personal",
    ),
    true,
  );
  assert.equal(
    organization.matchesCategory(note({ collection: "Work" }), "personal"),
    false,
  );
});
test("Important collection and star agree, and unmarking preserves content and other collections", () => {
  const assigned = {
    ...note(),
    ...organization.organizationChange(note(), "Important", []),
  };
  assert.equal(assigned.important, true);
  const unmarked = organization.withImportance(assigned, false);
  assert.equal(organization.matchesCategory(unmarked, "important"), false);
  assert.equal(unmarked.body, assigned.body);
  assert.equal(
    organization.withImportance(
      note({ important: true, collection: "Personal" }),
      false,
    ).collection,
    "Personal",
  );
});

test("draft organization updates saved-note filters without publishing unfinished text or reminders", () => {
  const saved = note({
    collection: "Creative",
    tags: ["old"],
    reminderAt: 100,
    notificationId: "scheduled",
  });
  const draft = note({
    collection: "Personal",
    tags: ["home"],
    body: "Unfinished edit",
    reminderAt: 200,
    notificationId: undefined,
  });
  const entries = organization.libraryNotes([saved], [draft]);
  assert.equal(entries.length, 1);
  assert.equal(organization.matchesCategory(entries[0], "personal"), true);
  assert.equal(organization.matchesCategory(entries[0], "creative"), false);
  assert.deepEqual(plain(entries[0].tags), ["home"]);
  assert.equal(entries[0].body, saved.body);
  assert.equal(entries[0].reminderAt, saved.reminderAt);
  assert.equal(entries[0].notificationId, saved.notificationId);
  const removed = organization.withDraftOrganization(
    saved,
    note({ collection: "", tags: [] }),
  );
  assert.equal(organization.matchesCategory(removed, "creative"), false);
  assert.deepEqual(plain(removed.tags), []);
});

test("new personal drafts appear once in the library and trashed notes stay excluded", () => {
  const draft = note({
    id: "personal-draft",
    type: "todo",
    collection: "Personal",
  });
  const trashed = note({ id: "trashed", deletedAt: 100 });
  const entries = organization.libraryNotes(
    [note(), trashed],
    [draft, { ...trashed, deletedAt: undefined }],
  );
  assert.equal(entries.length, 2);
  assert.deepEqual(
    plain(
      entries
        .filter((n) => organization.matchesCategory(n, "personal"))
        .map((n) => n.id),
    ),
    [draft.id],
  );
  assert.equal(organization.matchesCategory(draft, "tasks"), true);
  assert.equal(organization.libraryNotes([draft], [draft]).length, 1);
});

test("quote backups preserve the author and restore into the Creative category", () => {
  const quote = note({
    type: "quote",
    title: "",
    body: "Words worth keeping.",
    quoteAuthor: "Sample author",
  });
  const restored = backup.parseBackup(backup.makeBackup([quote], [])).notes[0];
  assert.equal(restored.type, "quote");
  assert.equal(restored.quoteAuthor, "Sample author");
  assert.equal(restored.body, quote.body);
  assert.equal(organization.matchesCategory(restored, "creative"), true);
  assert.throws(
    () => backup.makeBackup([note({ type: "quote", quoteAuthor: 42 })], []),
    /author/,
  );
});
test("quote imports preserve different attributions as distinct versions", () => {
  const local = note({ type: "quote", quoteAuthor: "First author" });
  const imported = backup.parseBackup(
    backup.makeBackup(
      [note({ type: "quote", quoteAuthor: "Second author" })],
      [],
    ),
  );
  const plan = backup.planImport(
    imported,
    [local],
    [],
    () => "different-author",
  );
  assert.equal(plan.notes.length, 1);
  assert.equal(plan.notes[0].quoteAuthor, "Second author");
  assert.equal(local.quoteAuthor, "First author");
});
test("entering an author before the quotation still creates a recoverable draft", async () => {
  const data = new Map();
  const drafts = load("drafts.web.ts", {
    localStorage: {
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
    },
  });
  await drafts.saveDraft(
    note({ type: "quote", title: "", body: "", quoteAuthor: "Sample author" }),
  );
  assert.equal((await drafts.loadDrafts())[0].quoteAuthor, "Sample author");
});
