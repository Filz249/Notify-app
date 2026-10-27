import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import type { SpeechEngine } from "./dictation";

export function createSpeechEngine(): SpeechEngine {
  const speech = requireOptionalNativeModule<
    typeof ExpoSpeechRecognitionModule
  >("ExpoSpeechRecognition");
  let unavailableReason: string | undefined;
  if (!speech) {
    unavailableReason =
      "Voice notes need an updated Notify app build. They aren’t available in Expo Go.";
  } else if (!speech.isRecognitionAvailable()) {
    unavailableReason =
      "Enable your device’s speech recognition service to use voice notes.";
  }
  return {
    unavailableReason,
    requestPermission: async () =>
      !!(await speech?.requestPermissionsAsync())?.granted,
    createSession: (events) => {
      if (!speech) throw new Error("Speech recognition is unavailable");
      const subscriptions = [
        speech.addListener("start", events.start),
        speech.addListener("end", events.end),
        speech.addListener("error", (event) => events.error(event.error)),
        speech.addListener("result", (event) => {
          const transcript = event.results[0]?.transcript ?? "";
          // Some services finish with an empty result. Keep the last preview
          // so the controller can preserve those words when the session ends.
          if (event.isFinal && !transcript.trim()) return;
          events.result(
            event.isFinal ? [transcript] : [],
            event.isFinal ? "" : transcript,
          );
        }),
      ];
      return {
        start: (language) =>
          speech.start({
            lang: language,
            interimResults: true,
            maxAlternatives: 1,
            // Older Android versions end each utterance; the controller restarts them.
            continuous:
              Platform.OS !== "android" || Number(Platform.Version) >= 33,
            addsPunctuation: true,
            iosTaskHint: "dictation",
            recordingOptions: { persist: false },
          }),
        stop: () => speech.stop(),
        abort: () => speech.abort(),
        dispose: () =>
          subscriptions.forEach((subscription) => subscription.remove()),
      };
    },
  };
}
