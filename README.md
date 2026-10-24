# Notify — React Native mobile notes app

Notify is the Android/iOS mobile app project. It is built with **React Native + Expo + TypeScript**, not the older HTML/Capacitor prototype. The existing Notify logo, app icons and splash art in `assets/` are kept and used by the Expo configuration.

## Features in this first mobile iteration

- Local-first notes saved in on-device SQLite.
- Notes, to-do lists, checklists, shopping lists, lyrics, poems, sketches and brainstorm notes.
- Search and feed filters, important-note pinning, deletion and editing.
- Shopping aisle suggestions and price subtotals.
- Touch sketch canvas with persisted strokes.
- Local reminder notifications for one hour from now or tomorrow at 9 AM.
- Espresso backgrounds, cream typography, amber accents and colorful note-type icons.

Location reminders, inactivity reminders, voice-to-structured-list, voice annotations, connected infinite mind maps, soundscapes, version rewind and inline math/code widgets remain future work.

## Run locally

Requirements: Node.js 22.13+ and npm.

```powershell
npm.cmd install
npx.cmd expo install --fix
npm.cmd run start
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` and `npx.cmd` as above. To launch directly in Android Studio/emulator, install Android Studio then run `npm.cmd run android`.

Expo Go compatibility varies with SDK versions. If Expo Go on your phone does not support SDK 57, install a compatible Expo Go build from https://expo.dev/go or use the generated Android APK workflow below.

## Download an Android APK from GitHub Actions

1. Open the repository's **Actions** tab.
2. Select **Build Notify Android APK** and choose **Run workflow** (or push a source change to `main`).
3. When the workflow succeeds, open the run and download the `notify-android-apk` artifact ZIP.
4. Extract the ZIP, transfer `app-debug.apk` to your Android phone, open it and follow Android's install prompt. You may need to allow your browser or file manager to install apps from that source.

The debug APK is for personal testing, not Google Play release. It is built automatically by GitHub Actions and does not require Node.js or Android Studio on the user's PC. The workflow builds the Android app; iOS builds require macOS/Xcode or an EAS cloud build.

## Project layout

- `App.tsx` — mobile screens and interactions
- `src/types.ts` — note model
- `src/storage.ts` — SQLite persistence
- `src/notifications.ts` — scheduled local notifications
- `app.json` — Expo app identity, icons, splash screen and native plugins
- `.github/workflows/android-apk.yml` — Android APK build and artifact upload

## Data note

Notes are saved locally on the device in SQLite. The app has no account/server sync and does not encrypt note contents at this stage, so do not store secrets in it.
