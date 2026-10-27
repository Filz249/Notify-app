const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

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
    { exports, console, require: (name) => imports[name], ...globals },
  );
  return exports;
}

function setup(options = {}) {
  let now = 10000,
    timerId = 0,
    body = options.body || "",
    prompts = 0;
  const timers = new Map(),
    sessions = [],
    states = [];
  const { DictationController, appendDictation } = load("dictation.ts", {
    Date: { now: () => now },
    setTimeout: (fn, delay) => {
      const id = ++timerId;
      timers.set(id, { fn, at: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  const engine = {
    unavailableReason: options.unavailableReason,
    requestPermission: async () => {
      prompts++;
      return options.permission ? options.permission() : true;
    },
    createSession: (events) => {
      const session = {
        events,
        language: "",
        stops: 0,
        aborts: 0,
        disposed: false,
        start: (language) => {
          session.language = language;
          if (!options.hangStart) events.start();
        },
        stop: () => {
          session.stops++;
        },
        abort: () => {
          session.aborts++;
          events.error("aborted");
          events.end();
        },
        dispose: () => {
          session.disposed = true;
        },
      };
      sessions.push(session);
      return session;
    },
  };
  const controller = new DictationController(
    engine,
    (text) => {
      body = appendDictation(body, text);
    },
    (state) => states.push(state),
  );
  return {
    controller,
    sessions,
    states,
    timers,
    get body() {
      return body;
    },
    get prompts() {
      return prompts;
    },
    advance: (ms) => {
      const target = now + ms;
      while (true) {
        const pending = [...timers]
          .filter(([, value]) => value.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!pending) break;
        const [id, value] = pending;
        timers.delete(id);
        now = value.at;
        value.fn();
      }
      now = target;
    },
  };
}

test("Croatian partial revisions become one final phrase without replacing existing text", async () => {
  const h = setup({ body: "Moje bilješke:\n" });
  await h.controller.start("hr-HR");
  const session = h.sessions[0];
  assert.equal(session.language, "hr-HR");
  session.events.result([], "Želim");
  session.events.result([], "Želim čašu vode");
  assert.equal(h.body, "Moje bilješke:\n");
  session.events.result(["Želim čašu vode."], "");
  session.events.result(["Čujemo se sutra."], "");
  assert.equal(h.body, "Moje bilješke:\nŽelim čašu vode. Čujemo se sutra.");
  const done = h.controller.stop();
  session.events.end();
  await done;
  assert.equal(h.controller.state.phase, "idle");
  assert.equal(h.timers.size, 0);
});

test("Stop waits for the final correction before Save can read the note", async () => {
  const h = setup();
  await h.controller.start("en-US");
  const session = h.sessions[0];
  session.events.result([], "Meet on fry");
  let saved;
  const save = h.controller.stop().then(() => {
    saved = h.body;
  });
  await Promise.resolve();
  assert.equal(saved, undefined);
  session.events.result(["Meet on Friday."], "");
  session.events.end();
  await save;
  assert.equal(saved, "Meet on Friday.");
  assert.equal(session.stops, 1);
});

test("Stop preserves the latest partial if the provider never returns a final or end", async () => {
  const h = setup();
  await h.controller.start("en-US");
  h.sessions[0].events.result([], "Keep these last words");
  const first = h.controller.stop(),
    second = h.controller.stop();
  h.advance(2500);
  await Promise.all([first, second]);
  assert.equal(h.body, "Keep these last words");
  assert.equal(h.sessions[0].aborts, 1);
  assert.equal(h.sessions[0].stops, 1);
  h.sessions[0].events.result(["late duplicate"], "");
  assert.equal(h.body, "Keep these last words");
});

test("silence and platform time limits restart recognition until Stop", async () => {
  const h = setup();
  await h.controller.start("hr-HR");
  h.sessions[0].events.result(["Prva rečenica."], "");
  h.advance(60000);
  h.sessions[0].events.end();
  assert.equal(h.controller.state.phase, "restarting");
  h.advance(350);
  assert.equal(h.sessions.length, 2);
  assert.equal(h.sessions[1].language, "hr-HR");
  h.advance(10000);
  h.sessions[1].events.error("no-speech");
  h.sessions[1].events.end();
  h.advance(350);
  h.sessions[2].events.result(["Druga rečenica."], "");
  const stop = h.controller.stop();
  h.sessions[2].events.end();
  await stop;
  h.advance(60000);
  assert.equal(h.sessions.length, 3);
  assert.equal(h.body, "Prva rečenica. Druga rečenica.");
});

test("silence recovery works when the provider omits end, and Stop cancels restart", async () => {
  const h = setup();
  await h.controller.start("en-US");
  h.advance(10000);
  h.sessions[0].events.error("speech-timeout");
  h.advance(1000);
  assert.equal(h.controller.state.phase, "restarting");
  assert.equal(h.controller.state.error, "");
  await h.controller.stop();
  h.advance(10000);
  assert.equal(h.sessions.length, 1);
});

test("stopping during permission request prevents a late grant from opening the microphone", async () => {
  let grant;
  const h = setup({
    permission: () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  });
  const start = h.controller.start("hr-HR");
  await h.controller.stop();
  grant(true);
  await start;
  assert.equal(h.sessions.length, 0);
  assert.equal(h.controller.state.phase, "idle");
});

test("a permission result from an older request cannot start a newer session", async () => {
  const grants = [];
  const h = setup({
    permission: () => new Promise((resolve) => grants.push(resolve)),
  });
  const first = h.controller.start("hr-HR");
  await h.controller.stop();
  const second = h.controller.start("en-US");
  grants[0](true);
  await first;
  assert.equal(h.sessions.length, 0);
  grants[1](true);
  await second;
  assert.equal(h.sessions.length, 1);
  assert.equal(h.sessions[0].language, "en-US");
});

test("permission denial and unsupported builds do not open a speech session", async () => {
  const denied = setup({ permission: async () => false });
  await denied.controller.start("hr-HR");
  assert.equal(denied.sessions.length, 0);
  assert.match(denied.controller.state.error, /Allow microphone/);
  assert.equal(denied.controller.state.phase, "idle");
  const unavailable = setup({ unavailableReason: "Install a new build." });
  await unavailable.controller.start("en-US");
  assert.equal(unavailable.prompts, 0);
  assert.equal(unavailable.controller.state.error, "Install a new build.");
});

test("duplicate Record presses create only one session and another recording appends", async () => {
  const h = setup();
  await Promise.all([h.controller.start("hr-HR"), h.controller.start("en-US")]);
  assert.equal(h.sessions.length, 1);
  assert.equal(h.prompts, 1);
  h.sessions[0].events.result(["Da."], "");
  const done = h.controller.stop();
  h.sessions[0].events.end();
  await done;
  await h.controller.start("en-US");
  h.sessions[1].events.result(["Yes."], "");
  assert.equal(h.body, "Da. Yes.");
});

test("fatal errors preserve captured words, stop the microphone and never retry silently", async () => {
  for (const code of [
    "network",
    "audio-capture",
    "not-allowed",
    "language-not-supported",
    "interrupted",
  ]) {
    const h = setup();
    await h.controller.start("hr-HR");
    h.sessions[0].events.result([], "Sačuvaj ovo");
    h.sessions[0].events.error(code);
    h.advance(60000);
    assert.equal(h.body, "Sačuvaj ovo", code);
    assert.equal(h.sessions.length, 1, code);
    assert.equal(h.sessions[0].aborts, 1, code);
    assert.equal(h.controller.state.phase, "idle", code);
    assert.ok(h.controller.state.error, code);
  }
});

test("repeated instant session endings stop instead of looping indefinitely", async () => {
  const h = setup();
  await h.controller.start("en-US");
  for (let index = 0; index < 3; index++) {
    h.sessions[index].events.end();
    h.advance(350);
  }
  assert.equal(h.sessions.length, 3);
  assert.equal(h.controller.state.phase, "idle");
  assert.ok(h.controller.state.error);
});

test("a hung microphone startup times out with an actionable error", async () => {
  const h = setup({ hangStart: true });
  await h.controller.start("en-US");
  h.advance(20000);
  assert.equal(h.controller.state.phase, "idle");
  assert.match(h.controller.state.error, /speech service/);
  assert.equal(h.sessions[0].aborts, 1);
});

test("leaving an editor releases its microphone, keeps the partial and ignores stale events", async () => {
  const h = setup();
  await h.controller.start("hr-HR");
  h.sessions[0].events.result([], "Zadnja misao");
  h.controller.dispose();
  const updates = h.states.length;
  h.sessions[0].events.result(["must not enter the next note"], "");
  h.sessions[0].events.end();
  h.advance(60000);
  assert.equal(h.body, "Zadnja misao");
  assert.equal(h.states.length, updates);
  assert.equal(h.sessions[0].disposed, true);
  assert.equal(h.sessions.length, 1);
});

test("browser adapter handles multiple finals, interim revisions and repeated result indexes", () => {
  let recognition;
  class FakeRecognition {
    constructor() {
      recognition = this;
    }
    start() {
      this.onstart();
    }
    stop() {}
    abort() {}
  }
  const { createSpeechEngine } = load("speech.web.ts", {
    isSecureContext: true,
    webkitSpeechRecognition: FakeRecognition,
  });
  const batches = [];
  const session = createSpeechEngine().createSession({
    start() {},
    end() {},
    error() {},
    result: (finals, interim) => batches.push([Array.from(finals), interim]),
  });
  session.start("hr-HR");
  assert.equal(recognition.lang, "hr-HR");
  assert.equal(recognition.continuous, true);
  const result = (text, isFinal) => ({ 0: { transcript: text }, isFinal });
  recognition.onresult({
    resultIndex: 0,
    results: [
      result("Prvo.", true),
      result("Drugo.", true),
      result("Tre", false),
    ],
  });
  recognition.onresult({
    resultIndex: 0,
    results: [
      result("Prvo.", true),
      result("Drugo.", true),
      result("Treće.", true),
    ],
  });
  assert.deepEqual(batches, [
    [["Prvo.", "Drugo."], "Tre"],
    [["Treće."], ""],
  ]);
  session.dispose();
  assert.equal(recognition.onresult, null);
  assert.equal(recognition.onerror, null);
});

test("browser adapter reports unsupported browsers and insecure origins", () => {
  assert.match(
    load("speech.web.ts", { isSecureContext: true }).createSpeechEngine()
      .unavailableReason,
    /browser/,
  );
  assert.match(
    load("speech.web.ts", { isSecureContext: false }).createSpeechEngine()
      .unavailableReason,
    /HTTPS/,
  );
});

test("native adapter uses Croatian/English options, native permissions and older Android fallback", async () => {
  for (const version of [31, 33]) {
    let options,
      permissions = 0,
      removed = 0;
    const handlers = {},
      transcripts = [];
    const speech = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => {
        permissions++;
        return { granted: true };
      },
      addListener: (event, callback) => {
        handlers[event] = callback;
        return {
          remove: () => {
            removed++;
          },
        };
      },
      start: (next) => {
        options = next;
      },
      stop() {},
      abort() {},
    };
    const engine = load(
      "speech.ts",
      {},
      {
        expo: { requireOptionalNativeModule: () => speech },
        "react-native": { Platform: { OS: "android", Version: version } },
      },
    ).createSpeechEngine();
    assert.equal(await engine.requestPermission(), true);
    assert.equal(permissions, 1);
    const session = engine.createSession({
      start() {},
      end() {},
      error() {},
      result: (finals, interim) =>
        transcripts.push([Array.from(finals), interim]),
    });
    session.start("hr-HR");
    assert.equal(options.lang, "hr-HR");
    assert.equal(options.continuous, version >= 33);
    assert.equal(options.recordingOptions.persist, false);
    handlers.result({
      isFinal: false,
      results: [{ transcript: "Sačuvaj zadnje riječi" }],
    });
    handlers.result({ isFinal: true, results: [] });
    assert.deepEqual(transcripts, [[[], "Sačuvaj zadnje riječi"]]);
    session.dispose();
    assert.equal(removed, 4);
  }
});

test("missing native module leaves the rest of the app usable", () => {
  const engine = load(
    "speech.ts",
    {},
    {
      expo: { requireOptionalNativeModule: () => null },
      "react-native": { Platform: { OS: "android", Version: 33 } },
    },
  ).createSpeechEngine();
  assert.match(engine.unavailableReason, /updated Notify app build/);
});
