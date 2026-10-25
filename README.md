<p align="center">
  <img src="assets/logo.svg" alt="Notify" width="280">
</p>

<p align="center">A cozy notes app that reminds you about what matters.</p>

<p align="center">
  <a href="https://github.com/Filz249/Notify-app/releases/download/android-latest/app-release.apk">
    <img src="assets/btn-android.svg" alt="Download for Android" height="56">
  </a>
</p>

<p align="center">
  <b>Android</b><br>
  Download the APK, then open it on your Android phone and tap Install.<br>
  If Android asks, allow installs from your browser or file manager.
</p>

---

Notify is the Android/iOS mobile app project. It is built with **React Native + Expo + TypeScript**, not the older HTML/Capacitor prototype. The existing Notify logo, app icons and splash art in `assets/` are used by the Expo configuration.

## Features in this first mobile iteration

- Local-first notes saved in on-device SQLite.
- Notes, to-do lists, checklists, shopping lists, lyrics, poems, sketches, brainstorm notes and collected quotes.
- Quote cards with built-in quotation marks and a separate, searchable author field.
- Search, collections and tags, important-note pinning, Today/Upcoming views, editing and recoverable Trash.
- Combined task/checklist notes and dedicated shopping lists with aisle suggestions and price subtotals.
- Touch sketch canvas with preset colors and a custom color wheel, brightness and hex controls, solid/dashed/dotted strokes, multiple widths, canvas backgrounds, stroke eraser, undo/redo and PNG export.
- Compact checklists with progress, expandable additional notes and a date/time reminder picker.
- Three saved appearance themes: Espresso, Midnight and Forest; responsive home layout for different screen sizes.
- Automatic draft recovery, separate from saved notes.
- One-time, daily and weekly local reminders, with 10-minute and 1-hour snooze.
- JSON backups and safe merge imports, including drafts and Trash.
- Settings menu with links to check releases and download the latest Android APK (installation is confirmed by Android).
- Espresso backgrounds, cream typography, amber accents and colorful note-type icons.

Location reminders, inactivity reminders, voice-to-structured-list, voice annotations, connected infinite mind maps, soundscapes, version rewind and inline math/code widgets remain future work.

## Build and download the latest APK

The download button above points to the rolling **Latest build** release. The workflow builds a **standalone release APK** with the JavaScript bundled inside it, so the app does not need Metro or your computer to run. It targets 64-bit ARM Android phones to reduce APK size.

To build it manually:

1. Open the repository's [Actions tab](https://github.com/Filz249/Notify-app/actions).
2. Select **Build Notify Android APK** and choose **Run workflow** (or push a source change to `main`).
3. Wait for the workflow to finish successfully. The APK is uploaded to the release download automatically; the `notify-android-release-apk` artifact ZIP is also available on the run for 14 days.
4. Open the APK link above on your Android phone and follow Android's install prompt. You may need to allow your browser or file manager to install apps from that source.

This is a testing build distributed outside Google Play. iOS builds require macOS/Xcode or an EAS cloud build.

## Run locally

Requirements: Node.js 22.13+ and npm.

```powershell
npm.cmd install
npx.cmd expo install --fix
npm.cmd run start
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` and `npx.cmd` as above. To launch in an Android emulator, install Android Studio and run `npm.cmd run android`.

### Browser preview

```sh
npm install
npm run web
```

Open the localhost URL printed by Expo. The preview uses the same app screens and
stores notes in local browser storage, separately from your phone's SQLite data.
Browser reminders run while Notify is open and resume after a reload. Allow
desktop notifications for system alerts; unsupported browsers or denied permission
use an in-app reminder instead. Closing Notify or suspending the computer can
delay browser reminders until it is opened again. Native scheduled notifications
still need an Android or iOS device to test.

The editor supports plain, lined, and dotted paper, with a reversible clear-text
action. Open **Remember this later** to choose a local date and time. Reminder
changes take effect when the note is saved.

Drafts save while you type and appear in **Continue writing** after reopening.
**Library** keeps saved notes and drafts together. Filters sit below **Your notes**.
**Create** is a separate section with the colored note-format buttons.
**Save** publishes the draft to your library and activates its reminder. Open the
menu beside **Your notes** to switch to Today or Upcoming. Today includes overdue
reminders and unfinished lists without a reminder.

Use **Organize** inside an editor to add a collection or comma-separated tags.
**Settings → Trash & backups** restores deleted notes and exports/imports JSON.
Imports keep existing data: identical records are skipped and conflicts become
separate copies. Imported reminders stay paused until each note is saved. Trash
is kept until explicitly deleted forever. Backup files include note content.

Daily and weekly reminders follow local calendar time. Snoozing one occurrence
keeps the repeating schedule. Native notifications, file selection and sharing
need a new app build and device testing; the added Expo modules are included in
package.json and app.json.

Run `npm test` for reminder scheduling, recurrence, draft persistence, safe backup
merging, agenda filtering, eraser geometry, image markup and color checks.

## Project layout

- `App.tsx` — mobile screens and interactions
- `src/types.ts` — note model
- `src/storage.ts` — SQLite persistence
- `src/notifications.ts` — scheduled local notifications
- `app.json` — Expo app identity, icons, splash screen and native plugins
- `.github/workflows/android-apk.yml` — standalone Android release build and upload

## Data note

Notes are saved locally on the device in SQLite. The app has no account/server sync and does not encrypt note contents at this stage, so do not store secrets in it.
