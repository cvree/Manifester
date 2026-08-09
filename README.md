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

- A **ritual-building workspace**: on a desktop the editor sits on the left and a
  live preview of the finished ritual on the right; on a phone the same pieces
  stack into one focused column.
- The **live preview** breathes with your chosen pattern, cycles your lines the
  way the loop will read them, takes its colour from the ambience you picked, and
  states the voice, sound, length, delay and rhythm in one glance. A *Hear a line*
  button speaks your own first line in your chosen voice.
- **Every tile in that preview is a shortcut**, not a readout: tapping Voice,
  Sound, Delay or Rhythm opens the setting it reports, and Length scrolls to the
  session-length card. The Rhythm tile is shown even when the rhythm is off,
  reading *Off* — otherwise the one setting you could not reach from the shortcut
  panel would be the one you had not turned on yet.
- Only five things stay on screen: title, words, session length, Start and Save.
  Everything else lives in **Customize your ritual** — a list of rows that each
  state their own value (*Moon Garden · 40%*, *Calm · 4 in / 6 out*, *3-second
  delay*) and open in a sheet.
- A large text box that takes anything from one line to a twenty-minute script.
- **A writing helper**, under the starter phrases. *Add to my words* reads what
  you have written — including the title — works out what it is reaching for,
  and appends lines in the same direction. *Improve my words* rewrites what is
  there into the present tense and the first person, turns an avoided feeling
  into the thing you actually want ("I don't want to feel like a failure
  anymore" → "I am learning and growing"), trades wishing for deciding, and
  attaches a felt sense to a line or two. Both are one tap and both are
  undoable.
- **Optionally powered by an AI you bring the key for.** Connect **Gemini**
  with your own free Google key, in a guided flow that spells out every step,
  what it costs, and what Google does with your words. There is one provider
  and no menu: it is free, it needs no payment card, and a single set of
  numbered steps is a better first screen than a choice. Connected,
  the suggestions are written around your actual draft instead of drawn from a
  built-in list — so pressing *Add* repeatedly keeps producing new material
  instead of running dry. It falls back to the offline engine whenever the
  network or the key gives out. See [Privacy](#privacy).
- **A key is checked by using it, never by looking at it.** *Connect* spends one
  very short real request, and the word "connected" means that request came
  back. Nothing is stored until it does. This matters more than it sounds:
  Manifester used to insist a Google key began with `AIza`, and when Google
  moved AI Studio onto [auth keys](https://ai.google.dev/gemini-api/docs/api-key)
  beginning with `AQ.`, every new key in the world was refused before a request
  was ever made. Both formats work now, so will the next one, and the prefix is
  used for at most a friendly note beside the box.
- **The failure tells you what to do about it.** A refused key, a key that is
  not allowed to use the API, a project with the API switched off, a key locked
  to other websites, a spent daily allowance, a model this account cannot have,
  a blocked network, a timeout and a Google outage are nine different sentences,
  not one shrug. Where Manifester can name the fix, it names it. On Gemini it
  also walks down its list of current Flash models rather than blaming a key for
  a model it simply cannot reach today, and the connected screen says which
  model actually answered.
- **Nothing you wrote is ever at risk.** The draft is not touched until a reply
  has come back *and* passed validation; a reply that is malformed, empty, the
  wrong shape, or carrying a promise about health or money is dropped rather
  than spoken. Requests give up after thirty seconds, there is a *Stop* button
  the whole time one is in flight, and if you carry on typing while it thinks,
  the newer words win. *Undo* covers every AI edit exactly as it covers the
  offline ones.
- **The AI is opt-in, and switching it off is a single control.** The same panel
  — a master switch plus the full step-by-step — appears in two places: under
  *Customize → AI writing help* on Create, and on the **About** page, which is
  where people look when they want to know what an app is doing and how to stop
  it. Off means off: nothing is contacted, and the app stops offering to connect
  anything. A saved key is kept but left unused, so changing your mind is one tap
  rather than a second setup.
- Press *Add* or *Improve* without a key and the result says which engine wrote
  it, then offers **Set up an AI** beside **No thanks, hide this**. The offer only
  appears after a real press, and never again once declined.
- **One written line is one spoken line**, so the words on the player are the
  words in your ears. The voice is given a line at a time and reports back the
  moment it starts speaking one; the player shows exactly that text rather than
  guessing from a counter. Only a line too long to say in one breath is split
  further, at sentence, clause and word boundaries in that order — which is
  also what keeps browsers from cutting a long passage off part-way through.
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

- The calmest screen in the app: a large breathing guide, the words being
  spoken, the two controls that matter, and nothing that looks like a mixing
  desk. On a phone the navigation slides away while a session runs, and a strip
  at the bottom edge brings it straight back.
- One large play/pause control, with a smaller *End session* below it.
- **An expanded view**, one tap from the corner of the stage: the player grows
  into the whole screen, the guide grows with it, and the header, the
  navigation and the settings column step back until nothing is left but the
  words, the breath and the controls. It is the same player throughout — the
  session, the clock, the pass count and the audio carry straight on — and the
  way back is the same button, the Escape key, or leaving fullscreen however
  your browser offers to. It is written up under
  [Decisions worth explaining](#decisions-worth-explaining).
- A **breathing guide** in one of six forms, with a thin ring reporting progress
  through the phase, the phase name and a countdown in the centre. Ten patterns,
  five breath voices, and custom timing for every phase — it has a section of
  its own below. It pauses and resumes with the session.
- **A background visualiser**: the whole player becomes a room that expands and
  settles with the guide — light gathering behind the orb, colour and haze at
  three depths, a scattering of pollen, a horizon that opens on the in-breath.
  It runs on the guide's own clock, at a percent or two of scale, and it is on
  by default because at that depth most people feel it before they notice it.
  It can be turned off under **Breathing**, and it is written up below.
- **Delay between loops**, 0–60 seconds, counted down on screen (*"Next loop in
  6s"*) and frozen exactly where it was if you pause.
- Time remaining, or elapsed time when there is no timer.
- Progress through the current pass, and how many passes you have listened to.
- Voice volume, sound volume, and speed adjust live. Voice runs 0–100%, because
  100% is as loud as a browser will ever speak — see
  [Decisions worth explaining](#decisions-worth-explaining).
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

**Library**

Saved loops and sounds share one tab, because they answer the same question —
*what have I got?* A segmented control switches between the two halves, and
which half you are on lives in the URL, so a link to your sounds is still a
link to your sounds.

*Loops*

- Every saved loop keeps its text, title, voice, speed, pitch, volumes, timer,
  sound selection, rain character, brainwave rhythm, playlist, repeat mode, and
  dates. A loop saved before a setting existed loads with it turned off rather
  than failing.
- Play, edit, duplicate, or delete.

*Sounds*

- Five built-in ambiences, all generated live: **Moon Garden**, **Soft
  Horizon**, **Rain on Window**, **Ocean Tide** and **Fireplace Glow**. Each has
  its own preview, a one-line description, a small decorative scene, and a
  "Generated on this device" label.
- **Rain character** — Soft, Steady or Full, changing density, brightness and
  low-end warmth. No thunder at any setting.
- Switching between ambiences **crossfades** over 1.5 s rather than cutting.
- **Brainwave Rhythm** — five optional rhythms at exact rates, off by default.
- Import your own audio (MP3, M4A, WAV, OGG, FLAC — up to 40 MB each).
- Rename, preview, and delete imported sounds.
- Build an ordered playlist, reorder it, and choose repeat-one or repeat-all.

**Everywhere**

- Day and night colour themes.
- **Eight palettes from one palette** — a hue dial on the About screen turns
  every colour in the app at once. The rotation happens in OKLCH, so only the
  hue moves: lightness, chroma, contrast and the spacing between the three
  accents all survive untouched, which is why no position on the dial can look
  worse than the one it shipped with. See
  [Rotating the palette](#rotating-the-palette).
- Full `prefers-reduced-motion` support — every animation is skipped, not just
  shortened.
- Large touch targets (44 px minimum everywhere), labelled controls, visible
  focus rings, a skip link, and no state communicated by colour alone.
- Nothing fixed ever covers a control: the quick-start bar on a phone only
  appears once the real Start button has scrolled away, and the page reserves
  room under the floating navigation and mini-player.
- The install suggestion waits until you have actually started or saved a loop,
  appears once as a small card, and remembers being dismissed. The full
  instructions live on the About screen.
- Original procedural interface sounds and haptics — a tap, a selection tick, a
  rising start tone, a settling pause tone, a save sparkle, a completion chime
  and a quiet error tone — separate from the breath's own voice, which has its
  own instrument and its own level. Sliders never vibrate.
- Works offline after the first visit.

---

## The breathing guide

The guide is the part of Manifester you actually *do*, rather than listen to, so
it gets three kinds of choice: how the breath is shaped, what it looks like, and
what it sounds like. All of it lives under **Breathing**, on both Create and the
Player, and it is a preference rather than a loop setting — you should not have
to re-pick your breathing pattern for every set of words.

### Ten patterns, grouped by what they are for

| | |
| --- | --- |
| **Settle** | Calm (4–6) · Let go (4–8) |
| **Balance** | Even (5–5) · Coherent (5.5–5.5, about six breaths a minute) |
| **Focus** | Box (4–4–4–4) · Triangle (4–4–6) |
| **Sleep** | Unwind (4–7–8) · Deep rest (6–10) |
| **Lift** | Awaken (6–3) · Clear (3–3) |

Custom timing sets each of the four phases independently, in half-second steps —
half a second rather than whole seconds because coherent breathing is 5.5 a
side, and a custom control that cannot reach the preset next to it is a control
that quietly calls itself a liar. Set a phase to zero to skip it.

### Six forms

| Form | What it is |
| --- | --- |
| **Bloom** | Six petals opening from a seed of light |
| **Halo** | One circle and one ring. Nothing else |
| **Ripple** | Rings travelling outward across still water |
| **Aurora** | Slow drifts of colour that gather and part |
| **Constellation** | Stars drawing apart and back into a point |
| **Tide** | A water line rising and falling inside the circle |

The picker shows six live thumbnails rather than six adjectives — each is the
real component at a smaller size, so whatever a form does on its own is a thing
you can watch before you choose it.

### Five voices — the guide with your eyes shut

A visual orb is useless the moment someone closes their eyes, which is exactly
when a breathing exercise starts working. So the sound has to carry the whole
shape of the breath on its own: *rising* to breathe in, *falling* to let go,
*still* through a hold.

Two families do that differently. The **continuous** voices sound through the
whole phase, so at any moment you know not merely that the breath turned but
where in it you are:

- **Ocean** — a wave gathering as you breathe in and drawing back as you let go
- **Hush** — a soft breath alongside yours, brighter going in than coming out
- **Drone** — a warm tone that climbs a fifth on the way in and falls on the way out

The **struck** voices sound once at each turn and then get out of the way, for
people who find a continuous sound intrusive:

- **Chime** — two clear notes, up to breathe in, down to let go
- **Singing bowl** — one struck bowl, with the inharmonic partials that give it
  its shimmer, ringing out into the quiet

Every one is synthesised at the moment it plays; there are no audio files here
either. They run on their own `AudioContext`, separate from the session mix, so
a breath cue can never be caught by a session fade, ducked by the ambience, or
suspended along with the music — and the level is its own slider, independent of
the loop's voice and sound. Auditioning a voice in the settings sheet runs on a
second player, so pressing *hear it* mid-session never disturbs the breath you
are actually following.

Sound is scheduled a phase at a time rather than nudged each frame: the whole
length of the phase is handed to the audio clock the moment it begins. The Web
Audio clock is sample-accurate and the animation clock is not, so this is what
keeps the sound exactly in step even while the main thread is busy laying out a
settings sheet. [`breathAudio.test.ts`](src/lib/breathAudio.test.ts) renders
every voice offline and measures it — that the in-breath really does rise, that
the out-breath really does fall, that a struck voice really does clear out
before the next turn — because "some audio came out" would pass just as happily
on a voice that played the same flat hiss both ways.

Vibration is offered separately, where the device supports it. iPhone does not
let web apps vibrate, and the app says so rather than showing a dead switch.

### The room breathes too

**Background visualiser** — the second switch under Breathing, on by default —
turns the whole player into a room that answers to your breath. On the in-breath
the light behind the orb opens, the far field follows a moment later, the haze
separates, the vignette relaxes, the horizon descends a few pixels and the
pollen drifts outward; on the out-breath all of it gathers back in and the
colour goes fractionally warmer. It is deliberately small — a percent or two of
scale and a few percent of light, which is enough to feel and not enough to
watch — and the intended order is that you notice how calm it is well before you
notice that the screen is moving at all.

The one thing worth knowing about it is that the breath does not arrive
everywhere at once. Light near the orb is drawn at *now*; light further out is
drawn from the same curve a quarter and then two thirds of a second earlier, so
an in-breath reads as something travelling outward through the room rather than
as the whole screen changing on one frame. That is also where the echo comes
from: at the top of a full inhale the near light begins contracting while the
lagged one is still open, and the difference between the two is a faint halo
that dissolves over the next second. Nothing is triggered, so nothing can
accumulate.

It rides on the guide's own clock rather than having one of its own, so with the
guide switched off the room is simply still — lit, coloured and deep, but not
moving, because a four-second pulse pretending to be your breathing would be
worse than nothing. Pausing settles it rather than stopping it. Turning the
switch off mid-session settles it too, over about a second, without the breath
underneath ever changing; turning it on wakes it over about 1.2 seconds,
entering *already* at whatever point of the breath you happen to be at.
`prefers-reduced-motion` keeps the whole composition and drops only the
movement. How all of that is wired, and why it can never drift out of step with
the orb, is under [Decisions worth explaining](#decisions-worth-explaining).

---

## The built-in sounds are generated, not sampled

None of the five ambiences are audio files. They are built live in the Web Audio
graph from oscillators, filtered noise and slow LFOs
([`src/lib/ambient.ts`](src/lib/ambient.ts)).

That choice does three useful things: the download stays tiny, the sounds work
offline forever with no cache to miss, and **this repository contains no
third-party audio of any kind**. Nothing was sampled, scraped, or borrowed.

Three ideas hold across all of them:

- **One noise buffer per shape, per context.** A soundscape reads the same few
  seconds of pink or brown noise from a dozen places at different offsets and
  playback rates. Nothing longer than nine seconds is ever generated.
- **Transients are scheduled in a rolling window.** Rain droplets, fire crackles
  and ocean waves are laid onto the audio thread a couple of seconds ahead, so a
  throttled tab cannot change their timing, and stopping cancels everything still
  in flight.
- **Randomness is bounded.** Every random parameter is drawn from a curated range
  with a hard ceiling on gain, so no seed can produce a droplet, crackle or pop
  louder than intended. The ceilings are asserted directly against adversarial
  draws.

Any other sound you hear is audio you imported yourself. Please only import audio
you have the right to use.

---

## Brainwave rhythms

Five optional rhythms, off by default, named after the conventional EEG frequency
bands ([`src/lib/brainwaveAudio.ts`](src/lib/brainwaveAudio.ts)):

| Preset      | Exact target |  Conventional band |   Binaural pair |
| ----------- | -----------: | -----------------: | --------------: |
| Gamma Waves |        40 Hz |          30 – 80 Hz | modulation only |
| Beta Waves  |        20 Hz |          13 – 30 Hz |    190 / 210 Hz |
| Alpha Waves |        10 Hz |           8 – 13 Hz |    195 / 205 Hz |
| Theta Waves |         6 Hz |            4 – 8 Hz |    197 / 203 Hz |
| Delta Waves |         2 Hz |          0.5 – 4 Hz |    199 / 201 Hz |

Band edges differ between clinical and research references, so the app presents
them as conventional ranges rather than universal boundaries. The target rates
themselves are fixed and exact.

On the **Sounds** tab, picking a rhythm starts it playing immediately and picking
*Off* stops it — choosing one and then hunting for a Preview button was two steps
for a single intention. This is safe to do because the handler is reached
synchronously from the tap that chose the preset, which is the only moment a
browser will let an `AudioContext` start. The control that remains is small and
says *Stop the sound*, because by then you are listening to it rather than
previewing it.

Those rates are far below hearing and are never played as pitches. By default a
200 Hz sine carrier is amplitude-modulated at the target rate:

```text
carrier(t)  = sin(2π · 200 · t)
envelope(t) = 0.5 · [1 + sin(2π · targetHz · t)]
output(t)   = gain · carrier(t) · envelope(t)
```

The envelope is an `OscillatorNode` wired into a `GainNode`'s `gain`
`AudioParam` — an audio-rate connection on the rendering thread. No interval, no
frame callback, no restarted oscillator, so a backgrounded tab or a dropped frame
cannot shift the rate. The tests render each preset through a real Web Audio
implementation and measure the cycle rate that actually came out, to within
0.05 Hz.

**Headphone binaural mode** is optional. Each ear receives one tone, hard-split
through a `ChannelMergerNode`, offset symmetrically about 200 Hz so the
difference is exactly the target and the mean is exactly the carrier. Headphones
are genuinely required: a speaker mixes both tones into both ears. Binaural
beating is generally discussed for differences of roughly 1–30 Hz, so 40 Hz Gamma
falls back to amplitude modulation even with headphone mode on, and says so on
screen.

Two rules keep the numbers honest:

- `BRAINWAVE_PRESETS` is the only place a frequency is written down.
- A persisted `targetHz` is never trusted. It is re-derived from the preset id, so
  a stale or hand-edited saved ritual cannot play at some other rate.

Scientific evidence that any of this reliably changes brain activity, or produces
a particular psychological outcome, remains inconsistent. Experiences vary. The
feature is not a medical treatment or a diagnostic tool, and the app says exactly
that wherever it appears.

---

## How the generated sound is mixed

Ambience and rhythm are siblings under one volume, so either can be off without
touching the other ([`src/lib/audioBus.ts`](src/lib/audioBus.ts)):

```text
ambience ─┐
          ├─→ generated (sound volume × makeup) ─→ ceiling ─→ master ─→ output
  rhythm ─┘
```

The spoken affirmation does not pass through here at all — speech synthesis
happens outside the page — so the voice is never squashed and stays the clearest
thing in the mix. That also means **the live voice's loudness is not the app's to
set**: `SpeechSynthesisUtterance.volume` is spec'd to `[0, 1]` and browsers clamp
it there, and on iOS speech follows the ringer or media volume. If the voice
sounds quiet, that is the device, not a setting.

`MUSIC_MAKEUP_GAIN` is a fixed 1.5× boost applied to everything generated, on top
of the user's setting. The mix was originally built conservatively and left most
of its headroom unused, which made the app feel quiet even with the slider at the
top. 1.5 is not a taste call — it is the largest boost that keeps ordinary
listening *entirely inside* the ceiling's linear region, and staying inside it is
what preserves the transparency the binaural path depends on (below). Buying more
volume than that would have quietly degraded the brainwave rhythm.

The ceiling is a fixed soft-clip curve rather than a `DynamicsCompressorNode`. A
compressor is the more musical answer, but how it behaves is up to the engine and
the differences are not small: measured against `node-web-audio-api` it applies
about 2.5 dB of makeup gain below its own threshold where Chrome applies none,
which would make the whole app louder on one engine than another. A waveshaper is
arithmetic. It is exactly the identity below 0.7, and it cannot emit above its own
maximum however much arrives. That linearity is also what lets it sit in the path
of a binaural pair without disturbing the channel separation the beat depends on
— which is precisely why the makeup gain above stops where it does. A test asserts
the exact ratio between a direct path and the bus path, so if the boost ever grows
enough to push ordinary content into the knee, that test fails rather than the
rhythm silently degrading.

Every audible gain change goes through one primitive
([`src/lib/audioParams.ts`](src/lib/audioParams.ts)) that pins the value a ramp
had actually reached before starting a new one. That is what keeps starts, stops,
pauses, preset changes, crossfades and slider drags free of clicks, and there is a
rendered test for each.

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
> and has no server of its own.

- Text, settings, and imported audio live in your browser's own IndexedDB.
- Speech is generated by your device, not by an online service.
- The default writing helper is a table of rewrite rules in
  [`src/lib/wordcraft.ts`](src/lib/wordcraft.ts), not a language model. No API
  call, no key, nothing sent.
- **AI writing help is the one feature that sends anything anywhere, and it is
  off until you turn it on.** While it is connected, pressing *Add to my words*
  or *Improve my words* sends that one loop to the provider whose key you set
  up. Nothing else does — not typing, not saving, not playing a session. The
  key is stored in this browser's IndexedDB, is never bundled into the app, and
  is sent only to the company it belongs to.
- **The key is never shown, logged or exported whole.** Every screen shows it
  masked (`AQ.Ab8••••••••YwZr`), the paste box is a password field, error
  messages quote the provider rather than the credential, and nothing writes it
  to the console. *Disconnect* removes it from the device for good.
- **Requests carry `store: false`**, so the interaction is not kept on Google's
  side for later retrieval, and Manifester never asks for one back.
- **Free costs something, and the setup screen says so before you paste.**
  Google's Gemini [API terms](https://ai.google.dev/gemini-api/terms) say
  unpaid-tier content is used to improve Google products and that human
  reviewers may read it. For a page of private affirmations that is a real
  cost, so it appears in a warning box rather than a footnote. Paying for
  Gemini turns it off — as does being in the UK, Switzerland or the EEA, where
  Google applies the paid terms to the free tier too. If that trade is not one
  you want, leave the feature off: the offline helper is the default and needs
  no key at all.
- **Claude was offered and has been removed.** Not for writing badly — it wrote
  beautifully — but because it wanted a payment card before it would answer,
  and two options turned the first screen into a decision instead of an
  instruction. A key stored from that era can no longer be used for anything
  here, so it is deleted from the device on first load and the panel says so;
  an unusable credential sitting at rest is worse than none.
- **ChatGPT is not offered, and cannot be.** `api.openai.com` sends no
  `Access-Control-Allow-Origin` header, so a browser blocks the request before
  it leaves — verified from the same page where Google answers normally. Supporting it would require a server holding the key, which
  is the infrastructure this design exists to avoid; a public CORS proxy would
  route both the key and the affirmations through a stranger. See the comment
  at the top of [`src/lib/ai/providers.ts`](src/lib/ai/providers.ts).
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
| Smooth scrolling | Lenis (`lenis/react`), on Create and About only |
| Speech | Web Speech API (`SpeechSynthesisUtterance`) |
| Sound | Web Audio API + `HTMLAudioElement` |
| Storage | IndexedDB (hand-rolled wrapper, no dependency) + a little `localStorage` |
| Icons | Original SVG, rasterised at build time with `sharp` |

### Decisions worth explaining

**Vite + React Router instead of the Remix / React Router framework.**
The React Router framework mode expects a server (or a prerender step with real
routes). GitHub Pages serves static files with no rewrite rules, so a path like
`/Manifester/library` would 404 on refresh or on a shared link. Vite's static build
plus `HashRouter` sidesteps that entirely: `#/library` always resolves to the one
real document, deep links survive a reload, and the service worker only ever has
one HTML file to cache. A `404.html` fallback is included as a belt-and-braces
redirect for any stray path.

**Everything but the voice was silent on a phone, and the two reasons were
invisible from a desktop.** The report was exact: the affirmation is spoken
perfectly, and the ambience, the brainwave rhythm and the breath cues are not
there at all. That split is itself the diagnosis — the voice is the one sound in
the app that does *not* go through Web Audio, because speech synthesis renders
outside the page. When only the voice survives, the `AudioContext` is what has
failed. [`audioSession.ts`](src/lib/audioSession.ts) answers both causes.

*The silent switch.* iOS files a page's Web Audio under the `ambient` audio
session category, which the hardware ring/silent switch mutes. `SpeechSynthesis`
goes out over the system speech route and ignores the switch entirely. So a
phone on silent plays the words and nothing around them, and turning the Sound
slider up cannot help, because the mix is being muted after this app is finished
with it. The Audio Session API is the supported answer: declaring `playback`
says this is primary media rather than interface noise — which is what a
thirty-minute affirmation loop honestly is — and it plays through the switch the
way a podcast does. It is claimed when someone asks for sound, never on load,
and it is never widened out of `play-and-record` while the voice recorder holds
the microphone.

*The state the specification does not have.* `AudioContextState` is
`suspended | running | closed`. iOS has a fourth, `interrupted`, which a call,
an alarm, another app taking the audio route or the screen locking can all leave
a context in, and it does not recover on its own. Every resume in this app used
to read `if (state === 'suspended')`, which steps straight past it — so a
session came back from a lock screen with a running clock, a moving orb, a
spoken voice and no sound underneath any of it. Waking now means "not running
and not closed", which covers the states that exist and the one that is not
written down; and the bus is watched by `statechange`, by returning to the page,
and by the next touch, because some interruptions are only clearable from inside
a gesture. Returning to a backgrounded session used to resume the media element
alone, which left every *generated* sound — that is, all five ambiences and the
rhythm — behind on a context nobody had woken.

The one subtlety in that, and it is worth stating because getting it wrong is
silent in the other direction: **pausing a session suspends the bus on
purpose.** A suspended context stops advancing `currentTime`, which is exactly
what lets a paused rhythm resume on the phase it held rather than restart. A
recovery watcher that cannot tell a deliberate pause from an interruption sees
the `statechange` the pause itself caused, helpfully resumes, and the ambience
plays straight through a paused session under a button that says *resume*. So
`keepAwake` takes a predicate saying when the context is *meant* to be running,
and never second-guesses it. Interface tap sounds are woken the same way but
deliberately do **not** claim the playback category — a tap confirmation really
is interface noise, and a phone switched to silent should not be answered with
a beep.

**The voice slider stops at 100%, because that is where the voice stops.**
`SpeechSynthesisUtterance.volume` is spec'd to `[0, 1]` and every browser clamps
it there, because speech synthesis renders outside the page entirely — there is
no Web Audio node to put a gain on. The setting used to run to 2 on the
reasoning that a *recorded* voice mixed into an exported file could use the
headroom even though the spoken one could not. In practice that meant a slider
that read "200%", a readout that agreed with it, and a voice that had not
changed since 100%: the app was making a promise on the browser's behalf that
the browser had no intention of keeping.

The export path did not need it either. `masterGainFor` in
[`exportAudio.ts`](src/lib/exportAudio.ts) normalises the finished mix, so
pushing the voice past 1 there only ever changed its *balance* against the bed —
which is what the Sound slider is for, and that one still runs to 200% because
it has real makeup gain behind it in a graph this app owns. So the ceiling is
now 1 everywhere, `MAX_VOICE_VOLUME` and `LIVE_VOICE_VOLUME_CAP` agree, and a
loop saved under the old ceiling is brought back to 100% by `normaliseSettings`
— the level it had actually been playing at all along.

**The room breathes on the player's clock, not on one of its own.** The player
is wrapped in an atmosphere ([`PlayerAtmosphere.tsx`](src/components/PlayerAtmosphere.tsx))
of seven bands: a warm ground wash, a breathing field of light behind the orb
with a far field trailing it, an echo, three aurora clouds on slow
incommensurable orbits, two haze planes at different depths, eighteen motes with
depth values, and a horizon and vignette that open and deepen with the breath.

The tempting way to build that is a keyframe or an interval — and it is wrong,
because it would agree with the orb for about a minute and then spend the rest
of the session visibly disagreeing with it. Instead `useBreathing` takes a list
of `mirrors`, and writes the breath onto the orb, the stage and the atmosphere
in the same pass of the same `requestAnimationFrame` loop, from the same
`breathStateAt` call. There is one breath in the room and everything in it is
following that one, to the millisecond, because it is the same number.

Four details make it survivable rather than merely correct:

- **Two numbers, kept apart.** `--field` is *is there a live breath* and
  `--mix` is *how much of the room is on show*; every environmental
  calculation is the product of the two. `--e` is rewritten sixty times a
  second and so can never be transitioned, but it is only ever *read*
  multiplied by these, and these change twice a session. Pausing eases
  `--field` to zero over a second and the room glides back to its resting pose
  while the breath simply stops. Switching the visualiser off tweens `--mix` to
  zero and the room fades out of a breath it never stopped following — no
  restart, no jump, no desynchronisation, because the mix has no idea where the
  start of a breath is. That separation is the whole reason the setting is safe
  to touch mid-session, and it is why the mix is four numbers rather than one:
  ground light, colour, points, depth, so the room wakes in the order a room
  wakes in and settles in the reverse.
- **The breath wave is a second sample, not a second animation.** The far
  layers read `expansionAt(now − 0.62s)` — the same pure function, a moment
  earlier. There is no delay line to fill, nothing to keep in sync and nothing
  to restart, and negative time simply wraps into the previous cycle. The echo
  falls straight out of it as `max(0, far − near)`, which is zero for the whole
  in-breath by construction, so it cannot be triggered twice and cannot
  accumulate.
- **Stillness is the derivative, not a special case.** `--m` is the eased
  curve's own slope, so it is exactly zero through a hold and at every turn.
  The breath-driven layers therefore come to rest on their own; `--m` is used
  only to damp the *self-running* drifts to a quarter of their amplitude, so a
  hold does not stop the breath and leave the slow orbits sliding on
  underneath it.
- **Nothing viewport-sized goes behind a `filter: blur()`**, every gradient
  reaches full transparency inside its own element, and no gradient is ever
  *recomputed* per frame — colour temperature is two layers cross-fading rather
  than one layer's stops being re-interpolated, because the first costs a
  composite and the second costs a full-viewport repaint sixty times a second.
  A frame costs the compositor a transform and an opacity on a dozen
  already-promoted layers, and the main thread nothing at all.

The richer layers are dropped on the hardware that cannot afford them, by the
same [`isLowPowerDevice`](src/lib/motion.ts) check the pollen canvas uses, the
motes are drawn only where there is room for them to travel that is not on top
of the words, and `prefers-reduced-motion` holds `--field` at zero — which
stills every breath-driven half at once, including the lagged samples, the echo
and the horizon, since all of them are multiplied by it — and stops the
self-running drifts, leaving the full composition, still lit, holding a pose.
The switch still fades rather than snapping. Reduced motion should still look
designed.

**The field is a place, so it is seeded rather than random.** The eighteen motes
in [`environment.ts`](src/lib/environment.ts) are generated once at module load
from a fixed seed, with their angles stratified — one per equal sector, jittered
inside it — because free placement clumps and a clump of three lights touching
reads as a mistake rather than as a scattering. Depth is drawn cubed, so most of
the field sits well back and only a few points are near enough to have real
presence; a screen where every point is a foreground point has no depth at all.
`Math.random()` would have meant a point of light jumping across the screen
because some unrelated piece of UI state changed, and the room has to be the
same room you left.

**Making the card's orb bigger was not the obvious number.** With the visualiser
on, the player should already feel immersive before anyone presses Expand — so
the orb's *ceiling* goes from 27rem to 34rem while the viewport-height
coefficient stays exactly where it was. That is deliberate. The expanded stage
can offer `95dvh` minus the measured height of the rest of the composition,
which on an ordinary 900px laptop window is a shade under 400px — almost exactly
what `44vh` already comes to. Taking more height for the card there would have
bought a bigger orb in the card at the cost of *shrinking* it on Expand, which
is the one thing expanding must never do. Raising the ceiling instead does
nothing at all on the laptop and a quarter more orb on a tall or large display,
which is precisely where the room to do it actually is. On the screens with no
height to spare, the immersion comes from the light and the softened card edge
instead — and that is what "where available" has to mean when the constraint is
real.

**The orb is measured against the room it has to fit in.** Making the visualiser
bigger is one number; making it bigger *without* pushing the words it introduces
off the bottom of a laptop window is a clamp against viewport height, and making
it bigger without the odd result that *expanding* the stage hands it less room
than the card did is a second constraint on top. So the resting size is
`clamp(min(16rem, 74vw), min(64vw, 44vh), 27rem)` and the expanded size is
whatever is left of the stage once the rest of the composition has taken its
measured share. The two are tuned against each other: from about 780px of
viewport height upward — where the great majority of windows are — the orb is
about a quarter larger than it was in the card, and half again as large as that
when the stage opens.

One thing that cost an afternoon and is worth writing down: **a transformed
child contributes its transformed box to its parent's scrollable overflow.** The
pool of light under the orb breathed by scaling around 1, which meant that for
half of every in-breath it was a percent taller than the stage — and the
expanded stage, which scrolls only as a safety valve, quietly grew a scrollbar
once per breath. Scales inside a scroll container open *up to* 1 rather than
around it, which is the same rule the halo inside the orb already followed.

**No Vanta.** Vanta's effects require `three.js`, which would add roughly half a
megabyte and a continuous WebGL render loop to an app whose entire point is to
run quietly on a phone for thirty minutes. Instead
[`CosmicBackground.tsx`](src/components/CosmicBackground.tsx) builds the Cosmic
Garden from five cheap layers: a twilight wash, a moonlit glow, slow-drifting
radial "aurora" pools (plain gradients, no blur filters — large blurred elements
are the classic way to melt a mobile GPU), two static SVG garden curves, and a
small 2D-canvas field of drifting pollen and fireflies. The canvas is skipped
entirely under reduced motion or on low-memory / low-core devices, and the
pointer parallax only ever binds on a device that reports a fine pointer, so it
never competes with touch scrolling.

Re-evaluated when the player gained its own atmosphere, and again when that
atmosphere became the background visualiser, and the answer did not change.
FOG and CLOUDS are the two effects close enough to Cosmic Garden to be worth
prototyping, and turning either of them down far enough to be tasteful here —
slow, abstract, low-contrast, brand-coloured, and not following the mouse —
leaves an effect doing less than the CSS layers already in place, for half a
megabyte of `three.js` and a WebGL context held open for the length of a
thirty-minute session on a phone. There is also a harder objection now: a Vanta
layer would be running on its own render loop, and the one rule the whole
feature rests on is that there is exactly one clock in this room. The whole
point of this app is to run quietly in a pocket. Vanta earns its place in a hero
section; it does not earn it here.

**Room for other rooms.** `BACKGROUND_MODES` in
[`environment.ts`](src/lib/environment.ts) has one entry, and the type union
names four more that are not built. That is not aspiration left in the code — it
is the shape the thing has to keep. A mode is an id in that list, an entry in
the registry, and a `.player-field--<id>` block in `theme.css` that re-tints or
re-weights the layers already there. It is not a second component, a second
clock or a second set of geometry, and keeping it that way is what makes "one
day, an Aurora mode" a morning's work rather than a rewrite.

**A decorative gradient must reach transparency inside its own element.** This
is the rule the atmosphere is built on, and it is worth stating because
breaking it is subtle and the symptom is not. Each aurora pool used to be a
viewport-sized box with its gradient centre pushed out to the margin — `at 68%
-4%` for the moonlight, `at 86% 30%` for the pool on the right. The gradient was
still at a third of its strength where the box stopped, so the box edge cut
through bright light; drifting the box by ±6% and scaling it to 0.96 then walked
that cut into the viewport as a horizontal wall creeping down from the top and a
vertical one on the right.

A pool is now an oversized blob centred on its own light and faded out by 60% of
the way to its own edge, so its rectangle is invisible by construction: there is
nothing drawn where the element ends, whatever the animation does to it. The
breathing is illumination swelling in place — opacity and a few percent of scale
— rather than a layer travelling across the screen. The only clip left in the
system is the container's, and that one sits exactly on the viewport edge, where
a clip cannot be perceived. The geometry is under "The atmosphere" in
[`theme.css`](src/styles/theme.css); the centres and radii reproduce the
original composition exactly.

**No headless dialog library.** [`Sheet.tsx`](src/components/Sheet.tsx) is the
one modal surface in the app — a bottom sheet on a phone, a centred dialog from
`md` up — with a focus trap, escape handling, scroll locking and focus return in
about sixty lines. A headless UI package would be ~15 kB for behaviour we need
exactly one variant of.

**No animation library for the breathing guide.** Every layer of all six forms
is driven by the same two CSS custom properties (`--e` for expansion, `--p` for
phase progress) that [`useBreathing`](src/lib/useBreathing.ts) writes straight
onto the element each frame. React re-renders once a second, for the countdown,
and never for the animation itself — so the browser only ever composites
transforms, opacity and one dash offset, and adding a seventh form would cost
no JavaScript at all.

**No React Bits or Skiper UI packages.** Both were used as *reference* for the
kind of polish worth aiming at. The two effects that survived — a shimmer sweep
across the wordmark and the soft aurora background — are written from scratch in
about forty lines of CSS, which is smaller and easier to reason about than
pulling in a component library for two effects. Layout, spacing, and surface
treatment take their cues from modern refined-minimal design practice (clean
surfaces, generous spacing, restrained type scale) rather than copying any
specific design.

**No web fonts.** The display face is `ui-serif` first — which resolves to New
York on iOS and macOS, the warmest serif already on the device — then Iowan Old
Style, Palatino and Georgia for everything else; the UI face is the system sans
stack. They cost zero bytes and zero layout shift, and the app renders
identically on a plane.

**Three surface levels, not one pane of glass.** Canvas, elevated panel, and
sunken interactive control, with one `stage` per route for the surface that
defines the screen. The rule this replaces is the one the redesign existed to
fix: when every card shares the same opacity, border, shadow and radius, there is
no hierarchy left for the eye to use.

**Expanded mode is the same player, not a second one.** Tapping *Expand* on the
player adds one class to the stage and tweens its rectangle. Nothing is
portalled, cloned or re-mounted, which is the whole design: the session, the
timer, the pass number, the breathing hook and every audio node are the same
objects they were a moment ago, so growing the box cannot interrupt a word or
reset a count. A separate full-screen player component would have had to be
handed all of that state — and would have got it subtly wrong the first time
the two disagreed.

The work splits along the line of what CSS can actually do.
[`useStageExpansion`](src/lib/useStageExpansion.ts) tweens the *rectangle*,
because a box cannot be transitioned out of a grid cell and into `position:
fixed` — the property that has to change is `position`, and it does not
animate. It measures the stage before the class lands and again after, and GSAP
travels between the two; a slot element holds the stage's place in the page so
nothing behind it shifts. Everything *inside* the box — the spacing, the
padding, the radius, the glass, the size of the words — is transitioned in CSS
on the same duration and the same easing, so the whole composition arrives
together. Both halves are eased at both ends and neither overshoots: it is a
room being opened, not a panel being popped.

The orb grows rather than jumps because `--size` is a *registered* custom
property (`@property`, `syntax: '<length>'`), so it can be transitioned — and
since every layer of every form is measured in `--size`, one transition carries
the petals, the rings, the stars and the water with it. One trap worth naming,
because the symptom does not point at the cause: a registered property's
`initial-value` must be computationally independent, so `15rem` invalidates the
whole `@property` rule and the only sign of it is that the orb snaps.

How large the orb may be is a layout question rather than a drawing one — it
depends on what is left once the title, the line, the transport and the meter
have taken their share — so the expanded stage passes it down as `--stage-orb`
and the visualiser reads it. Three heights of screen get three answers, and a
shallow window tightens the spacing before it shrinks the orb.

**The fullscreen request happens before the animation, not beside it.**
Entering fullscreen is itself a viewport-resizing transition; the first version
of this fired it in parallel with the stage's own CSS/GSAP transition, which
put two compositor-heavy changes on the same frame. On a browser leaning on
software compositing — Chrome with "Use hardware acceleration" switched off —
that combination reached a real renderer crash (`STATUS_ACCESS_VIOLATION`) the
moment someone tapped *Expand*. `useStageExpansion` now waits for
`requestFullscreen()` to settle, one way or the other, before `change(true)`
ever runs — so the stage only ever travels through a viewport that has already
finished changing shape, and the browser's own fullscreen transition and ours
never land on the same frame. `collapse()` does the same in reverse: fullscreen
is exited first, and the shrink starts once that has resolved. Belt and
braces, [`isLowPowerDevice`](src/lib/motion.ts) now also reads the WebGL
renderer string, so a desktop with acceleration disabled in the browser's own
settings is recognised the same way a modest phone already was, and both the
GSAP tween and the CSS transitions on the inside of the box (`.stage--instant`)
are skipped in favour of the state simply arriving — the same fallback already
used for `prefers-reduced-motion`, applied for a different reason.

**GSAP and Lenis, used sparingly.** GSAP handles one entrance stagger per screen,
the player's expansion, and the order things arrive in when the stage opens into
a room — the atmosphere first and slowest, then the title, the words and the
controls, then the fine detail once everything else has come to rest. It is
given only the properties the stylesheet is *not* transitioning: a GSAP tween
and a CSS transition on the same property is a tug of war the transition wins
slowly and visibly.

Lenis is mounted on the two screens that genuinely scroll — Create, which you
move up and down while you work, and About, which is long to read. It never
wraps the player, where there is essentially nothing to scroll, and the two
elements with scrollers of their own (the affirmation editor and a sheet's body)
carry `data-lenis-prevent` so the wheel over them is never taken by the page
behind. One instance at a time, driven through
[`smoothScroll.tsx`](src/lib/smoothScroll.tsx), because two `root` instances
would be two loops fighting over one scroll position. Both bow out completely
when `prefers-reduced-motion` is set — someone who asked for less movement has
not asked for slower movement.

### Rotating the palette

The usual way to let people recolour an app is to ship several palettes and
hope each of them is as good as the first. Manifester ships one, and turns it.

Every colour with a hue worth having is declared twice in
[`src/styles/theme.css`](src/styles/theme.css): once as a `-base` literal — the
colour exactly as it was picked — and once as that literal with a rotation
added to its hue:

```css
--rose: oklch(from var(--rose-base) l c calc(h + var(--hue-shift)) / alpha);
```

Three things make this work rather than merely function:

- **OKLCH.** Lightness there is perceptual and independent of hue, so rotating
  `h` alone cannot make text harder to read or a surface jump forward. Every
  contrast ratio in the app survives the dial.
- **One shared rotation.** Rose, sage and gold move together, so the angles
  between the three accents — the thing that actually makes a palette feel
  designed — are preserved at every stop. The canvas and the aurora move with
  them, which is why the whole screen reads as the light changing rather than
  as a widget being recoloured.
- **`--hue-shift` is a registered `@property`,** so it can be transitioned.
  Picking a colour sweeps the entire app to it over 700 ms instead of cutting.

`.dark` redefines only the `-base` literals, so both themes rotate through the
same block, and the whole mechanism is one number on the root element. The
swatches on the About screen draw themselves with the same expression at their
own rotation, so a swatch cannot drift out of step with what tapping it does.

Relative colour syntax is the entire mechanism and has no sensible polyfill, so
the identity palette is declared first and the rotation lives behind
`@supports`. A browser without it gets the app exactly as designed, and the
dial is simply not offered (`supportsHueShift()` in
[`src/lib/hue.ts`](src/lib/hue.ts)).

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
npm run test
```

```bash
npm run typecheck
```

```bash
npm run icons
```

`npm run icons` regenerates every PWA icon and the favicon from the single SVG
motif in [`scripts/generate-icons.mjs`](scripts/generate-icons.mjs). The outputs
are committed, so a plain `npm ci && npm run build` never needs to run it.

### Tests

`npm run test` runs Vitest against
[`node-web-audio-api`](https://github.com/ircam-ismm/node-web-audio-api), a real
Web Audio implementation for Node. It is a dev dependency only — nothing shipped
imports it — and it is what makes the audio claims checkable rather than
asserted: the tests build the same graph a browser builds, render it, and measure
the result.

- **Frequency.** Every preset's modulation rate is measured from a real render and
  must land within 0.05 Hz of its target, Delta included, over a 30-second render.
  Each binaural channel's pitch is measured separately, which only agrees with the
  intended pair if the channels really are hard-split.
- **Transitions.** `OfflineAudioContext.suspend()` interrupts a render partway
  through so a test can call the production API at the context's own
  `currentTime` — arriving, changing level, changing intensity, interrupting a
  fade, crossfading presets, crossfading soundscapes, moving the master volume —
  and then assert that the largest sample-to-sample jump anywhere never exceeds
  the tone's own slew rate.
- **Ceilings.** Random transient parameters are checked against adversarial draws,
  not just typical ones. The mix ceiling is checked to be the identity across the
  range real listening occupies, and to be unable to emit above full scale when
  twelve loud oscillators are thrown at it.
- **Lifecycle.** Each soundscape is asserted to hold sources open while playing,
  release every one on stop, ignore a second stop, and keep two concurrent
  instances independent.
- **Compatibility.** A loop record written by the previous version — no
  `brainwave` key, no `rainCharacter` — loads with the feature off and everything
  else intact. A tampered `targetHz` is rebuilt from its preset.
- **Words on screen against words in the ear.** The spoken chunks are asserted
  to be exactly the lines the player counts, for short lines, blank lines,
  Windows line endings and a paragraph that has to be split — because the two
  agreeing is the whole feature, and they used to agree only by coincidence.
- **The AI connection**, against a stand-in for `@google/genai`, because the
  interesting behaviour is the decisions and not the network. A modern `AQ.`
  auth key and an older `AIza` key both reach the wire; so does a shape nobody
  has seen before, and no message anywhere tells a person their key has to
  start with anything. Then the failures, one at a time: 400 with
  `API_KEY_INVALID`, 401, 403 for permission, 403 for a disabled API, 403 for a
  website restriction, 429, 404, a request field an older model does not know,
  a blocked `fetch`, a timeout, a deliberate Stop, an empty reply, a malformed
  reply, and a reply held back by a safety filter — each asserted to produce its
  own kind, its own sentence, and its own decision about whether to try the next
  model, hand over to the offline helper, or stop dead. Plus: the draft is never
  touched by a failure, the key round-trips through storage and is genuinely
  gone after a disconnect, and a line promising a cure or a windfall is dropped
  before it can be spoken.

### Project layout

```
src/
  components/     design system + composed UI
    Sheet.tsx             the one modal surface: bottom sheet / centred dialog
    BreathingVisualizer   all six guide forms, plus the phase ring
    PlayerAtmosphere      the room the player breathes in, on the orb's clock —
                          seven bands of light, colour, haze, pollen and depth
    CosmicBackground      the twilight garden behind every screen
    RitualPreview.tsx     the live picture of the finished ritual
    CustomizePanel.tsx    the advanced settings, as summarised rows + sheets
    SettingRow.tsx        one row of that list, stating its own value
    AppearanceSettings    the hue dial and the day/night switch
  routes/         Create, Player, Library (loops + sounds), About
  state/          Theme, Library (IndexedDB), Session (playback engines),
                  Stage (whether the player has taken over the screen)
  lib/
    speech.ts       line-per-utterance chunking, voices, the looping speaker
    voiceRanking.ts scores device voices and picks the best of each style
    breathing.ts    pure breath-phase maths, patterns and forms
    breathAudio.ts  the breath's own synthesised voices
    useBreathing.ts drives the orb — and everything mirroring it — from the
                    wall clock
    environment.ts  the room itself: background modes, how far the breath lags
                    at distance, and the seeded field of motes
    useBackgroundMix.ts   wakes and settles the room, without ever touching
                          the breath underneath it
    useStageExpansion.ts  grows the player into the screen, and back
    smoothScroll.tsx  Lenis on the two screens that genuinely scroll
    feedback.ts     haptics and generated interface tones
    recorder.ts     microphone capture for exports
    exportAudio.ts  offline bed rendering, decoding, normalisation
    audio.ts        background sound engine (synth + imported files)
    audioBus.ts     owns the AudioContext and the generated-sound mix
    audioParams.ts  click-free ramps and the soft-clip ceiling
    ambient.ts      the five generated ambiences
    brainwaveAudio.ts  preset table, frequency maths and the rhythm engine
    storage.ts      IndexedDB + localStorage
    timer.ts        wall-clock session countdown
    motion.ts       reduced motion, low-power, breakpoint and platform detection
    hue.ts          the eight stops on the palette dial, and what they mean
    summaries.ts    the one-line summary of every advanced setting
    engagement.ts   when the install suggestion has been earned
    wordcraft.ts    the offline writing helper: rewrite rules, no model
    ai/
      providers.ts    Gemini: key handling, model fallback, the calls
      errors.ts       failure kinds, recovery wording, timeout vs cancel
      enhance.ts      the two prompts, output validation, offline fallback
      credentials.ts  the key on this device, and how it is masked
      useCredentials.ts  one nullable value, shared by two screens
  workers/
    encode.worker.ts  mixes the timeline and encodes MP3/WAV
  styles/
    theme.css     Cosmic Garden — surfaces, type scale, states, the visualiser
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
- **A phone's silent switch mutes Web Audio, but not speech.** Which is why "the
  words play and nothing else does" is the classic mobile report, and why
  Manifester declares its audio session as `playback` — see below. On an iOS
  version without the Audio Session API, the silent switch still wins and the
  ring/silent switch is the fix.
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
