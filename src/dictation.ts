export type DictationLanguage = "hr-HR" | "en-US";
export const dictationLanguages = [
  { id: "hr-HR", label: "Hrvatski" },
  { id: "en-US", label: "English" },
] as const;

export type SpeechEvents = {
  start: () => void;
  result: (finals: string[], interim: string) => void;
  error: (code: string) => void;
  end: () => void;
};
export type SpeechSession = {
  start: (language: DictationLanguage) => void;
  stop: () => void;
  abort: () => void;
  dispose: () => void;
};
export type SpeechEngine = {
  unavailableReason?: string;
  requestPermission: () => Promise<boolean>;
  createSession: (events: SpeechEvents) => SpeechSession;
};
export type DictationState = {
  phase:
    | "idle"
    | "requesting"
    | "starting"
    | "recording"
    | "restarting"
    | "stopping";
  interim: string;
  error: string;
};
export const idleDictation: DictationState = {
  phase: "idle",
  interim: "",
  error: "",
};

export function appendDictation(body: string, transcript: string): string {
  const text = transcript.trim();
  if (!text) return body;
  return body + (body && !/\s$/.test(body) ? " " : "") + text;
}

function errorMessage(code: string, language: DictationLanguage): string {
  switch (code) {
    case "not-allowed":
      return "Allow microphone and speech recognition access in your device or browser settings, then tap the microphone again.";
    case "language-not-supported":
      return `${language === "hr-HR" ? "Croatian" : "English"} is unavailable in this device’s speech service. Enable that language in speech settings or try another device.`;
    case "network":
      return "Speech recognition lost its connection. Check your internet connection and tap the microphone to continue.";
    case "audio-capture":
      return "The microphone is unavailable. Close other apps using it and try again.";
    case "service-not-allowed":
      return "Speech recognition is unavailable. Enable your device’s speech service and try again.";
    case "interrupted":
    case "aborted":
      return "Recording was interrupted. Tap the microphone to continue.";
    case "busy":
      return "The speech service is busy. Wait a moment and tap the microphone again.";
    default:
      return "Speech recognition stopped unexpectedly. Your captured text is kept; tap the microphone to continue.";
  }
}

/** Owns one user-controlled recording, spanning any number of OS speech sessions. */
export class DictationController {
  state: DictationState = { ...idleDictation };
  private session: SpeechSession | null = null;
  private listening = false;
  private disposed = false;
  private generation = 0;
  private language: DictationLanguage = "hr-HR";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopWaiters: (() => void)[] = [];
  private quickEnds = 0;

  constructor(
    private engine: SpeechEngine,
    private commit: (text: string) => void,
    private changed: (state: DictationState) => void,
  ) {}

  private update(change: Partial<DictationState>) {
    this.state = { ...this.state, ...change };
    if (!this.disposed) this.changed(this.state);
  }

  private clearTimer() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private keepInterim() {
    const text = this.state.interim.trim();
    if (text) this.commit(text);
    this.update({ interim: "" });
  }

  private finish() {
    this.clearTimer();
    this.keepInterim();
    this.update({ phase: "idle" });
    this.stopWaiters.splice(0).forEach((resolve) => resolve());
  }

  async start(language: DictationLanguage) {
    if (this.disposed || this.state.phase !== "idle") return;
    if (this.engine.unavailableReason) {
      this.update({ error: this.engine.unavailableReason });
      return;
    }
    this.language = language;
    this.listening = true;
    this.quickEnds = 0;
    const generation = ++this.generation;
    this.update({ phase: "requesting", error: "", interim: "" });
    try {
      const granted = await this.engine.requestPermission();
      // A late permission response must never reopen the microphone after Stop/navigation.
      if (!this.listening || this.disposed || generation !== this.generation)
        return;
      if (!granted) {
        this.fail("not-allowed");
        return;
      }
      this.beginSession();
    } catch {
      if (generation === this.generation && !this.disposed)
        this.fail("unknown");
    }
  }

  private beginSession() {
    if (!this.listening || this.disposed) return;
    this.clearTimer();
    this.update({ phase: "starting" });
    const startedAt = Date.now();
    let gotResult = false;
    let session: SpeechSession;
    const current = () => !this.disposed && this.session === session;
    const end = () => {
      if (!current()) return;
      this.clearTimer();
      session.dispose();
      this.session = null;
      this.keepInterim();
      if (!this.listening) {
        this.finish();
        return;
      }
      // Silence/time limits are normal. Rapid repeated failures indicate a broken service.
      this.quickEnds =
        !gotResult && Date.now() - startedAt < 1500 ? this.quickEnds + 1 : 0;
      if (this.quickEnds >= 3) {
        this.fail("service-not-allowed");
        return;
      }
      this.update({ phase: "restarting" });
      this.timer = setTimeout(() => this.beginSession(), 350);
    };
    try {
      session = this.engine.createSession({
        start: () => {
          if (!current()) return;
          if (!this.listening) {
            session.stop();
            return;
          }
          this.clearTimer();
          this.update({ phase: "recording" });
        },
        result: (finals, interim) => {
          if (!current()) return;
          for (const text of finals) {
            if (text.trim()) {
              gotResult = true;
              this.commit(text.trim());
            }
          }
          if (interim.trim()) gotResult = true;
          this.update({ interim: interim.trim() });
        },
        error: (code) => {
          if (!current()) return;
          if (code === "no-speech" || code === "speech-timeout") {
            // Usually followed by end. Recover even if a speech service omits that event.
            this.clearTimer();
            this.timer = setTimeout(() => {
              if (!current()) return;
              end();
              try {
                session.abort();
              } catch {
                /* Already ended. */
              }
            }, 1000);
          } else if (!this.listening && code === "aborted") {
            end();
          } else {
            this.fail(code);
          }
        },
        end,
      });
      this.session = session;
      this.timer = setTimeout(() => this.fail("service-not-allowed"), 20000);
      session.start(this.language);
    } catch {
      this.fail("unknown");
    }
  }

  private releaseSession() {
    const session = this.session;
    this.session = null; // Ignore late native callbacks, including abort's error/end events.
    if (session) {
      session.dispose();
      try {
        session.abort();
      } catch {
        /* Already released by the OS. */
      }
    }
  }

  private fail(code: string) {
    this.listening = false;
    this.releaseSession();
    this.update({ error: errorMessage(code, this.language) });
    this.finish();
  }

  /** Resolves only after final text is committed, so Save/Back can flush the draft safely. */
  stop(): Promise<void> {
    this.listening = false;
    ++this.generation;
    if (this.state.phase === "idle") return Promise.resolve();
    const done = new Promise<void>((resolve) => this.stopWaiters.push(resolve));
    if (this.state.phase === "stopping") return done;
    this.clearTimer();
    if (!this.session) {
      this.finish();
      return done;
    }
    this.update({ phase: "stopping" });
    this.timer = setTimeout(() => {
      this.releaseSession();
      this.finish();
    }, 2500);
    try {
      this.session.stop();
    } catch {
      this.releaseSession();
      this.finish();
    }
    return done;
  }

  dispose() {
    this.listening = false;
    this.disposed = true;
    ++this.generation;
    this.releaseSession();
    this.finish();
  }
}
