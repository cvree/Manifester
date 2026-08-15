# Manifester

**A tiny calm garden for your intentions.**

Write or paste the words you want to hear, choose a voice, and let them loop over
gentle ambient sound for as long as you like. It speaks in its own voice — the
same one on every device — keeps every line it has spoken so a loop plays
offline, and installs to your phone's home screen like a normal app.

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

**Returning is intentionally one step.** Manifester restores the most recently
played saved loop on launch, so the common path is open → play. The Library can
export and safely merge a local backup, share a loop in a backend-free link, and
create an optional calendar event. Listening totals stay on the device and are
shown without streaks or goals.


**Create**

- A **ritual-building workspace**: on a desktop the editor sits on the left and a
  live preview of the finished ritual on the right; on a phone the same pieces
  stack into one focused column.
- The **live preview** breathes with your chosen pattern, cycles your lines the
  way the loop will read them, takes its colour from the ambience you picked, and
  states the voice, sound, length, delay and rhythm in one glance. **Start loop**
  and *Hear a line* sit together underneath it — the same question at two sizes,
  and on a desktop it puts the button that acts on what you are looking at in the
  column you are looking at, rather than in the other one.
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

- Two studio voices — **Ivy** (feminine) and **Fen** (masculine) — that sound
  the same on a phone, a tablet and a laptop, so a loop you save reads the same
  way wherever you play it. They are Kokoro-82M, running on this project's own
  service: free, no account, no API key, no metering. See
  [The voice](#the-voice).
- **A line you have heard once plays instantly forever after**, from this
  device, with no connection at all — every clip is cached by a hash of exactly
  what it is.
- Your device's own voices are still there, for anybody who prefers one, and
  they are what reads the words if the studio voice cannot be reached. A session
  never goes quiet because a network did.
- Device voices are **scored by quality** and the best one wins automatically.
  Modern neural voices (Microsoft *Natural*, Google, Apple *Premium* /
  *Enhanced*) are ranked far above the legacy formant synths that most devices
  default to, and each is labelled honestly: *Neural*, *Enhanced*, *Standard*,
  or *Basic — robotic, worth avoiding*. When the best available one is poor, the
  app shows the exact settings path to download a free neural voice for that
  platform.
- Speed, voice volume, and the length of the quiet pause between repeats. Pitch,
  for device voices, which are the only ones it can apply to.
- A "Hear this voice" button so you can audition before you commit.
- An advanced picker for choosing an exact voice, including other languages.

**Player**

- The calmest screen in the app, and now the whole of it: a large breathing
  guide, the words being spoken, the controls that matter, and nothing else at
  all. There used to be a column of settings beside the stage, which made a
  ritual space look like a mixing desk and on a phone put those controls
  *below* a full-height stage where they were clutter without being reachable.
  On a phone the navigation slides away while a session runs, and a strip at
  the bottom edge brings it straight back.
- One large play/pause control, with *Adjust* and *End session* together
  beneath it.
- **Everything else is one tap away, in one place.** *Adjust* opens a single
  sheet in the order things are wanted: the voice and sound faders, then a
  folded *Voice, speed and pitch*, then background sound, brainwave rhythm,
  breathing and haptics, then the way back to the words. Nothing was taken away
  to get there — the sliders are the same live ones and the rows open the same
  sheets — and it is the same one control on a phone, on a desktop, and with
  the stage filling the screen, where a column beside the stage would not exist
  at all. Choosing a row closes the sheet and opens the one it is about, rather
  than stacking a second scrim on the first.
- **An expanded view**, one tap from the corner of the stage: the player grows
  into the whole screen, the guide grows with it, and the header and the
  navigation step back until nothing is left but the
  words, the breath and the controls. It is the same player throughout — the
  session, the clock, the pass count and the audio carry straight on — and the
  way back is the same button, the Escape key, or leaving fullscreen however
  your browser offers to. It is written up under
  [Decisions worth explaining](#decisions-worth-explaining).
- A **breathing guide** in one of eight forms, with a thin ring reporting progress
  through the phase, the phase name and a countdown in the centre. Ten patterns,
  five breath voices, and custom timing for every phase — it has a section of
  its own below. It pauses and resumes with the session.
- **A background visualiser**: the whole screen becomes a room that expands and
  settles with the guide, in one of **six rooms** — **Atmosphere** (light,
  colour and haze gathering behind the orb), **Rings** (a ring of light leaving
  on every in-breath and travelling out across the screen), **Waterline** (an
  ocean filling and draining, with moonlight on the water beneath you),
  **Curtains** (the aurora, fanning down the sky and lifting again),
  **Starfield** (a sky that opens wide as you fill and gathers tight around you
  as you empty), and **Stillness** (one deep field, and nothing else). Or **Drifting**, which moves
  between all six, a minute and a half at a time, crossfading over four seconds.
  Two of the guide's forms — **Ink Cathedral** and **Moonpool** — are places
  rather than shapes, and with this switch on they become the room themselves,
  reaching past the orb to the edges of the screen.
  Every room runs on the guide's own clock, and it is on by default. Whichever
  room you are in, it is drawn as a circle centred on the orb itself —
  measured, not guessed — and nothing in it with an edge ever crosses the orb.
  Rooms are chosen under **Breathing**, where picking one walks you on to the
  next question, and all of it is written up below.
- **Delay between loops**, 0–60 seconds, counted down on screen (*"Next loop in
  6s"*) and frozen exactly where it was if you pause.
- Time remaining, or elapsed time when there is no timer.
- Progress through the current pass, and how many passes you have listened to.
- Voice volume and sound volume adjust live under *Adjust*, and under them a
  **Voice, speed and pitch** disclosure changes who is reading, how fast and
  how high without leaving the player: the running speech loop is re-optioned
  rather than restarted, so each change lands on the next line and the loop
  never breaks step. Voice runs 0–100%, because 100% is as loud as a browser
  will ever speak — see
  [Decisions worth explaining](#decisions-worth-explaining).
- **The background sound, one tap away and live.** A small control sits in the
  corner of the stage opposite *Expand* — including expanded, where it is the
  only thing on the screen besides the words, the breath and the transport. It
  opens one list: silence, every built-in ambience, every sound you have
  imported, and your playlist if you have one. Picking one **crossfades under
  the running loop**: the voice, the clock, the breath and the timer carry
  straight on, and nothing restarts. The same list is a row under *Adjust*,
  and choosing a sound in the Library while a session runs reaches
  it the same way — the days of stopping a session to change what is behind it
  are over.
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
- Available from the loop you are writing *and* from any saved loop, through
  the **⋯** menu on its card — a loop from a month ago is as downloadable as
  the one in front of you, with nothing to load back into Create first.
- **Share** the finished file where the device will take one, which on iOS is
  the useful button of the two: a web app has no downloads folder there, and
  the share sheet puts the MP3 straight into Files, Voice Memos or a message.

**Library**

Saved loops and sounds share one tab, because they answer the same question —
*what have I got?* A segmented control switches between the two halves, and
which half you are on lives in the URL, so a link to your sounds is still a
link to your sounds.

*Loops*

- **Nothing you play is lost.** Starting a session writes it to the library on
  its way to the player, so words you listened to but never got round to saving
  are waiting for you under **Recent plays** when you come back. The last
  twelve are held; older captures fall off the end, and nothing you saved is
  ever pruned.
- **What you saved comes first.** The section is two groups, in one order that
  never changes: **Saved** — the loops somebody pressed Save on — and then
  **Recent plays** beneath them. Pressing **Save** on a captured play promotes
  that same record rather than copying it: it moves up into Saved, keeps its
  dates, and stops ageing out. **Clear recent plays** forgets the whole history
  in one press, and asks first.
- Captures name themselves from their own opening words rather than piling up
  a column of *Untitled loop*, and playing the same words twice refreshes the
  one entry instead of laying down another. Playing a loop you saved only
  stamps it as played — a play never rewrites words you kept, and an unsaved
  edit of a saved loop is captured alongside it, so both survive.
- Every saved loop keeps its text, title, voice, speed, pitch, volumes, timer,
  sound selection, rain character, brainwave rhythm, playlist, repeat mode, and
  dates. A loop saved before a setting existed loads with it turned off rather
  than failing.
- Play or edit from the card, and everything else from one **⋯** menu:
  **Download audio** (the whole export panel, on this loop), **Share the
  words**, **Copy the words**, **Duplicate**, and **Delete** — which still asks
  before it does it.
- The menu knows where it is: a small anchored menu with arrow-key navigation
  on a desktop, and the app's own bottom sheet with thumb-height rows on a
  phone. Sharing uses the device's share sheet, and falls back to the clipboard
  in the browsers that have none.

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
- Every choice on this tab — the sound, the rain character, the playlist, the
  repeat mode, on and off — applies to a session that is already playing,
  crossfading rather than restarting it. Previews still run on a bus of their
  own, so auditioning a sound never disturbs what you are listening to.

**Everywhere**

- Day and night colour themes.
- **Every palette from one palette** — a band you drag on the About screen
  turns every colour in the app at once, through all 360 degrees, with twelve
  named stops one tap away underneath it. The rotation happens in OKLCH, so
  only the hue moves: lightness, chroma, contrast and the spacing between the
  three accents all survive untouched, which is why no position on the dial can
  look worse than the one it shipped with. See
  [Rotating the palette](#rotating-the-palette).
- **A night light**, 0 to 100, on the same screen — a warm tint *multiplied*
  over the finished page rather than laid over it with alpha, so red passes
  untouched, green and blue come down, and every contrast ratio on the page is
  exactly what it was. See [The night light](#the-night-light).
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

### Eight forms

| Form | What it is |
| --- | --- |
| **Bloom** | Six petals opening from a seed of light |
| **Halo** | One circle and one ring. Nothing else |
| **Ripple** | Rings travelling outward across still water |
| **Aurora** | Slow drifts of colour that gather and part |
| **Constellation** | Stars drawing apart and back into a point |
| **Tide** | A water line rising and falling inside the circle |
| **Ink Cathedral** | Ink rising into arches, releasing into vapour as you empty |
| **Moonpool** | Deep water, and an opening onto moonlight widening above you |

The picker shows eight live thumbnails rather than eight adjectives — each is
the real component at a smaller size, so whatever a form does on its own is a
thing you can watch before you choose it.

### Two of them are worlds

The first six are a handful of elements reading two CSS custom properties. That
is the right way to build a shape that opens and closes, and it is why they cost
no JavaScript per frame at all.

The last two are not shapes that open and close. They are places, drawn on a
canvas, and they exist because there is a thing a breathing guide can do that a
shape cannot: make the out-breath *its own event* rather than the in-breath
played backwards.

**Ink Cathedral.** Almost-black space. Luminous pearl-and-gold ink rises through
it as you fill — tendrils that lean, branch and bundle into clustered piers —
and at the springing line they turn into pointed arches that close from both
sides at once toward a keystone that lights as it meets. In the last fifth of
the in-breath the vault arrives: ribs fanning from every keystone to the point
the ceiling gathers at, two soft shafts of light coming down through it, and a
shimmer travelling along the ink.

Then the exhale, which does not retract any of it. The architecture *loosens*:
each strand has its own moment of release, flares brighter as it lets go, comes
away from the structure it was holding and turns into vapour that drifts up and
outward and thins to nothing. At the bottom there is a dark room with a few
motes still in the air, which is where the next breath starts.

**Moonpool.** You are under an impossibly calm dark ocean, looking up at
Snell's window — the circle of sky a diver sees from below. Breathe in and the
opening widens: more stars cross into it, faintest last, so the sky keeps giving
you something the longer you fill. The moonlight spreads, caustics stretch away
from the rim across the underside of the surface, shafts come down through the
water, the haze thins and the dark at the edge of vision draws back. Breathe out
and the ocean closes over you again — the light softening rather than switching
off, until what is left is deep water with a few silver motes suspended in it.

The water does not follow the breath, and the gap is the whole thing. The
opening chases it through a first-order lag, so it is still widening a beat
after you have stopped filling and still open a beat after you have started to
empty. The rim is never a circle either: its radius is a sum of harmonics at
ratios that do not resolve, on a clock of the scene's own. Water that tracked
the breath exactly would read as a circle being scaled — which is what it would
in fact be.

**Never the same twice, and never a different place.** Both worlds keep two
kinds of randomness strictly apart. A *session* seed, fixed for as long as the
tab is open, decides what this cathedral is — how many bays, how far apart, how
high the arches spring, how warm the ink runs — or where this session's moon
hangs and how its stars are scattered. The *breath index* then perturbs that by
a few percent and redraws the branching, the tendrils, the highlights and the
surface. So no two breaths are the same, and every one of them is recognisably
the same place you have been breathing in for ten minutes.

Occasionally the hash lands on something rarer. About one breath in six brings
the cathedral a rose window, a ceiling of constellations, one perfect twin arch,
or a fall of light down the central axis. Moonpool's are rarer still — about one
in twelve — and are a shooting star, a breath of unusual glassy stillness, a
constellation drawn between its stars, a bloom of silver particles, or the moon
drifting across the opening. They arrive when they arrive; a rarity that turns
up on schedule is a feature rather than weather, and weather is the point.

**The reward is at the top of the breath you were asked for.** Nothing of the
vault exists below 78% of an in-breath, and Moonpool's faintest stars cross
their threshold in the last third. That is deliberate, and so is the ceiling:
the curve tops out at the cadence you picked, so finishing the guided inhale
gets you all of it and breathing *harder* than the guide gets you nothing extra.

With the background visualiser on, these two do not sit inside a room — they
*are* the room, drawn out to the edges of the screen, re-centred on the orb and
faded by the same mix as everything else. The room picker says so and steps
aside rather than offering six choices that would change nothing. With
`prefers-reduced-motion` on they hold one half-open pose exactly as the other
six do, and the words, the countdown and the phase ring do the guiding.

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
length of the phase is handed to the audio clock. The Web Audio clock is
sample-accurate and the animation clock is not, so this is what keeps the sound
exactly in step even while the main thread is busy laying out a settings sheet.

It is now handed over *before the phase begins*, and several breaths at a time,
which is what makes the guide survive being ignored — see
[The breath is written down in advance](#the-breath-is-written-down-in-advance).

[`breathAudio.test.ts`](src/lib/breathAudio.test.ts) renders
every voice offline and measures it — that the in-breath really does rise, that
the out-breath really does fall, that a struck voice really does clear out
before the next turn — because "some audio came out" would pass just as happily
on a voice that played the same flat hiss both ways.
[`breathEngine.test.ts`](src/lib/breathEngine.test.ts) then renders a whole
cycle that was scheduled in one go at time zero, with nothing touching the graph
afterwards, which is exactly the situation of a tab nobody is looking at.

Vibration is offered separately, where the device supports it. iPhone does not
let web apps vibrate, and the app says so rather than showing a dead switch.

### The room breathes too

**Background visualiser** — the second switch under Breathing, on by default —
turns the whole player into a room that answers to your breath. On the in-breath
the light opens, the far field follows a moment later, the haze separates, the
vignette relaxes and the horizon descends a few pixels; on the out-breath all of
it gathers back in and the colour goes fractionally warmer.

**Six rooms, one breath.** Under the switch is a picker, and each tile is the
room itself at a fixed half-open pose — the same markup and the same stylesheet
as the thing behind the player, so what you choose from cannot quietly stop
resembling what you get. Choosing one walks you on to the next question, the
same way choosing a pattern or a form does.

| Room | What the breath is drawn as |
| --- | --- |
| **Atmosphere** | The original: near and far fields of light, the echo a full inhale leaves behind, three aurora clouds on incommensurable orbits, haze at two depths, and eighteen points of pollen light. |
| **Rings** | Four rings leaving the centre and opening across the whole screen, each reading the breath further back in time than the one inside it. |
| **Waterline** | An ocean. Three swells rise and drain on three samples of the breath, their domed crests sliding past each other so the waterline is never flat; currents move under it, shafts of light come down through it, foam only exists while the sea is moving, and a path of moonlight lies on the water directly beneath you. |
| **Curtains** | The aurora. Five ribbons fanning from a zenith overhead, lit magenta at the hem and green through the body, filled with fine vertical filaments, each snaking on its own long period and reaching down the sky on its own sample of the breath. |
| **Starfield** | Sixty points that open from a knot ringed against the orb to a field reaching the corners of the screen — about three times the radius for the nearest of them and half that for the furthest, so an in-breath opens a volume rather than scaling a picture. |
| **Stillness** | One field, and the dark around it. For the times the rest of the screen is already carrying enough. |

**Drifting** holds a room for about a minute and a half and then crossfades to
another over four seconds — never the same one twice in a row. The crossfade is
safe for one specific reason: a room is not an animation. Both rooms are drawn
from the same `--e`, `--e-mid` and `--e-far` the orb is using, so mid-drift they
are the same instant of the same breath drawn two ways, and there is no frame at
which one of them is somewhere the other is not. The pair also do not fade
linearly past each other — both hold above the halfway mark through the middle
of the exchange, because two soft lights crossing at half strength read as the
room dimming. With `prefers-reduced-motion` on, drifting picks a room and keeps
it: a crossfade is only a fade, but a room *changing* is a change of scene.

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
therefore cannot contain a *device* voice, and any app claiming otherwise is
either recording your whole screen or sending your text to a server.

So Manifester does the honest thing: it records **your** voice, once, and builds
the file around that. `getUserMedia` plus `MediaRecorder` is a real, supported,
offline path — and for affirmations, hearing yourself is arguably the point.

**The studio voice changes what is possible here, and the export has not caught
up yet.** Ivy and Fen are ordinary audio, decoded into this app's own Web Audio
graph, so they *could* be written into an exported file the way the ambience
already is. Nothing in the export path does that today: it still mixes a
recording or the background alone. It is the one obvious thing this feature
makes possible and does not yet do, and it is listed as such rather than
quietly implied.

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

## The voice

Manifester speaks in one of two voices of its own — **Ivy** and **Fen** — and
they sound the same on an iPhone, an Android, a laptop and a tablet. They are
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), run by
[`remsky/Kokoro-FastAPI`](https://github.com/remsky/Kokoro-FastAPI) in a
container behind this project's own small API. Nothing is paid for, nothing is
metered, and no GPU is required.

| In the app | Logical name | Kokoro voice |
| --- | --- | --- |
| Ivy · feminine | `female_1` | `af_heart` |
| Fen · masculine | `male_1` | `am_fenrir` |

The device's own `speechSynthesis` voices are still there. They are no longer
the default — they are the choice for anybody who prefers one, and the
emergency fallback when the studio voice cannot be reached. A session never
goes silent because a network did.

### What the app says, and what it never has to know

```ts
tts.unlock()                                   // from the first tap
tts.speak('photosynthesis', { voice: 'female_1' })
tts.preload(nextLine, { voice: 'female_1' })
tts.stop()
```

That is the whole surface. Which model, which cache, which container, which
audio format, and what to do when the model is unreachable are all decided
inside [`src/lib/tts/`](src/lib/tts/), and nothing above that layer mentions
Kokoro. Swapping in Qwen, Chatterbox, Cartesia or ElevenLabs later is a new file
implementing `TTSEngine` — see *Changing engines*, below.

### Why it feels instant: five places to look before the model

Every clip is named by a SHA-256 of everything that decides how it sounds:

```
text + logical voice + voice version + speed + language
     + model version + pronunciation version + audio version
     → canonical JSON → SHA-256 → 64 hex characters
```

Two things follow from that, and between them they are the whole performance
story. The same sentence in the same voice is synthesised **once, anywhere,
ever**. And a file named after its own contents can be served `immutable` for a
year, from a CDN, with no invalidation rules — because the name can never come
to mean different audio.

So a line is looked for in this order, and only the last step involves a model:

| | Where | Typical cost |
| --- | --- | --- |
| 1 | Memory (decoded `AudioBuffer`, LRU by bytes) | microseconds |
| 2 | This device's IndexedDB cache | ~2 ms |
| 3 | Clips generated at build time, served as static files | ~10 ms |
| 4 | The API's own disk cache | ~40 ms |
| 5 | Kokoro | 1–3 s |
| 6 | `speechSynthesis`, if every one of those failed | — |

Each layer fills the ones above it, so a clip gets cheaper every time anybody
hears it, and a loop played twice never touches the network again — including
with the backend switched off, which is what makes a saved loop work offline in
the installed app.

Identical requests are deduplicated on both sides: the browser collapses a
preload and the line it was preparing for into one request, and the API collapses
simultaneous requests for the same words into one synthesis.

The loop always knows its next line, so it fetches it while the current one is
still speaking. By the time the gap between lines ends, the audio is decoded and
in memory.

### Audio

Ogg Opus, mono, 24 kHz, ~40–48 kbps where the browser can decode it; MP3, mono,
~64 kbps where it cannot — which today means Safari, since it has never shipped
the Ogg container. Detection is `canPlayType` first, and then, because
`decodeAudioData` is a different code path from a media element, a decode
failure is treated as this browser saying *late* that it cannot do Opus: the
verdict is remembered, the clip is re-fetched as MP3, and nobody sees anything
but a slightly slower first line.

Both encodings share one cache key and differ only by file extension, so a
device that changes its mind never causes a second synthesis.

### Running it

```bash
docker compose up
```

Two services, and only one of them has a port:

- **`kokoro`** — `ghcr.io/remsky/kokoro-fastapi-cpu`, exactly as its authors
  publish it, with **no `ports:` entry**. It is reachable from the API over the
  internal network and from nowhere else.
- **`api`** — this repository's dependency-free Node server, on `:8787`,
  serving both the built app and `/api/tts`.

That arrangement is the main security property of the design. A public
text-to-speech endpoint is somebody else's compute bill and a trivial
denial-of-service target; the way to be certain one is not exposed is for there
to be no port to expose it on. Everything a browser can ask for arrives at the
API first, where the voice must be one of the two logical names, the speed is
clamped, the text is length-limited, and synthesis is rate limited.

For front-end work, run the API in Docker and Vite on the host — the dev server
proxies `/api/tts` to `:8787`, so the browser only ever sees a same-origin path:

```bash
docker compose up -d kokoro api
npm run dev
```

Or run the server directly, without Docker, against a Kokoro you started
yourself:

```bash
KOKORO_URL=http://127.0.0.1:8880 npm run server
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | API port |
| `KOKORO_URL` | `http://127.0.0.1:8880` | Where Kokoro is |
| `SPEECH_CACHE_DIR` | `./data/speech` | Synthesised clips |
| `SPEECH_STATIC_DIR` | `./public/speech` | Build-time clips, read-only |
| `PUBLIC_DIR` | — | Set to a built front end to serve it too |
| `RATE_LIMIT_PER_MINUTE` | `120` | Synthesis requests per address |
| `ALLOWED_ORIGINS` | — | Comma-separated, for a front end on another origin |
| `VITE_TTS_ENDPOINT` | `/api/tts` | Build-time: `""` means "this build has no backend" |

### Generating speech ahead of time

```bash
docker compose up -d kokoro
npm run speech
```

This speaks everything the app already knows it might say — the starter lines,
every line the writing helper can offer, the voice sample — in both voices, at
the two speeds people actually use, in both encodings, and writes them to
[`public/speech/`](public/speech/) with a manifest. They ship as ordinary static
assets, so a brand-new device with a cold cache speaks in the studio voice on
the very first tap.

Regeneration is incremental by construction rather than by bookkeeping: a clip's
name *is* the hash of its inputs, so "has this changed?" is answered by whether
the file exists. Editing one phrase regenerates one phrase.

```bash
npm run speech -- --force              # say everything again
npm run speech -- --prune              # delete clips nothing refers to
npm run speech -- --speeds 0.8,0.9,1   # other speeds
npm run speech -- --formats opus       # one encoding only
```

### Pronunciation

[`src/lib/tts/pronunciation/dictionary.ts`](src/lib/tts/pronunciation/dictionary.ts)
is the file to edit when a word comes out wrong. Every rule is
provider-neutral and may carry any of three answers:

```ts
{
  term: 'Clostridioides difficile',
  match: 'phrase',
  ipa: 'klɒˌstrɪdiˈɔɪdiːz dɪfɪˈsiːl',   // engines that take phonemes
  say: 'kloss-trid-ee-OY-deez dif-uh-SEEL', // everything else
  scope: 'medical',
}
```

Kokoro is sent the IPA, as `[term](/ˈaɪ piː eɪ/)` inline markup; anything that
cannot take phonemes — including the browser's own fallback voice — is sent the
respelling. A term that no respelling fixes can name an `audio:` file instead,
which replaces synthesis for that phrase entirely.

Rules are **scoped**, because the same letters mean different things in
different rooms: `SpO2` is a blood oxygen reading in a clinic and a player's
handle in a game. `core` (symbols, abbreviations) is always on; `medical`,
`science`, `gaming`, `acronym` and `app` are switched on by the caller.

After editing, bump `PRONUNCIATION_VERSION` in
[`src/lib/tts/versions.ts`](src/lib/tts/versions.ts). Every affected clip
re-keys itself, is made again on next use, and no cache anywhere has to be
invalidated. Rules can also be added at runtime with
`tts.addPronunciation([...])`.

### Changing engines

`TTSEngine` is three methods and a descriptor —
[`src/lib/tts/types.ts`](src/lib/tts/types.ts):

```ts
interface TTSEngine {
  readonly descriptor: EngineDescriptor  // id, model version, phonemes?, formats
  lookup(request, signal): Promise<EngineResult | null>   // already made?
  synthesize(request, signal): Promise<EngineResult>      // make it
  probe(signal): Promise<boolean>                         // are you there?
}
```

To move to a different provider: write the engine (browser side), write the
upstream client next to [`server/kokoro.mjs`](server/kokoro.mjs) (server side),
point `buildEngine()` at it, and change `modelVersion`. That last step is what
re-keys the cache: clips made by the old engine keep their names, are never
looked up again, and the new engine's clips are made under new ones. No cache
purge, no migration, no downtime.

The app itself does not change, because the app never knew.

### Why Kokoro runs on a server and not in the browser

It was built in-browser first, measured, and removed. Kokoro-82M via ONNX
Runtime in a worker was a ~90 MB one-time download, fully offline afterwards,
and it produced genuinely lovely audio.

The problem was speed. On a 32-core desktop, **with cross-origin isolation
enabled so ONNX Runtime could use threads**, synthesis ran at a real time factor
of **≈3.3× — 3.3 seconds of compute per second of speech**:

```
chars=34   audio=2.6s   render=8.9s    rtf=3.47
chars=127  audio=9.3s   render=30.4s   rtf=3.26
chars=215  audio=14.5s  render=47.3s   rtf=3.26
```

A phone would be several times slower again, and cross-origin isolation has to
be faked through the service worker on GitHub Pages.

The same model on a server has none of those problems: it synthesises a line
once for everybody, the browser downloads ~15 KB of Opus rather than 90 MB of
weights, and the result is cached so thoroughly that the second play is faster
than the in-browser version could ever have been on its first.

### Getting a good device voice

If you choose one of your device's own voices — or if the studio voice is
unreachable — this matters, and it is free.

Every platform ships modern neural voices that are **not installed by default**.
The difference between them and the fallback synthesiser is not subtle.

| Platform | Where to get them |
| --- | --- |
| **iPhone / iPad** | Settings → Accessibility → Spoken Content → Voices → English → download one marked **Premium**. Ava, Zoe, Evan, Nathan are all excellent. |
| **Android** | Settings → Accessibility → Text-to-speech output → **Google Speech Services** → install English voice data. |
| **Windows** | Settings → Time & language → Language & region → English → Language options → add **Speech**. Windows 11's **Natural** voices are excellent. Chrome and Edge also offer Google/Microsoft online voices with no install. |
| **Mac** | System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → **Premium** or **Enhanced**. |

Install one and reopen Manifester — it finds it automatically. The same
instructions live inside the app, under the voice picker.

---

## Privacy

> Your saved loops stay on this device. Manifester does not require an account
> and has no server of its own.

- Text, settings, and imported audio live in your browser's own IndexedDB.
- **The studio voice is the one part of playing a loop that leaves the device,
  and it goes only as far as the speech service this project runs.** A line is
  sent as text to `/api/tts`, which is Manifester's own API — not a third party,
  not an account, not a metered service — and the audio that comes back is
  cached on the device so the same line is never sent twice. The API keeps the
  audio, addressed by a hash, and no record of who asked for it. On the GitHub
  Pages build there is no backend at all, so nothing is sent anywhere: it plays
  the clips that shipped with the app and uses the device's own voice for
  everything else. Choosing a device voice under *Choose an exact voice* has the
  same effect on any deployment — speech is then generated entirely by your
  device.
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
| Speech | Kokoro-82M behind our own Node API; Web Speech API as the fallback |
| Speech cache | Content-addressed (SHA-256), in memory, IndexedDB, static assets and on the API's disk |
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

*And the supported answer was not enough*, which is where the first attempt at
this stopped and why the report came back a second time. `navigator.audioSession`
is implemented by Safari alone; it arrived in 16.4 with only part of it enabled
and the rest behind an experimental feature flag. On a phone where it is missing
or inert, that assignment sets a property, changes nothing, and leaves the mix
on the ringer channel exactly as before — with no error and nothing to see.

So there is a second mechanism underneath it, and on iOS it always runs rather
than being skipped when the API *claims* to have worked: a silent `<audio>`
element, playing on a loop for as long as the app means to make a sound. An
`HTMLMediaElement` is categorised as media playback rather than as ambient
noise, and while one is playing the page's Web Audio goes out over the same
route. It is a hack; it is the hack every audio library on the web has
converged on; and the honest reason it is here is that the standard answer does
not yet work on the phones people have. Three details are load-bearing:

- **The element is in the document**, not merely constructed. A detached media
  element plays perfectly well on a desktop, which is exactly what makes this
  easy to leave out and never notice — but iOS chooses the route from the media
  a page is *presenting*, and an element outside the document presents nothing.
- **The file is real.** The silent track is built byte by byte rather than
  shipped as base64, and it is decoded by a real decoder in the tests, because
  a header written big-endian or a chunk length off by 44 produces a file the
  browser declines, an element that never plays, and a phone that behaves
  exactly as it did before the fix.
- **The recovery arms on success, not on the request.** The breath's own voice
  builds its context the moment the player mounts, long before anyone presses
  anything, so the claim is reached without a gesture and refused. Arming on
  the request would mean the first stray tap anywhere started a silent track
  and put a lock-screen widget on a session nobody had begun.

The visible cost is a lock-screen media widget while a session runs, which for
a thirty-minute spoken loop is arguably where it belongs. It is handed back the
moment the session pauses or ends.

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

<a id="the-breath-is-written-down-in-advance"></a>

**The breath is written down in advance, because a hidden tab is not a paused
tab.** Switching to another browser tab used to stop the breathing guide's
voice, or change it, or make it lurch on the way back; leaving the player for
the library silenced the breath cues under a session that was otherwise still
running. Both had the same cause, and it was not an audio bug at all.

The guide was driven from the player's own `requestAnimationFrame` loop: one
loop computed the breath, wrote it onto the orb, *and* told the voice when a
phase had turned. That is the right shape for something you are looking at and
the wrong shape for something you are hearing, and the difference only appears
when you stop looking. Browsers stop animation frames for a hidden page
outright, so the phase turn due four seconds later never arrived and the sound
held whatever it had last been asked for — a sustained voice sitting at the top
of an in-breath for as long as you were away, a struck voice simply falling
silent. Come back, and the clock had moved twelve seconds; the next frame landed
in a different phase, and the guide jumped to catch up. Walking to another tab
inside the app was worse still: the component unmounted and its cleanup stopped
the voice, so the words and the ambience carried on with the breath quietly gone.

Timers were the same problem one step down. `setTimeout` is clamped to one
second in a hidden page and, in Chrome, to **one a minute** after five minutes
out of sight. The silence between passes, the moment a playlist hands over from
one soundscape to the next, and the rolling scheduler that lays down individual
rain droplets were all ordinary timers — so a three-second rest could become
eleven, and rain thinned to a drizzle and then came back as a downpour when the
missed windows were filled at once. None of that is a browser misbehaving. It is
a browser doing exactly what it says it does to a page that has not made itself
an exception.

Three changes, and the order matters:

- **The guide is an engine, not a component.**
  [`breathEngine.ts`](src/lib/breathEngine.ts) owns the clock at module scope
  and is driven by the session rather than by a screen, so nothing about it can
  unmount. Elapsed time is wall-clock measured and banked across pauses, which
  means a stalled tab, a dropped frame or twenty minutes in another application
  change where the breath *is* not at all — only when anyone next asks. The
  player draws a picture of that clock and holds no responsibility for the
  sound.
- **Phases are scheduled eight seconds ahead.** The audio thread is handed each
  phase at its exact moment before it arrives, so it plays them whether or not
  this page is being rendered, scheduled, or thought about. The piece that had
  to change to allow it is small and was the whole difficulty: every ramp used
  to start from the param's *current* value, which is the right answer at the
  moment a phase begins and the wrong answer six seconds early. Each ramp now
  chains from the value the previously scheduled phase will leave behind — and
  because that failure is inaudible in a visible tab, it has a test of its own.
- **One heartbeat, from two sources.** [`heartbeat.ts`](src/lib/heartbeat.ts)
  beats every half second from a timer *and* from the audio clock — a short
  source node whose `ended` event arms the next one. The audio thread has no
  idea whether a tab is visible, and `ended` is an ordinary task rather than a
  throttled timer, so it holds when the timer does not; the timer holds when
  the context is suspended, which is what pausing deliberately does. Neither is
  trusted alone. The gap between repetitions, the playlist's segment clock, the
  session countdown and the ambience's transient scheduler all run on it, and
  every one of them asks "given the wall clock, what should already have been
  scheduled?" — a question with the same answer however late it is asked. The
  ambience's horizon went from two seconds to six for the same reason: two left
  no margin at all once timers are clamped to one.

Coming back to the page also nudges the speech queue, which browsers feel free
to drop or leave parked while a page is hidden, and catches up every scheduler
on the same turn rather than up to half a second later.

What none of this can do is defeat a platform that genuinely stops the page —
iOS will still suspend a backgrounded web app's audio in ways no web API can
refuse. The claim is narrower and it is the one that was broken: switching tabs,
switching windows, or walking to another screen inside the app does not change
what you hear.

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

**The room is centred on the orb, because the orb is measured.** Everything in
the atmosphere is drawn around one point, `--heart-x`/`--heart-y`, and that
point used to be a pair of percentages — `50% / 44%`, with a hand-written `38%`
past 1024px because the stage is the left column of a two-column grid there.
Each of those numbers was right at exactly one window size; everywhere else the
light gathered somewhere the orb was not, which is the difference between a room
the orb is breathing in and a gradient the orb happens to be near.
[`useHeartAnchor`](src/lib/useHeartAnchor.ts) measures the orb instead and writes
its centre and radius onto the field as lengths. Not per frame — that would be a
forced layout flush alongside the breath, which is the cost this whole stylesheet
is built to avoid — but on a `ResizeObserver` on the orb (which the registered
`--size` transition fires every frame of an expansion, for free), on scroll and
viewport changes, and on a bounded frame loop after the layout is told to change.
Every layer in `theme.css` was already drawn around that point, so the entire
environment re-centres without one of them learning that it moved.

**Every room is measured in circles, not in percentages of the window.** The
breath-driven layers used to be sized as percentages of the field — `width:
170%`, `height: 160%` — which on a 1440×950 window makes a 2431×1520 *ellipse*.
Its box was centred on the orb to the pixel and it still did not look centred,
because light that reaches half again as far sideways as it does vertically
reads as a band the orb is sitting in rather than as a room gathered around it.
Every one of them is now `width: calc(var(--span) * k)` with `aspect-ratio: 1`,
placed with `translate(-50%, -50%)` on the heart — the same construction Rings
has always used — so the room is a true circle on the orb at every window shape.
The three aurora clouds moved with them: they used to hang at fixed corners of
the viewport, which meant the colour gathered wherever the window happened to be
widest.

**Nothing with an edge crosses the orb.** The card is translucent glass, which is
the whole look and also the one way the illusion breaks: a ring's bright arc, a
curtain's ribbon, the waterline or a star passing *across* the orb reads as being
in front of it, because a hard edge over a soft object is the oldest depth cue
there is. So the orb's measured radius comes along as `--halo`, and every layer in
a room that has an edge is drawn inside one untransformed wrapper carrying one
mask: clear well inside the orb's silhouette, fully present a third of a radius
past it, a long soft ramp in between. Everything *soft* — the glow, the pools, the
washes, the sky, the deep — stays outside that wrapper, because a hole in a wash
would be a dark disc behind a translucent orb, which is the opposite of the fix.
The wrapper is untransformed on purpose: a mask travels with its element's
transform, and a hole that follows the scaling ring it is meant to be cut out of
is not a hole.

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

**The words are fitted to their box, not the other way round.** The orb is the
anchor of the whole screen, and it was moving: expanded, the orb and the line it
is speaking are centred together in whatever height is left over, so a line that
wrapped to two instead of one pushed the orb up by about thirty pixels — every
few seconds, on the one screen someone is looking at while trying to be still.
In the card the orb held its place but the stage grew and shrank underneath it,
so everything below the words shifted instead. Measured, not guessed: 30px and
32px of drift, and 46–59px of stage height.

Making the box a fixed height is the obvious half. The interesting half is what
to do with a line too long for it, and there are only three answers: clamp it
and put an ellipsis on the entire point of the app; reserve enough height for
the longest line anyone could write, and charge the orb for it on every screen
including the great majority where the lines are short; or set the long line
slightly smaller, which is what a person laying this out by hand would do
without thinking about it. [`useFittedLine`](src/lib/useFittedLine.ts) does the
third. Two details make it work rather than merely run:

- **The column has to be measured in a real length.** It was `32ch`, and `ch` is
  a multiple of the font size — so shrinking the type shrank the column with it
  and the line wrapped in exactly the same places, forever. That one unit is the
  difference between this converging and it not working at all.
- **The step is a square root.** Halving the type roughly halves the height of a
  line *and* roughly halves the number of lines, so the block's height goes with
  the square of the scale. Stepping by `available / natural` overshoots badly —
  it lands at 0.5 where 0.7 would have done, and the words end up needlessly
  small.

The height it does reserve is *derived* — lines × leading × size — rather than a
hand-tuned constant, so the room the orb gives up is exactly the room the words
are using at that viewport, and the two cannot drift apart when one of them is
tuned. It is paid for by the pass meter, which no longer appears in fullscreen:
it was the last piece of technical information left on a screen whose whole job
is to have none, and it was repeating what the state label at the top already
said. The pass counter beside the clock went at the same time and for the same
reason — it was the one number there that answered a question nobody listening
is asking. Measured after: zero drift at any line length, constant orb size,
constant box height, nothing clipped, and no scrollbar, at four viewport sizes.

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

**No animation library for the breathing guide.** Every layer of the six styled
forms is driven by the same two CSS custom properties (`--e` for expansion,
`--p` for phase progress) that [`useBreathing`](src/lib/useBreathing.ts) writes
straight onto the element each frame. React re-renders once a second, for the
countdown, and never for the animation itself — so the browser only ever
composites transforms, opacity and one dash offset, and adding a seventh styled
form would cost no JavaScript at all.

**A canvas for the two forms that are places rather than shapes, and one clock
for all eight.** Ink Cathedral and Moonpool need geometry that changes every
breath, a few hundred points of light in a different position every frame, and
an exhale that is a different event from the inhale — none of which CSS can be
asked for honestly. They do *not* need a clock of their own, and giving them one
would have been the mistake: a four-second loop agrees with a four-second breath
for about a minute and then spends the rest of the session visibly disagreeing
with it. So `useBreathing` writes the same frame it writes as `--e` into a plain
object as numbers, and the renderers read whatever is in it when their own frame
comes round. A canvas form is in step with a CSS form to the millisecond for
exactly the reason two CSS forms are: they are not agreeing, they are the same
number.

Everything expensive about a scene like that is fill rate, so all the levers are
about pixels. The device ratio is capped rather than honoured — 2× in the orb,
which has edges worth resolving, 1.25× across the viewport, where the picture is
soft gradients and the extra resolution is invisible, 1× on a modest device. The
static ground each world sits on is a CSS gradient *behind* the canvas rather
than two full-viewport fills every frame, which is the same house rule the rest
of `theme.css` runs on: no gradient is ever recomputed per frame. Bays that fall
off the edge of the screen are built — the geometry has to be identical in both
canvases — and then not drawn. Points of light are stamped from one pre-rendered
brush instead of allocating a radial gradient apiece, and nothing anywhere goes
near `shadowBlur`, which is the obvious way to get a glow and the reliable way
to turn sixty frames a second into twelve.

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

### The night light

A second, entirely separate colour control on the same screen: not *which* hue
the palette is, but how much blue is left in the light coming off the screen.
Zero to a hundred, dragged on the same kind of band.

It is one fixed pane over the finished page with `mix-blend-mode: multiply`, and
the blend mode is the whole feature. A multiply can only ever take light away —
red passes untouched, green comes down to about seven tenths and blue to about
four at full strength, which lands near a warm 2700K bulb. An alpha overlay
would *add* orange to every pixel including the black ones, lifting the blacks
to brown, flattening the contrast of the type, and reading as a filter sitting
on the app rather than as the light in the room changing.

Two properties follow from that, and both are why it can be offered at full
strength without a warning:

- **Contrast is preserved exactly.** Ink and paper are multiplied by the same
  factor, so every ratio on the page is what it was at zero.
- **Off is genuinely off.** At zero the tint is pure white, which is
  arithmetically a no-op — and the element is not mounted at all below one, so
  the overwhelming majority of sessions never composite a viewport-sized blended
  layer.

The pane is last in the shell and highest in the stack, so it reaches the
expanded stage and the install prompt as well as the page: a screen that gets
warmer everywhere except the thing you are looking at is worse than one that
does not get warmer at all. The same multiply is applied in JavaScript to the
`theme-color` meta tag, because a blend over the page is invisible to
`getComputedStyle` and the OS window chrome would otherwise stay stubbornly blue
above a page that no longer is.

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

### With the voice

The app runs perfectly well with `npm run dev` alone — with no speech service
reachable it plays whatever is in `public/speech` and falls back to the device's
own voice for everything else, which is exactly what the GitHub Pages build
does. To develop against the real voice, start the containers first:

```bash
docker compose up -d kokoro api   # the model, and the API in front of it
npm run dev                        # Vite proxies /api/tts to :8787
```

Or run the whole thing as it is deployed — built app and API in one container:

```bash
docker compose up                  # http://localhost:8787
```

The first synthesis after a cold start is slow: the model is being loaded. Every
line after it is cached, on the server and then on the device.

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

```bash
npm run server
```

```bash
npm run speech
```

`npm run server` starts the speech API on its own, without Docker, against
whatever `KOKORO_URL` points at. `npm run speech` pre-generates every phrase the
app already knows — see [Generating speech ahead of time](#generating-speech-ahead-of-time).

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
- **The breath, with nobody watching.** A whole cycle is scheduled in one go at
  time zero and then rendered with nothing touching the graph afterwards, which
  is exactly the situation of a hidden tab. The in-breath has to rise, the
  out-breath has to fall, and the second breath has to be as loud as the first —
  a chain of scheduled ramps that leaks a little each time round is a guide that
  fades away over half an hour. This is the test that fails if a ramp goes back
  to reading the param's current value, which is a mistake with no symptom at
  all while the tab is visible. Phase placement is checked separately: absolute
  time rather than folded into one cycle, zero-length phases skipped, and all
  four phases of a box breath walked in order.
- **Choosing a sound.** What one tap on a sound means — which mode, which
  track, and what it leaves alone — is a pure function with its own tests, and
  so is the question the player asks before it disturbs live audio: rain's
  character and a repeat mode with nothing to repeat are changes the running
  engine is already following, and rebuilding the queue for them would restart
  an ambience that only needed adjusting.
- **Compatibility.** A loop record written by the previous version — no
  `brainwave` key, no `rainCharacter` — loads with the feature off and everything
  else intact. A tampered `targetHz` is rebuilt from its preset.
- **One world, two canvases.** The living forms are drawn twice at once — inside
  the orb and across the room — by two objects that never exchange a byte, so
  the test that matters is that the same session and the same breath build a
  byte-identical building. That is also the test that would fail, silently and
  beautifully, the moment anyone reached for `Math.random()` inside the builder.
  Around it: forty consecutive breaths are asserted to be forty different
  buildings whose vault stays within a quarter of itself, because *never the
  same twice* and *recognisably one place* are both requirements and they pull
  against each other. Every seed is checked for Gothic proportions, for a vault
  that fits the box it is drawn in, and for arches that close — both halves have
  to reach the keystone, or an arch never visibly connects.
- **An exhale is not a rewind.** `revealFor` is walked across whole breath
  cycles at sixty frames a second and asserted never to decrease except in the
  first frames of a new in-breath. This is the one rule the entire Ink Cathedral
  rests on: tie the reveal to `--e` instead and the out-breath un-draws the
  arches from the keystone down, which every viewer reads instantly as a video
  being scrubbed backwards.
- **Rarity stays rare.** Twenty thousand breaths of each form, asserting that
  something happens about one breath in six for the cathedral and one in twelve
  for Moonpool, that every rare moment is reachable rather than dead code, and
  that the two forms do not brighten on the same breaths.
- **Water has the same inertia at any frame rate.** `approach` is asserted to
  land in the same place after a second at 30Hz and at 120Hz. The naive version
  of that lag does not have this property, and the bug it causes — water that
  lags twice as far on a fast screen — is invisible until someone reports it.
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
    BreathingVisualizer   all eight guide forms, plus the phase ring
    LivingCanvas          the canvas, the frame loop and the device ratio the
                          two drawn forms share — and nothing about what they
                          look like, which belongs to the scenes
    PlayerAtmosphere      the room the player breathes in, on the orb's clock —
                          temperature, the scene, and the depth over both
    BackgroundScene       the six rooms, and the still frames the picker shows
    Menu.tsx              the "…" menu: anchored on a desktop, a sheet on a phone
    CosmicBackground      the twilight garden behind every screen
    RitualPreview.tsx     the live picture of the finished ritual
    CustomizePanel.tsx    the advanced settings, as summarised rows + sheets
    PlayerAdjust.tsx      everything the player can change, in one sheet
    SettingRow.tsx        one row of that list, stating its own value
    AppearanceSettings    the palette band, the night light and day/night
    DragBar.tsx           a band you drag, whose track is markup rather than
                          a background image on a pseudo-element
  routes/         Create, Player, Library (loops + sounds), About
  state/          Theme, Library (IndexedDB), Session (playback engines),
                  Stage (whether the player has taken over the screen)
  lib/
    speech.ts       line-per-utterance chunking, voices, the looping speaker
    voiceRanking.ts scores device voices and picks the best of each style
    breathing.ts    pure breath-phase maths, patterns and forms
    random.ts       the two kinds of determinism the living forms need: a seeded
                    stream for placing a field once, and a pure hash of
                    (seed, breath) so two canvases build one world without
                    ever speaking to each other
    scenes/
      types.ts        what a scene is, the shaping and colour it shares, and
                      the soft brush every point of light is stamped from
      inkCathedral.ts ink, arches, a vault, and an exhale that releases rather
                      than rewinds
      moonpool.ts     an ocean, an opening onto the sky, and water with inertia
                      of its own
    breathAudio.ts  the breath's own synthesised voices
    breathEngine.ts the breath itself: one clock at module scope, owned by the
                    session rather than by a screen, writing phases onto the
                    audio clock eight seconds ahead so a hidden tab changes
                    nothing about what is heard
    useBreathing.ts draws the orb — and everything mirroring it — from that
                    clock, plus a silent local clock for the previews
    environment.ts  the room itself: background modes, how far the breath lags
                    at distance, and the two seeded fields of points — eighteen
                    motes for the corners of a room, sixty stars for a sky
    useBackgroundMix.ts   wakes and settles the room, without ever touching
                          the breath underneath it
    useHeartAnchor.ts     measures the orb, so the room is centred on it rather
                          than on a percentage that was right at one width
    useStageExpansion.ts  grows the player into the screen, and back
    smoothScroll.tsx  Lenis on the two screens that genuinely scroll
    feedback.ts     haptics and generated interface tones
    recorder.ts     microphone capture for exports
    exportAudio.ts  offline bed rendering, decoding, normalisation
    audio.ts        background sound engine (synth + imported files)
    audioBus.ts     owns the AudioContext and the generated-sound mix
    heartbeat.ts    one clock for everything that must keep time out of sight:
                    a timer and an audio-clock ticker, because a hidden tab
                    throttles the first and cannot touch the second
    audioParams.ts  click-free ramps and the soft-clip ceiling
    ambient.ts      the five generated ambiences
    brainwaveAudio.ts  preset table, frequency maths and the rhythm engine
    storage.ts      IndexedDB + localStorage
    timer.ts        wall-clock session countdown
    motion.ts       reduced motion, low-power, breakpoint and platform detection
    hue.ts          the palette dial's named stops, and the night light's maths
    summaries.ts    the one-line summary of every advanced setting
    soundChoice.ts  what one tap on a sound means, and whether a change is one
                    the running engine has to hear about
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

### The two shapes this deploys in

**Static, with no backend** — what GitHub Pages gets. The workflow builds with
`VITE_TTS_ENDPOINT=""`, which tells the app there is no speech service rather
than letting it discover that through failed requests. Anything
`npm run speech` generated is committed and served as static assets; everything
else is read by the device's own voice. Nothing is sent anywhere.

**Whole, with the voice** — `docker compose up`, or the same two containers
behind any reverse proxy. The API serves the built app and `/api/tts` from one
origin, so there is no CORS to configure; Kokoro has no published port and is
reachable only from the API. Point `SPEECH_CACHE_DIR` at a volume so
synthesised clips survive a rebuild — they are content-addressed, so that cache
can never go stale, only unused.

---

## Browser limitations, honestly

These come from the browser, not from Manifester, and no amount of code makes
them go away:

- **The studio voice needs the speech service to have been reachable at least
  once.** A line nobody on this device has ever heard, with no network and no
  backend, is read by the device's own voice instead. Everything already heard
  plays offline, from IndexedDB, indefinitely.
- **A device voice list is the device's.** iPhone, Android, Windows, and Mac
  each offer a different set. Manifester cannot add voices to that list — it can
  only rank what is there and tell you where to download better ones. This is
  precisely the problem the studio voice exists to solve.
- **Style labels are a guess, for device voices.** There is no gender field in
  the Web Speech API, so feminine / masculine labels are inferred from voice
  names, as are quality tiers. Ivy and Fen are neither inferred nor variable.
- **Pitch applies to device voices only.** A studio clip is recorded audio, and
  the only way to raise its pitch after the fact is to play it faster — which is
  the Speed control under a different name and a worse result. The slider is
  shown when a device voice is chosen and hidden when it is not, rather than
  sitting there doing nothing.
- **Volume is sometimes ignored, for device voices.** On iOS especially, speech
  follows the system media volume regardless of the in-app slider, because
  `SpeechSynthesisUtterance.volume` is all a web app is given. The studio voice
  does not have this problem: it plays through this app's own gain node.
- **iPhones stop speech when the screen locks.** Manifester requests a screen
  wake lock during a session, but Low Power Mode and some accessibility settings
  override it. For long sessions, plugging in and leaving the screen on is the
  reliable route.
- **The first tap matters.** Browsers require a genuine user gesture before any
  audio starts. If nothing happens, tap play once more.
- **A hidden tab is throttled, and Manifester works around it rather than
  through it.** Animation frames stop entirely for a page you cannot see, and
  timers are clamped to one second — in Chrome, to one a minute after five
  minutes out of sight. Nothing about the sound is driven by either any more:
  the breath is scheduled onto the audio clock several breaths ahead, and
  everything that has to keep time runs on a heartbeat with an audio-clock
  source under it. So switching tabs, switching windows or walking to another
  screen inside the app does not change what you hear. What that cannot beat is
  a platform that stops the page outright — iOS still suspends a backgrounded
  web app's audio in ways no web API can decline, and installing to the home
  screen with the screen on is the reliable route for a long session on a
  phone. See
  [The breath is written down in advance](#the-breath-is-written-down-in-advance).
- **A phone's silent switch mutes Web Audio, but not speech.** Which is why "the
  words play and nothing else does" is the classic mobile report. Manifester
  declares its audio session as `playback` *and* holds a silent looping media
  element for the length of a session, because the first of those is Safari-only
  and still largely behind a feature flag while the second works everywhere —
  see below.
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
