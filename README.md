# Manifester

**A tiny calm garden for your intentions.**

Write or paste the words you want to hear, choose a voice, and let them loop over
gentle ambient sound for as long as you like. Manifester runs entirely in your
browser, works offline, and installs to your phone's home screen like a normal
app.

**Live site → <https://cvree.github.io/Manifester/>**

---

## Put it on your phone

### iPhone and iPad

1. Open <https://cvree.github.io/Manifester/> in **Safari** (only Safari can add
   to the home screen on iOS).
2. Tap the **Share** button.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

### Android

1. Open the site in **Chrome**.
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**).
3. Confirm.

### Desktop

In Chrome or Edge, use the install icon at the right-hand end of the address bar.

The app also offers an **Install** button automatically wherever the browser
supports it, and the full instructions live on the **About** screen inside the
app.

---

## What it does

**Create**

- A large text box that takes anything from one line to a twenty-minute script.
- Long text is split into short passages behind the scenes so browsers do not cut
  it off part-way through, then spoken end to end.
- Title your loop and save it.
- Session length: 5, 10, 20, 30 minutes, a custom value up to 8 hours, or "until
  I stop".

**Voice**

- Two headline choices — **feminine** and **masculine** — each showing the
  actual voice it resolves to on this device.
- Every voice the device offers is **scored by quality** and the best one wins
  automatically. Modern neural voices (Microsoft *Natural*, Google, Apple
  *Premium* / *Enhanced*) are ranked far above the legacy formant synths that
  most devices default to, and each is labelled honestly: *Neural*, *Enhanced*,
  *Standard*, or *Basic — robotic, worth avoiding*.
- When the best available voice is a poor one, the app says so and shows the
  exact settings path to download a free neural voice for that platform.
- Uses the device's own speech engine through the Web Speech API — no cloud
  service, no API key, no cost, nothing sent anywhere.
- Speed, pitch, voice volume, and the length of the quiet pause between repeats.
- A "Hear this voice" button so you can audition before you commit.
- An advanced picker for choosing an exact voice, including other languages.

**Player**

- One large play/pause control with a soft breathing animation while it runs.
- A **breathing guide**: a glowing orb that expands as you breathe in and
  settles as you breathe out, with the phase name and a countdown underneath.
  Default 4 seconds in, 6 seconds out — presets for Calm, Even, Box and Unwind,
  plus custom timing for every phase. Optional soft tone and vibration cues at
  each change of phase. It pauses and resumes with the session.
- **Delay between loops**, 0–60 seconds, counted down on screen (*"Next loop in
  6s"*) and frozen exactly where it was if you pause.
- Time remaining, or elapsed time when there is no timer.
- Progress through the current pass, and how many passes you have listened to.
- Voice volume, sound volume, and speed adjust live.
- A mini player follows you to the other tabs while a session is running.
- When the timer ends everything fades out and the screen says *Your loop is
  complete.*

**Download audio**

- Export a loop as a real **MP3** you can put on any phone or player.
- Lengths of 5, 10, 20, 30 or 60 minutes, or anything up to 2 hours.
- The file contains a recording of **your own voice**, repeated with your chosen
  delay, over your background sound, at your volume balance.
- File size shown before you start; progress, cancel, success and error states
  throughout; a WAV fallback if a browser cannot load the MP3 encoder.
- Everything is rendered on your device in a Web Worker, so the app stays
  usable while it works, and nothing is ever uploaded.

**Sounds**

- Two built-in ambiences: **Moon Garden** and **Soft Horizon**.
- Import your own audio (MP3, M4A, WAV, OGG, FLAC — up to 40 MB each).
- Rename, preview, and delete imported sounds.
- Build an ordered playlist, reorder it, and choose repeat-one or repeat-all.

**Saved**

- Every saved loop keeps its text, title, voice, speed, pitch, volumes, timer,
  sound selection, playlist, repeat mode, and dates.
- Play, edit, duplicate, or delete.

**Everywhere**

- Day and night colour themes.
- Full `prefers-reduced-motion` support — every animation is skipped, not just
  shortened.
- Large touch targets, labelled controls, visible focus rings.
- Works offline after the first visit.

---

## The built-in sounds are generated, not sampled

Moon Garden and Soft Horizon are **not audio files**. They are built live in the
Web Audio graph from oscillators, filtered brown noise, and slow LFOs
([`src/lib/ambient.ts`](src/lib/ambient.ts)).

That choice does three useful things: the download stays tiny, the sounds work
offline forever with no cache to miss, and **this repository contains no
third-party audio of any kind**. Nothing was sampled, scraped, or borrowed.

Any other sound you hear is audio you imported yourself. Please only import audio
you have the right to use.

---

## Why the export records your voice instead of the app's

**No web page can capture speech synthesis output.** `SpeechSynthesisUtterance`
is rendered by the operating system straight to the audio device; it never
passes through anything a page can reach. There is no `MediaStream`, no
`AudioNode`, no `MediaRecorder` path to it, in any browser. An exported file
therefore cannot contain the app's spoken voice, and any app claiming otherwise
is either recording your whole screen or sending your text to a server.

So Manifester does the honest thing: it records **your** voice, once, and builds
the file around that. `getUserMedia` plus `MediaRecorder` is a real, supported,
offline path — and for affirmations, hearing yourself is arguably the point.

### How the file is actually made

Rendering an hour of audio in one `OfflineAudioContext` would need about 635 MB
of float samples, which no phone will give you. The work is split instead:

1. **Main thread** renders a *bounded* 90-second background bed with
   `OfflineAudioContext` (Web Audio's offline renderer is many times faster than
   real time) and decodes the voice recording. Both are small.
2. **A Web Worker** then writes the real timeline sample by sample — looping the
   bed through a crossfade so the seam is inaudible, dropping the voice in every
   `recording length + delay` samples — and feeds each block straight into the
   MP3 encoder. Memory stays flat whether the export is 5 minutes or 2 hours.

The mix is scaled so the peak lands near −3 dBFS while keeping the voice-to-music
balance you chose; the in-app balance is tuned for listening *under* a spoken
voice and would otherwise export very quietly.

Encoding is [`@breezystack/lamejs`](https://www.npmjs.com/package/@breezystack/lamejs)
(LGPL-3.0), loaded dynamically inside the worker so it costs nothing until you
actually export. If it fails to load, the worker produces a WAV instead and says
so.

---

## Getting a genuinely good voice

This matters more than any other setting, and it is free.

Every platform ships modern neural voices that are **not installed by default**.
The difference between them and the fallback synthesiser is not subtle — it is
the difference between a person and a robot.

| Platform | Where to get them |
| --- | --- |
| **iPhone / iPad** | Settings → Accessibility → Spoken Content → Voices → English → download one marked **Premium**. Ava, Zoe, Evan, Nathan are all excellent. |
| **Android** | Settings → Accessibility → Text-to-speech output → **Google Speech Services** → install English voice data. |
| **Windows** | Settings → Time & language → Language & region → English → Language options → add **Speech**. Windows 11's **Natural** voices are excellent. Chrome and Edge also offer Google/Microsoft online voices with no install. |
| **Mac** | System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → **Premium** or **Enhanced**. |

Install one and reopen Manifester — it finds it and switches to it
automatically. The same instructions live inside the app, under the voice
picker.

### Why not bundle a neural TTS model?

It was built and measured, and then removed. Kokoro-82M (Apache-2.0) was run
in-browser via ONNX Runtime in a worker: a ~90 MB one-time download, fully
offline afterwards, and it did work — it produced genuinely lovely audio.

The problem was speed. Measured on a 32-core desktop, **with cross-origin
isolation enabled so ONNX Runtime could use threads**, synthesis ran at a real
time factor of **≈3.3× — 3.3 seconds of compute per second of speech**, and the
figure held steady across passage lengths:

```
chars=34   audio=2.6s   render=8.9s    rtf=3.47
chars=127  audio=9.3s   render=30.4s   rtf=3.27
chars=215  audio=14.5s  render=47.3s   rtf=3.26
```

A phone — the device this app is actually for — would be several times slower
again. A ten-minute loop would take the better part of an hour to render before
the first word. Cross-origin isolation also has to be faked through the service
worker on GitHub Pages, which puts the whole app at risk of a COEP failure for a
feature that would not have been usable anyway.

Apple's Premium voices are also neural, are free, run on dedicated hardware, and
keep speaking when the screen locks. Pointing people at those was simply the
better engineering answer.

---

## Privacy

> Your saved loops stay on this device. Manifester does not require an account
> and does not send your text to a server.

- Text, settings, and imported audio live in your browser's own IndexedDB.
- Speech is generated by your device, not by an online service.
- There is no analytics, no tracking, no advertising, no accounts, and no
  backend of any kind.
- Clearing site data for this domain deletes everything, so keep your own copy of
  anything you would hate to lose.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript, strict mode |
| UI | React 19 |
| Build | Vite 8 |
| Routing | React Router 8 (`HashRouter`) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| PWA | `vite-plugin-pwa` (Workbox `generateSW`) |
| Animation | GSAP + `@gsap/react` (`useGSAP`) |
| Smooth scrolling | Lenis (`lenis/react`), on the About screen only |
| Speech | Web Speech API (`SpeechSynthesisUtterance`) |
| Sound | Web Audio API + `HTMLAudioElement` |
| Storage | IndexedDB (hand-rolled wrapper, no dependency) + a little `localStorage` |
| Icons | Original SVG, rasterised at build time with `sharp` |

### Decisions worth explaining

**Vite + React Router instead of the Remix / React Router framework.**
The React Router framework mode expects a server (or a prerender step with real
routes). GitHub Pages serves static files with no rewrite rules, so a path like
`/Manifester/saved` would 404 on refresh or on a shared link. Vite's static build
plus `HashRouter` sidesteps that entirely: `#/saved` always resolves to the one
real document, deep links survive a reload, and the service worker only ever has
one HTML file to cache. A `404.html` fallback is included as a belt-and-braces
redirect for any stray path.

**No Vanta.** Vanta's effects require `three.js`, which would add roughly half a
megabyte and a continuous WebGL render loop to an app whose entire point is to
run quietly on a phone for thirty minutes. Instead
[`CosmicBackground.tsx`](src/components/CosmicBackground.tsx) layers a CSS
gradient wash, slow-drifting radial "aurora" pools (plain gradients, no blur
filters — large blurred elements are the classic way to melt a mobile GPU), and a
small 2D-canvas field of drifting lights that is skipped entirely under reduced
motion or on low-memory / low-core devices.

**No React Bits or Skiper UI packages.** Both were used as *reference* for the
kind of polish worth aiming at. The two effects that survived — a shimmer sweep
across the wordmark and the soft aurora background — are written from scratch in
about forty lines of CSS, which is smaller and easier to reason about than
pulling in a component library for two effects. Layout, spacing, and surface
treatment take their cues from modern refined-minimal design practice (clean
surfaces, generous spacing, restrained type scale) rather than copying any
specific design.

**No web fonts.** Georgia and the system UI stack were chosen deliberately: they
are warm, they are already on the device, and they cost zero bytes and zero
layout shift. The app renders identically on a plane.

**GSAP and Lenis, used sparingly.** GSAP handles one entrance stagger per screen
and the play button's breathing pulse. Lenis is mounted only on the About screen,
which is the one long-scrolling page — it never wraps the player controls. Both
bow out completely when `prefers-reduced-motion` is set.

---

## Local development

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run preview
```

Other scripts:

```bash
npm run typecheck
```

```bash
npm run icons
```

`npm run icons` regenerates every PWA icon and the favicon from the single SVG
motif in [`scripts/generate-icons.mjs`](scripts/generate-icons.mjs). The outputs
are committed, so a plain `npm ci && npm run build` never needs to run it.

### Project layout

```
src/
  components/     design system + composed UI
  routes/         Create, Player, Saved, Sounds, About
  state/          Theme, Library (IndexedDB), Session (playback engines)
  lib/
    speech.ts       chunking, voice loading, the looping speaker
    voiceRanking.ts scores device voices and picks the best of each style
    breathing.ts    pure breath-phase maths
    useBreathing.ts drives the orb from the wall clock
    feedback.ts     haptics and generated interface tones
    recorder.ts     microphone capture for exports
    exportAudio.ts  offline bed rendering, decoding, normalisation
    audio.ts        background sound engine (synth + imported files)
    audioBus.ts     owns the AudioContext and the sound channel
    ambient.ts      the two generated ambiences
    storage.ts      IndexedDB + localStorage
    timer.ts        wall-clock session countdown
    motion.ts       reduced motion, low-power and platform detection
  workers/
    encode.worker.ts  mixes the timeline and encodes MP3/WAV
  styles/
    theme.css     Cosmic Garden Minimal — the whole design system
```

---

## Deployment

Pushing to `main` triggers
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which installs,
type-checks, builds, and publishes `dist/` to GitHub Pages.

One-time repository setup: **Settings → Pages → Build and deployment → Source →
GitHub Actions**.

The Vite `base` is `/Manifester/` so every asset resolves under the repository
sub-path. To deploy somewhere else, override it:

```bash
MANIFESTER_BASE=/ npm run build
```

---

## Browser limitations, honestly

These come from the browser, not from Manifester, and no amount of code makes
them go away:

- **The voice list is the device's.** iPhone, Android, Windows, and Mac each
  offer a different set. Manifester cannot add voices to that list — it can only
  rank what is there and tell you where to download better ones.
- **Style labels are a guess.** There is no gender field in the Web Speech API,
  so feminine / masculine labels are inferred from voice names. Quality tiers
  are inferred the same way, from the naming conventions each platform uses for
  its neural voices.
- **Pitch and volume are sometimes ignored.** On iOS especially, speech usually
  follows the system media volume regardless of the in-app slider. The slider is
  wired to `SpeechSynthesisUtterance.volume`, which is all a web app is given.
- **iPhones stop speech when the screen locks.** Manifester requests a screen
  wake lock during a session, but Low Power Mode and some accessibility settings
  override it. For long sessions, plugging in and leaving the screen on is the
  reliable route.
- **The first tap matters.** Browsers require a genuine user gesture before any
  audio starts. If nothing happens, tap play once more.
- **Long single utterances get truncated** in several engines, which is exactly
  why the text is chunked and re-queued rather than sent in one piece.
- **Private browsing blocks storage.** Saving is disabled and the app says so
  rather than failing quietly.
- **iPhone cannot vibrate from a web app.** `navigator.vibrate` is not
  implemented in Safari at all, so the haptic cues are Android and desktop only.
  The app detects this and disables the toggle with an explanation rather than
  offering something that does nothing. Sound cues work everywhere.
- **Exports take a few minutes for long files.** Encoding runs at roughly five
  to six seconds per minute of audio on a laptop, and slower on a phone. It runs
  in a worker with progress and a cancel button, and the app stays usable
  throughout.
- **Microphone permission is per-site and per-browser.** If you deny it, the
  browser will not ask again until you re-allow it in site settings.

---

## A note on scope and safety

Manifester is a listening tool. It is not advice, treatment, or a promise about
what will happen in anyone's life, and it deliberately avoids that kind of
language. It exists to help someone build a calm ritual around words they chose
for themselves.

There is no third-party audio, no copied artwork, no game or app assets, and no
borrowed UI in this repository. The icon, the ambiences, the colour system, and
the components are original to this project.

---

## Licence

[MIT](LICENSE).
