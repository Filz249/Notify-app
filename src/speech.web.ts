import type { SpeechEngine } from "./dictation";

// Keep the browser adapter independent of the native module and normalize all
// changed results, including events containing multiple finalized utterances.
type BrowserResult = { isFinal: boolean; 0?: { transcript: string } };
type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<BrowserResult>;
      }) => void)
    | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export function createSpeechEngine(): SpeechEngine {
  const browser = globalThis as typeof globalThis & {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  const Recognition =
    browser.SpeechRecognition || browser.webkitSpeechRecognition;
  const unavailableReason = !globalThis.isSecureContext
    ? "Voice notes need a secure connection. Open Notify over HTTPS or localhost."
    : !Recognition
      ? "Voice notes aren’t supported in this browser. Try Chrome, Safari, or the Notify mobile app."
      : undefined;
  return {
    unavailableReason,
    // The browser requests microphone access itself when start() runs.
    requestPermission: async () => true,
    createSession: (events) => {
      if (!Recognition) throw new Error("Speech recognition is unavailable");
      const recognition = new Recognition();
      let committedThrough = 0;
      recognition.onstart = events.start;
      recognition.onend = events.end;
      recognition.onerror = (event) => events.error(event.error);
      recognition.onresult = (event) => {
        const finals: string[] = [];
        const interim: string[] = [];
        for (let index = 0; index < event.results.length; index++) {
          const result = event.results[index];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            if (index >= committedThrough) {
              finals.push(text);
              committedThrough = index + 1;
            }
          } else if (text) interim.push(text);
        }
        events.result(finals, interim.join(" "));
      };
      return {
        start: (language) => {
          recognition.lang = language;
          recognition.interimResults = true;
          recognition.continuous = true;
          recognition.maxAlternatives = 1;
          recognition.start();
        },
        stop: () => recognition.stop(),
        abort: () => recognition.abort(),
        dispose: () => {
          recognition.onstart =
            recognition.onend =
            recognition.onerror =
            recognition.onresult =
              null;
        },
      };
    },
  };
}
