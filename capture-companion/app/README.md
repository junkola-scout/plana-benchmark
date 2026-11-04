# Junkola Capture — desktop companion (Electron)

The always-on-top capture companion for Junkola Hyperspace, as a real app. It floats
**above every other app and on every Space** (macOS "screen-saver" window level, visible over
other apps' fullscreen), so you can jump between browsers, Slack, Preview and Zoom without
losing it. Everything you grab, drop or type is stamped with wall-clock time **and offset from
session start**, so it lines up against the transcript later.

The clickable prototypes (`../capture-desktop.html`, `../../capture-mobile/`) are the design;
this folder is the first working slice of it.

## What works today

| | |
|---|---|
| Floating panel | frameless, always-on-top, all Spaces, excluded from its own grabs (`setContentProtection`) |
| Sessions | start / end from the panel or tray; serials `S-0001…`; first capture auto-starts a "Quick capture" session |
| Grab region | **⌥⇧4** — native screenshot of the display under the cursor, drag a box, pinned at the session offset |
| Grab window | **⌥⇧5** — picker of open windows |
| Grab full screen | **⌥⇧3** |
| Attach files | ⌘O picker, or drag files onto the panel |
| Notes / links | type, ⌘↩ — a pasted URL files as a link |
| Show / hide | **⌥⇧C** or the tray icon |
| Ledger | every item with offset, wall time, size, who; click to open |
| Storage | `~/Library/Application Support/Junkola Capture/sessions/<serial>/` — files + `ledger.json` |
| Full companion | ⤢ opens the desktop prototype (prep / live / record views) in a normal window |

**Not wired yet (stubs):** sending to Hyperspace (`sync` only marks items `queued`), audio
recording / transcript (the phone app or your note-taker owns that for now), multi-device roster,
place-on-timeline. The data model is ready for all of it — see `ledger.json`.

## Run from source

```bash
cd capture-companion/app
npm install
npm start
```

Node 20+ · Electron 33. First grab on macOS prompts for **Screen Recording** permission
(System Settings › Privacy & Security); the panel shows a banner until it's granted.

## Build

```bash
npm run dist:mac     # dmg + zip, universal — run this ON a Mac for a signed-looking build
npm run dist:win
npm run dist:linux
```

Builds done on Linux (like the ones attached in chat) are **unsigned**. On a Mac:

```bash
unzip "Junkola Capture-0.1.0-arm64-mac.zip"
xattr -dr com.apple.quarantine "Junkola Capture.app"
codesign --force --deep -s - "Junkola Capture.app"     # ad-hoc sign (required on Apple Silicon)
open "Junkola Capture.app"
```

For distribution to the team, sign with a Developer ID and notarize (`electron-builder` does it with
`CSC_LINK`/`APPLE_ID` env vars). Until then: ad-hoc + right-click › Open.

## Layout

```
main.js            window, tray, global shortcuts, desktopCapturer, ledger on disk
preload.js         contextBridge API (window.capture.*)
renderer/mini.html the floating panel
renderer/grab.html fullscreen overlay: region drag / window picker, with the session peg
renderer/companion.html  the full desktop prototype, opened by ⤢
shared/            junkola.css + marks (copied from ../../shared so the app is self-contained)
assets/            app icon, tray icons
```

Headless self-test (used in CI-ish checks): `JUNKOLA_SMOKE=/tmp/panel.png npx electron .`
starts a session, adds a note, takes a full-screen grab, screenshots the panel, quits.

## Next

1. Hyperspace ingestion endpoint → real `sync` (ledger + files, resumable).
2. Session identity shared with the phone app (same `S-xxxx`, join code) so phones pin to this clock.
3. Audio: optional mic/system-audio capture for Zoom-style meetings.
4. Calendar match → session title + engagement prefilled.
