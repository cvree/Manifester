# Prompt: smooth motion, accessibility and phone reliability for Manifester

> Paste everything below the line into a coding agent that has this repository
> checked out. It is written from a read of the code as it stands on
> `claude/happy-wright-v4yhdv`. The file and line references are starting
> points: confirm each one before acting on it, because the code may have moved.

---

## Who this is for, and the bar

Manifester is a calm, offline-first PWA (React 19, Vite, Tailwind 4, GSAP,
Lenis). People use it to breathe slowly and listen to affirmations. **Its main
user is one person on her phone**: iPhone Safari, possibly installed to the home
screen, often in a dark room, often half-asleep, sometimes with the screen
locked and only the audio running.

That sets the bar:

1. **Nothing on screen may shake, crawl, twitch, re-wrap or jump.** Every
   movement has to be continuous and come from the breath. This matters most for
   the breath guide (the orb, the "Breathe in / Hold / Breathe out" title, the
   countdown) and the spoken line under it.
2. **The app must never crash, go blank, reload itself or go silent in the
   middle of a session**, whatever the phone does: locking, a phone call,
   Bluetooth headphones disconnecting, low memory, the URL bar collapsing, the
   keyboard opening, a new deploy landing, or a 60-minute session.
3. **Anyone should be able to use it**: with motion turned down, with larger
   text, with VoiceOver, with one hand, in bright sunlight, in light or dark
   mode.

Keep the design. This is not a redesign. Match the existing look, the
`theme.css` token system and the house style of long explanatory comments. When
you remove an effect, replace it with a cheaper one that looks the same.

## How to work

- Work in small, separate commits, one per numbered item or a tight group of
  them, each with a message that says what changed and why. Run
  `npm run typecheck`, `npm test` and `npm run build` before every commit.
- **Measure before and after.** For every motion fix, record the "before" (a
  Performance trace with frame timings, or the Playwright probe in §5) and show
  that the "after" is better. Don't claim a fix you haven't measured.
- Where this prompt says **verify**, the problem is suspected but not confirmed.
  Check it first. If it turns out not to be a problem, say so and skip it.
- Don't add dependencies unless one is clearly needed. Don't remove features.
  `prefers-reduced-motion` must keep working everywhere it works today.

---

## 1. Why the motion shakes: diagnosed causes and required fixes

The breath is drawn by one `requestAnimationFrame` loop on the main thread
(`useDraw` in `src/lib/useBreathing.ts`). Every frame it writes five unregistered
custom properties (`--e --p --m --e-mid --e-far`, `toFixed(4)` strings) onto
`.stage` and its mirrors, and the whole stylesheet reacts through `calc()`.
That design is elegant, but it has three consequences that together cause the
shakiness:

- The per-frame properties include **layout and paint properties** as well as
  transform and opacity, so some frames trigger a reflow and repaint.
- Because the loop runs on the main thread, **any main-thread stall drops a
  frame of the breath**: React re-rendering the countdown once a second, the
  TTS worker posting messages, GC, IndexedDB. That shows up as a small hitch
  about once a second.
- Unregistered custom properties inherit, so **every descendant of `.stage` has
  its style recalculated every frame**, including the full-viewport
  atmosphere layers.

Fix these, in priority order.

### 1.1 The cinematic title ("BREATHE IN" / "BREATHE OUT") — `src/styles/theme.css` ≈2408–2433, `src/components/CinematicBreathType.tsx`

- **Letter-spacing is animated every frame** (`letter-spacing: calc(var(--cinema-track) + var(--e) * var(--cinema-swell))`
  and the matching negative `margin-right`). That property is layout-only. The
  text reflows every frame, and each glyph's position rounds to whole device
  pixels separately, so **letters crawl and jitter against each other**. The
  `.cinema__word` is also `flex-wrap: wrap`, so on a narrow phone the extra
  tracking at the top of an in-breath can **re-wrap "BREATHE OUT" from one line
  to two and back mid-breath**, which makes the whole block jump. Verify the
  re-wrap at 360–390px widths.
  **Fix:** keep `letter-spacing` fixed, and set the wrap at the *maximum* swell
  so the line breaks never change. Get the "opening" effect from compositor
  transforms instead: give each glyph `--i` (its index) and `--c` (its offset
  from the phrase centre, computed once per phase in `CinematicBreathType`),
  then use `transform: translate3d(calc(var(--c) * var(--e) * var(--cinema-swell)), 0, 0)`.
  It must look the same as today. Measure the word's bounding box across a
  whole breath: its height must not change.
- **The `text-shadow` blur radius and colour change every frame** (≈2428). That
  repaints the glyphs every frame. **Fix:** use a static `text-shadow` and fade
  the glow by `opacity` on a separate layer (`.cinema__glow` already exists for
  this), or on an `aria-hidden` duplicate of the word with a fixed shadow.
- **`transform: scale()` on live text with `will-change: transform`** (≈2427,
  2430). The text is rasterised once and scaled as a bitmap. It goes soft, then
  "pops" when Safari or Chrome re-rasterises it. **Fix:** remove the scale from
  the text, or keep it below roughly 1% and check on a real phone that it stays
  sharp. Let opacity and the glow carry the swell.
- **The per-glyph resolve (`cinema-resolve`, ≈2454–2490)** animates
  `filter: blur(0.5rem)` and a transform on every letter, then ends at
  `transform: none`. When each glyph finishes, its layer is dropped and the glyph
  is re-rasterised at a rounded pixel position, so **each letter visibly snaps
  by about 1px as it settles**. Eleven filter layers at every phase turn is also
  heavy for a phone. **Fix:** make the last keyframe identical to the resting
  computed style, so promotion and demotion can't move anything. Limit blur to
  about 4px or less, or use opacity plus a small translate on low-power devices.
  Make sure no glyph keeps a layer after the sweep.
- **The countdown is re-mounted every second** (`key={count-${phase}-${remaining}}`,
  and `cinema-tick` with a 2px translate, ≈2576–2605), together with the React
  render that happens that second. That is a once-a-second twitch. **Fix:** give
  the numeral a fixed width (`tabular-nums` is already set, so also set an
  explicit `min-width` in `ch`), change only its text, and use an opacity
  cross-fade with no translate. Or don't animate it at all.
- The immersive sizes use `vh` (`min(9.5vw, 9vh)`, ≈2618, 2623, 2641). Mobile
  `vh` changes when the URL bar moves (see 1.3), so **the title changes size
  while you scroll.** Use `svh`.

### 1.2 The orb — `src/styles/theme.css` ≈1472–1500, `src/components/BreathingVisualizer.tsx`

- `.breath > * { will-change: transform, opacity; }` (≈1491) gives **every
  child of every form its own layer**: about 17 for Bloom, 25 or more for
  Constellation. On top of that, `mix-blend-mode: screen` in dark mode (≈1663,
  1801) forces extra compositing passes. On a phone this causes GPU memory
  pressure, tiles being re-rasterised (flicker) and, under memory pressure,
  iOS killing the tab. **Fix:** promote only the layers that actually move,
  check the layer count in DevTools → Layers, and replace the blend modes with
  pre-mixed colours or a single blended parent.
- The progress ring animates `stroke-dashoffset` every frame (≈2147). That is a
  paint every frame. It's acceptable, but consider a `conic-gradient` mask or two
  rotating half-rings so it is composited.
- `--size` has a **permanent** `transition: --size 620ms` (≈1488), and
  `width/height: var(--size)` is a layout property. Any change to `--size`
  becomes 620ms of reflow, and that includes changes nobody asked for (see 1.3).
  **Fix:** only allow the transition while a deliberate expand or collapse is
  running, for example with a class added by `useStageExpansion`. Better still,
  do the travel with a FLIP `transform: scale()` and set the final size once.

### 1.3 Mobile viewport changes make the layout breathe on its own

`--stage-orb` and `--stage-room` are computed from `vh`/`dvh` (≈4893, 4983,
5071, 5153, 5854). On iOS Safari and Android Chrome these values change while
the URL bar collapses and expands, and when the keyboard opens. Combined with
the `--size` transition, **the orb grows and shrinks and everything under it
moves** whenever she scrolls or taps an input.

**Fix:** size layout with `svh` (the stable, smallest viewport). Use `dvh` only
for an outer container that has to fill the screen, never for something whose
size people can see. Use `lvh` for full-bleed backgrounds so they never show a
gap. Test with the URL bar collapsing and expanding and with the keyboard open:
the orb's centre and size must not move by more than 0.5px.

### 1.4 Expanding the stage — `src/lib/useStageExpansion.ts` ≈60–90, `src/lib/useFittedLine.ts`

- The GSAP tween animates `top/left/width/height` on a `position: fixed` stage.
  Those are layout properties, so every frame of the 620ms trip is a reflow.
- At the same time, `useFittedLine`'s `ResizeObserver` re-fits the spoken line
  **on every frame of that trip** (it says so itself). Each fit runs up to five
  forced synchronous layouts and writes a new `--line-fit`, so **the
  affirmation's font size changes step by step while the stage moves**.
- **Fix:** do the expansion as a FLIP `transform` and fit the line once, when
  the trip ends (`onComplete`). Freeze `--line-fit` while the stage moves. Round
  the fitted scale to steps of about 0.02, so two lines of similar length don't
  end up at slightly different sizes, which reads as a wobble from line to line.

### 1.5 Moving the breath clock off the main thread (the structural fix)

Do this after 1.1–1.4, once the per-frame properties are transform and opacity
only.

- **Goal:** the orb and the title keep breathing smoothly even when the main
  thread is busy.
- **Approach:** for the six CSS forms, build one Web Animations API (or CSS
  `@keyframes`) animation per breath *cycle* from the pattern. Its keyframes are
  sampled from `expansionAt`, about 60 points with linear easing between them,
  and it runs on the compositor with `iterations: Infinity`. Sync it to the
  engine clock with `currentTime = breathElapsed() * 1000` (or a negative
  `animation-delay`). Re-sync on pattern change, on `visibilitychange`/`pageshow`,
  on pause and resume, and on the existing heartbeat if drift goes over about
  30ms. Animate the transform and opacity of each layer directly; don't go
  through `calc(var(--e))`, because custom-property animations are not
  composited.
- Keep the rAF writer for the canvas forms (Ink Cathedral, Moonpool) and for
  anything that really needs numbers. Keep `--p` for the ring, running as its
  own linear per-phase animation.
- If the full move is too large, **at minimum**: register `--e --p --m --e-mid
  --e-far` with `@property { syntax: '<number>'; inherits: true; }`, skip the
  `setProperty` calls when the formatted value hasn't changed (holds are
  constant), and stop mirroring to elements that don't read a given property.
  Measure the style-recalc time per frame before and after.
- Make sure the once-a-second React update for the countdown can't cost a
  frame. Profile it on a throttled CPU.

### 1.6 Background canvases — `src/components/CosmicBackground.tsx` ≈121–250, `LivingCanvas.tsx`, `onboarding/SettlingField.tsx`

- `CosmicBackground` reallocates its canvas **and re-randomises every mote**
  on each `window` `resize` event. iOS fires `resize` while the URL bar moves,
  so **the star field jumps to new positions in the middle of a scroll**. **Fix:**
  size the canvas to `lvh`, reallocate only when the width changes or the height
  grows past the buffer, and keep the motes (rescale their positions instead of
  regenerating them).
- All canvas loops: stop on `visibilitychange` *and* `pagehide`, cap
  `devicePixelRatio` (most already do), release the buffer on unmount
  (`canvas.width = canvas.height = 0`), and handle `contextlost`/`contextrestored`
  for 2D contexts (Safari can drop them under memory pressure).
- `BreathStyleThumbnail` mounts a full `LivingCanvas` for each living style in
  the style picker and in `AttuneStep`. Check that thumbnails draw one frame and
  then stop. A still image would be better.

### 1.7 Other motion checks

- Search the codebase for every animated property that isn't `transform` or
  `opacity`: `filter`, `backdrop-filter`, `box-shadow`, `text-shadow`, `width`,
  `height`, `top`, `left`, `inset`, `letter-spacing`, `font-size`,
  `background-position`, gradient stops, `clip-path`. This applies to both
  `calc(var(--e…))` expressions and `@keyframes`. Grep `theme.css` (6,900
  lines) systematically. For each one, either convert it or explain in a comment
  why it's cheap.
- Backdrop blur of 16–28px (≈575–700) on bars that sit over moving content is
  among the most expensive things a phone compositor does. Lower the radius on
  low-power devices, and replace it with a solid tint under
  `prefers-reduced-transparency` where that query is supported.
- Every transition and animation: end states must equal resting styles (no
  snap), there must be no layout properties, and durations and easings must come
  from the existing tokens (`--ease-calm`, `--ease-breath`).
- Lenis is mounted on the About page. Confirm it never touches touch scrolling
  on iOS (`syncTouch` off) and isn't mounted at all when the user prefers
  reduced motion (already intended; verify).

---

## 2. Crash-proofing: it must never go blank, reload or go silent

### 2.1 No error boundary exists

`grep` finds no `ErrorBoundary`, no `componentDidCatch` and no route
`errorElement`. **Any exception during render turns the app into a white
screen.**

- Add a top-level boundary plus one per route (and one around the player
  stage). Each shows a calm, on-brand recovery card ("Something slipped. Tap to
  continue."), not a stack trace, and **keeps the audio session running** if it
  can. The session lives in providers and engines above the routes, so put the
  boundaries below them.
- Catch dynamic-import failures (`lazy()` chunks in `AboutRoute.tsx`,
  `AstrologySection.tsx`, and so on). Detect `ChunkLoadError` or "Failed to
  fetch dynamically imported module", and reload once (guard with a
  `sessionStorage` flag so it can't loop).
- Add `window.onerror` and `unhandledrejection` handlers that write to a small
  local ring buffer (no network, which fits the app's privacy promise). Add a
  hidden "Copy diagnostics" button in About so a bug report can include it.

### 2.2 Service-worker updates in the middle of a session — `vite.config.ts` ≈261, 462–463

`registerType: 'autoUpdate'` with `skipWaiting` and `clientsClaim` means a new
deploy takes control straight away. **Verify:** with `autoUpdate`,
`virtual:pwa-register` reloads the page when the new worker takes control. A
reload during a breathing session looks exactly like a crash. Old lazy chunks
can also disappear from the cache under a running page.

**Fix:** switch to `registerType: 'prompt'` (or keep the update silent) and only
apply the update when no session is active: on next cold launch, or when the app
is idle and hidden. Keep old precached chunks until the new worker is in use.

### 2.3 `isLowPowerDevice()` creates a new WebGL context on every call — `src/lib/motion.ts` ≈71–100

`hasSoftwareRendering()` creates a WebGL context and never releases it. It is
called from `audio.ts` (3 call sites), `CosmicBackground`, `SettlingField`,
`PlayerAtmosphere` and `useStageExpansion` (where it runs again on every
expansion). Browsers limit live WebGL contexts (Safari drops the oldest), and
each context holds GPU memory until garbage collection.

**Fix:** compute the answer once at module scope, cache it, and call
`gl.getExtension('WEBGL_lose_context')?.loseContext()` right away. Also
**verify** what this heuristic returns on a current iPhone: Safari doesn't
expose `deviceMemory`, and `hardwareConcurrency` may be reported low, which
would wrongly put every iPhone in "low power" mode. Decide on purpose what an
iPhone should get.

### 2.4 Audio across interruptions

- There are at least three `AudioContext` constructors (`audioBus.ts:252`,
  `breathAudio.ts:131`, `recorder.ts:130`). **Verify** how many are alive at the
  same time during a session. iOS handles several contexts badly: they drift
  apart and are interrupted separately. Use one shared context if you can.
- `audioBus.ts` handles iOS's `interrupted` state. **Verify** that
  `breathAudio`'s shared context and the TTS player do too, and that all of them
  recover after: a phone call, Siri, an alarm, locking and unlocking, AirPods
  disconnecting and reconnecting, switching apps for 5 minutes, and Control
  Centre play/pause through the Media Session controls.
- On recovery, the breath voice and the visual must still agree (the
  `breathEngine` clock is the source of truth).

### 2.5 Screen wake lock — `src/state/SessionProvider.tsx` ≈676

The browser releases a wake lock whenever the page is hidden. **Verify** that it
is requested again on `visibilitychange` → visible while a session is running,
and that a failure (unsupported, low-power mode) is ignored quietly.

### 2.6 Studio Voice (Kokoro-82M in the browser) on a phone

`browserKokoro.ts` runs an ONNX model in a worker through transformers.js. On an
iPhone, the download, the WASM memory and inference can go over the tab's
memory limit, and Safari then kills the page. **Verify and make sure** that:

- it never starts on its own;
- install is offered only when the device can probably handle it, and the
  warning says how big the download is;
- the worker is terminated when idle and on `pagehide`;
- any failure falls back to the pregenerated or device voice without
  interrupting the session.

Use Safari's Web Inspector Timelines to watch memory during install and
synthesis on a real iPhone.

### 2.7 Memory over a long session

Run a 60-minute session on a real iPhone, and on a mid-range Android phone if
you can get one, with the screen on, every breath style in turn, voice and
ambience playing. Memory must level off: no growing number of detached nodes,
`AudioBuffer`s, `ResizeObserver`s, GSAP tweens or canvases. Check that every
`useEffect` that subscribes to something also unsubscribes.

### 2.8 Storage

- Wrap every `localStorage` and IndexedDB access in try/catch and handle
  `QuotaExceededError` and private-browsing failures. Grep finds 19 call sites;
  check each one.
- Safari can delete a site's storage after about 7 days without use when it
  isn't installed to the home screen. Gently suggest installing (an
  `InstallPrompt` already exists) and make the backup in `LibraryBackupPanel`
  easy to find, so she never loses her saved loops.
- Call `navigator.storage.persist()` after the first saved loop, where it is
  supported.

---

## 3. Accessibility: everything that could be better

### 3.1 Motion choices inside the app

The app only follows the OS `prefers-reduced-motion` setting, which many people
have never heard of. Add a **Motion** setting in Appearance with three choices:
**Full / Gentle / Still**. It defaults to the OS preference and is stored in
`PreferencesProvider`.

- **Gentle:** about half the swing, no full-viewport atmosphere breathing, no
  per-letter blur, no parallax. The orb still breathes.
- **Still:** the current reduced-motion behaviour (the phase ring and the words
  stay; everything else is static).

All motion code reads one source (extend `useReducedMotion` into a
`useMotionLevel`).

### 3.2 Contrast

- Light theme: `--ink-faint: #8a7c71` on the light background (`#EFE7DC`) is
  about **3.3:1**, which fails WCAG AA's 4.5:1 for normal text. The "breaths a
  minute" label in `BreathingVisualizer.tsx` also adds `opacity-70` and
  `text-[0.68rem]`, which makes it much worse.
- Check every text token against every background it sits on, in both themes,
  including text over the moving atmosphere at its brightest frame. Fix the
  tokens rather than individual uses.
- Support `prefers-contrast: more` with solid backgrounds behind text, no
  translucent ink and thicker focus rings.

### 3.3 Text size and readability

- Nothing below 12px. Text is commonly set at 0.68–0.8rem today; review every
  `text-[0.6x–0.7x rem]` use.
- Inputs and textareas must be at least 16px, or iOS zooms in on focus and the
  layout jumps.
- Respect user text scaling: test with the browser at 200% text size and with
  iOS Larger Text. Consider `font: -apple-system-body` on `html`, scaling the
  `rem` base, so iOS Dynamic Type works. `useFittedLine`'s `MIN_SCALE` must
  never shrink an enlarged affirmation below the user's own base size. Let the
  box grow instead.
- Don't use `maximum-scale` or `user-scalable=no` (the viewport meta is fine
  today; keep it that way).

### 3.4 Screen readers (test with VoiceOver on iPhone)

- `BreathingCaption` (`BreathingVisualizer.tsx` ≈344) is `aria-live="polite"`
  **and includes the seconds**, so VoiceOver may announce it **every second**.
  Announce only the phase change ("Breathe in"); mark the seconds
  `aria-hidden`.
- The orb's `role="img"` `aria-label` also changes every second. Make sure it
  doesn't chatter when focused. A stable label plus one live region for phase
  changes is enough.
- Every icon-only button needs an accessible name. Sheets and menus need a
  focus trap, `Escape` and swipe-to-close, focus returned to the element that
  opened them, and `aria-modal`. Toggles, sliders and segmented controls need
  correct roles and values (`Slider.tsx`, `Toggle.tsx`, `SegmentedControl.tsx`).
- Add an off-by-default **spoken breath cue** option for people who can't see
  the orb. The audio engine already supports cues; just make it easy to find.

### 3.5 Touch and keyboard

- Every tap target at least 44×44pt, with at least 8px between neighbours.
  Check the player dock, the corner controls (`theme.css` ≈5700–5712), the
  sliders and the menu items.
- Visible `:focus-visible` styles on everything interactive (there are only 9
  `focus-visible` rules today). Logical tab order. No keyboard traps. Works
  with an external keyboard and with iOS Switch Control.
- Respect the safe areas everywhere, including the bottom dock above the home
  indicator, and in landscape.
- Nothing should rely on gestures alone. Any swipe or drag (`DragBar.tsx`,
  `touch-action: none` at ≈6080) needs a button alternative.

### 3.6 Other

- No flashing more than 3 times a second anywhere (WCAG 2.3.1).
- Haptics: `navigator.vibrate` doesn't exist in iOS Safari. Make sure no
  setting promises vibration on iOS; hide the option or label it "Android only".
- Landscape works without clipping. Rotating during a session doesn't restart
  anything.
- Loading and empty states announce themselves. Errors are written in plain,
  kind language and say what to do next.
- Run axe-core on every route in both themes; zero serious or critical issues.

---

## 4. Real-device test plan (must be done, not assumed)

| Device | Mode | What to do |
|---|---|---|
| iPhone, current iOS, Safari | Browser tab and home-screen PWA | Every breath style, cinema type on and off, expand and collapse, scroll with the URL bar moving, keyboard open in Create, lock the screen for 5 minutes, take a phone call, disconnect AirPods, 60-minute session |
| iPhone with Low Power Mode on | PWA | Same, and confirm the low-power path looks good rather than broken |
| Mid-range Android, Chrome | Browser and installed | Same, plus 6× CPU throttle in remote DevTools |
| Desktop Chrome and Safari | — | Regression check, DevTools Rendering → Paint flashing, Layer borders, Frame rendering stats |

Turn on in turn: Reduce Motion, Increase Contrast, Larger Text (largest),
VoiceOver, Dark and Light mode.

## 5. Automated checks to add

- **A Playwright motion probe** (the browser is preinstalled; use
  `require('playwright')`, don't install it again). Emulate `iPhone 13` and
  `Pixel 7`. Start a session, then for one full breath cycle sample the
  following every animation frame:
  - `.cinema__word`'s `getBoundingClientRect()`: height constant to 0.5px, so
    no re-wraps;
  - the orb's centre: constant to 0.5px;
  - `.stage__line-text`'s computed `font-size` during an expansion: changes at
    most once.

  Then resize the viewport height by 80px (a simulated URL bar) and assert the
  orb's size and centre don't change.
- **Long-task check:** with `PerformanceObserver('longtask')`, no task over 50ms
  during a steady-state session after the first 5 seconds.
- **axe-core** on each route in both themes.
- **Error-boundary test:** force a render throw in one route and assert the
  recovery card appears and the session state survives.
- Keep all existing vitest suites green.

## 6. Acceptance criteria

- No visible jitter, crawl, snap or re-wrap in the cinema title, the orb, the
  countdown or the spoken line, on a real iPhone, in any breath style.
- Steady-state session: frame times ≤ 16.7ms on mid-range Android at 60Hz, with
  no layout and no paint of the cinema text during a breath (confirm with Paint
  flashing).
- The orb doesn't move when the URL bar or keyboard appears.
- No unhandled error can produce a blank screen. No reload during a session.
  Audio recovers from every interruption in §2.4.
- 60-minute session: memory levels off, no crash.
- WCAG 2.2 AA: contrast, target size, focus visible, reflow at 320px, text
  resize to 200%. Zero serious axe issues.
- The in-app Motion setting works, and `prefers-reduced-motion` still works.
- Typecheck, tests and build pass.

## 7. What to hand back

1. A short report: each item above marked **fixed** (with before and after
   numbers), **verified not a problem** (with how you checked) or **deferred**
   (with the reason).
2. The commits, pushed to the working branch.
3. A list of anything that needs testing by hand on her actual phone that you
   couldn't test yourself.
