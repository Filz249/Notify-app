import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  DictationController,
  idleDictation,
  type DictationLanguage,
} from "./dictation";
import { createSpeechEngine } from "./speech";
import { getSetting, setSetting } from "./storage";

export function useDictation({
  noteId,
  enabled,
  onText,
}: {
  noteId: string;
  enabled: boolean;
  onText: (text: string, noteId: string) => void;
}) {
  const [state, setState] = useState(idleDictation);
  const [language, setLanguage] = useState<DictationLanguage>("hr-HR");
  const chosenLanguage = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const engine = useMemo(createSpeechEngine, []);
  // Construct in the effect so React's setup/cleanup replay never reuses a disposed controller.
  const controller = useRef<DictationController | null>(null);

  useEffect(() => {
    let mounted = true;
    getSetting("dictation-language", "hr-HR")
      .then((saved) => {
        if (
          mounted &&
          !chosenLanguage.current &&
          (saved === "hr-HR" || saved === "en-US")
        ) {
          setLanguage(saved);
        }
      })
      .catch(console.warn);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const session = new DictationController(
      engine,
      (text) => onTextRef.current(text, noteId),
      setState,
    );
    controller.current = session;
    setState(session.state);
    return () => {
      session.dispose();
      if (controller.current === session) controller.current = null;
    };
  }, [engine, noteId]);

  useEffect(() => {
    if (!enabled) void controller.current?.stop();
  }, [enabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      // Native permission dialogs can temporarily make iOS inactive.
      if (next === "background") void controller.current?.stop();
    });
    const hidden = () => {
      if (document.visibilityState === "hidden")
        void controller.current?.stop();
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", hidden);
    return () => {
      subscription.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  return {
    ...state,
    language,
    unavailableReason: engine.unavailableReason,
    setLanguage: (next: DictationLanguage) => {
      if (controller.current?.state.phase !== "idle") return;
      chosenLanguage.current = true;
      setLanguage(next);
      setSetting("dictation-language", next).catch(console.warn);
    },
    start: () => {
      if (enabled) {
        chosenLanguage.current = true;
        return controller.current?.start(language);
      }
    },
    stop: () => controller.current?.stop() ?? Promise.resolve(),
  };
}

export type DictationControls = ReturnType<typeof useDictation>;
