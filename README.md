<p align="center"><img src="assets/logo.svg" alt="Notify" width="280"></p>

<p align="center">A cozy notes app that reminds you about what matters.</p>

<p align="center">
  <a href="https://github.com/Filz249/notify/releases/latest/download/Notify.apk"><img src="assets/btn-android.svg" alt="Download for Android" height="56"></a>
  <a href="https://Filz249.github.io/notify/"><img src="assets/btn-web.svg" alt="Open web demo" height="56"></a>
</p>

<p align="center">
  <b>Android</b><br>
  Download the APK, then open it on your Android phone and tap Install.<br>
  If Android asks, allow installs from your browser or file manager.
</p>

## About Notify

Notify is a cozy, autumn-toned notes app that does more than take notes: it reminds you about what matters, lets you sketch, write lyrics, keep shopping lists, schedule events, record voice notes and lock away passwords.

## Features

**Six kinds of notes**
- **Note**: free-form writing
- **Checklist**: to-dos with a progress bar and "clear done"
- **Shopping list**: items with quantity and price, grouped automatically by supermarket aisle (Produce, Dairy, Bakery, Meat, Pantry, Household, Other) with per-aisle subtotals and a running total
- **Lyrics & poems**: serif writing space with Verse / Chorus / Bridge buttons and a line and word count
- **Sketch**: finger drawing with colors, brush sizes, eraser, undo and clear
- **Event**: date and time, with a "notify me" option (at the time, 1 hour or 1 day before)

**Smart reminders**
- Mark any note as important to set a reminder; it defaults to one hour away and is fully editable
- In-app alert, browser notification (when permitted) and vibration when a reminder is due
- Inactivity nudge: an important, unfinished note you haven't touched in 3 days resurfaces at the top
- Follow-up prompt: checking off a task like "Call doctor" offers to create a follow-up reminder for tomorrow at 9:00
- Archive drift: a note untouched for 6 months resurfaces to spark new ideas

**Voice**
- Dictation (voice-to-text) in notes, lyrics and events
- "Speak items" on checklists and shopping lists splits what you say into separate items
- Voice recordings of up to one minute attached to any note, with playback

**Vault**
- Passwords and logins protected by a passphrase you choose
- Encrypted in the browser with AES-GCM (256-bit); the key is derived with PBKDF2-SHA256 (250,000 iterations) and never stored
- Built-in password generator, show/hide and copy buttons
- Locks itself after a minute of inactivity or when you leave the page
- There is no recovery if the passphrase is forgotten

**Look and feel**
- Warm brown palette with a light "latte" theme and a dark "espresso" theme (follows system setting)
- Line icons, a book-style serif for titles, faint botanical leaf pattern in the background
- Tactile touches: pressable cards, round checkboxes that pop, optional click sound and haptics

## Running it

No build step and no dependencies. Open `www/index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000 --directory www
# then visit http://localhost:8000
```

### Host it on GitHub Pages
1. Push this repository to GitHub.
2. Go to **Settings > Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`.
3. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

On a phone, open the hosted link and use **Add to Home Screen** for an app-like experience.

## Data and privacy

Everything is stored in your browser's `localStorage`. Nothing is sent to a server. The only external request is to Google Fonts for typefaces (the app falls back to system fonts if it can't load them).

## Known limitations of this prototype

- Reminders only fire while the page is open; real background notifications need a native app.
- Dictation depends on browser speech recognition support (works in Chrome and Safari).
- `localStorage` is small (about 5 MB), so many recordings or sketches can fill it.
- The vault is real encryption but lives in a web page. Don't store important passwords in it until it is rebuilt natively with the Keychain / Android Keystore and biometric unlock.

## Roadmap

- Native Android and iOS app (React Native with Expo, or Capacitor) with real push and local notifications
- Location-based reminders ("remind me when I arrive at the store")
- Brainstorm mode: infinite canvas of connected text, image and sketch nodes
- Inline converters and math ("120 USD to EUR"), progress trackers and a scratchpad block
- Voice snippets pinned to parts of a sketch
- Ambient soundscapes and key-click sounds
- Sketch rewind scrubber and version history
- Biometric vault unlock and secure file storage

## Tech

Plain HTML, CSS and JavaScript in one file. Uses the Web Crypto API, Web Speech API, MediaRecorder, Notifications and Vibration APIs.

## License

MIT, see [LICENSE](LICENSE).

## Build the Android and iOS apps

This repo is set up with Capacitor so the same code becomes a real app. A GitHub Actions workflow builds a downloadable Android APK for you automatically. See [BUILD.md](BUILD.md) for the step-by-step guide, including iOS.
