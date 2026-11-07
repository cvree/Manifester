# Report: smooth motion, accessibility and phone reliability

The results of working through
[`smooth-motion-and-mobile-reliability.md`](./smooth-motion-and-mobile-reliability.md).

Measurements were taken in headless Chromium emulating a Pixel 7 and an
iPhone 13. That browser composites on the CPU, so absolute frame times are
slower than on a real phone. What carries over is the *work* per frame: how
many layouts, how much style recalculation, and whether things move.

## Measured before and after

| What | Before | After |
|---|---|---|
| Layouts per second during a session (Pixel 7) | 33–43 | 2 |
| Layout time per second | 8–10 ms | 0.5 ms |
| Height of "Breathe in" box across a breath | changes by 3 px | constant to the pixel |
| Frames rendered in 10 s, same machine and load | 315–328 | 318–345 |
| Long tasks over 50 ms in a 15 s steady session | not measured | none |
| axe-core WCAG 2.2 AA, 6 screens × 2 themes | 3 violations | 0 |
| Pages wider than a 320 px screen | 6 of 7 | 0 of 7 |
| State line overlapping the corner controls | 3 of 4 phone/mode combinations | 0 |

## Fixed

**1.1 Cinematic title.**
- Letter-spacing is no longer animated. The breath opens the phrase with a
  `translate` on each glyph instead, measured from the centre of the line it
  sits on.
- The text shadow no longer changes every frame, and the live text is no
  longer scaled.
- The resolve animation's last frame now matches the resting style, so letters
  don't snap a pixel as they settle.
- The countdown changes in place instead of being re-created every second.
- Sizes use `svh` instead of `vh`.

**1.2 / 1.3 Orb and viewport.** The orb's size formulas use `svh`/`lvh`
instead of `vh`/`dvh`. The URL bar and the keyboard no longer resize the orb
through its 620 ms size transition.

**1.4 Stage expansion.** The spoken line is held at its size while the stage
travels and fitted once when it lands. Fitted sizes snap to steps of 0.02.

**1.5 (partial).** The breath writer skips custom properties whose value
hasn't changed. The session's 250 ms timer no longer re-renders every screen
that reads the session when nothing visible has changed.

**1.6 Background.** The star field:
- keeps its motes when the URL bar resizes the window, instead of scattering
  them to new random positions;
- only reallocates its canvas on a width change or growth;
- advances by measured time, so a 120 Hz screen no longer runs it twice as
  fast;
- frees its pixels on unmount.

**2.1 Error boundaries.**
- One boundary wraps each screen, below the session. A broken screen leaves
  the breath and the voice running, and navigating away clears it. This was
  checked by forcing a lazy chunk to fail mid-session.
- One boundary wraps the whole app as a last resort.
- Errors go to a small log kept on the device. About has a card that copies
  it.

**2.2 Service worker.** `autoUpdate` reloaded the page the moment a new
version activated (confirmed in `vite-plugin-pwa`'s client). The reload now
waits until no session is playing or paused and the person is coming back to
the app.

**2.3 GPU check.** The check runs once and releases its WebGL context
explicitly.

**2.5 Wake lock.** The wake lock is requested again when she returns to the
app. The browser releases it on hide, and the stale handle used to block
re-requesting, so the screen could dim mid-session.

**2.6 Studio Voice.** Resuming the voice model on launch is guarded: if the
last attempt never finished (the page was killed for memory), the next launch
skips it instead of crashing the same way every time.

**2.8 Storage.**
- If iOS closes the IndexedDB connection in the background, the app reopens
  it and retries once, instead of failing every save until relaunch.
- Persistent storage is requested after the first saved loop.

**3.1 Motion setting.** Appearance has a Motion setting with three choices:
**Full / Gentle / Still**. The device's Reduce Motion always wins.

**3.2 Contrast.**
- Light-theme faint ink `#8a7c71` → `#6e6359`, and deep rose `#9d5a65` →
  `#8f4f5a`. Both now clear 4.5:1 on every light background.
- `prefers-contrast: more` (the phone's Increase Contrast) is supported.

**3.3 Text size.**
- No text is under 12 px.
- Inputs are at least 16 px, so iOS doesn't zoom the page on focus.

**3.4 Screen readers.**
- Phase changes are announced; seconds are not.
- The elapsed clock is a `timer` instead of a live region.
- The hidden file input has a name.

**Layout.**
- On phones the state line drops below the corner controls instead of
  running under them.
- The header fits a 320 px screen.

**Tests.** The audio test harness left a `resume()` rejection unhandled, which
showed up as an intermittent stray error under load. That is fixed, and the
full suite passed 5 of 5 runs afterwards.

## Checked and found fine

- **Focus rings.** A global `:focus-visible` ring exists. The drag bar
  replaces its outline with a visible ring on the handle.
- **Tap targets.** Every control on the main screens is at least 44 × 44. The
  one exception is an inline link inside a sentence, which the guideline
  exempts.
- **Vibration.** The vibration toggles are disabled, with an explanation,
  where the browser can't vibrate (iPhone Safari).
- **Audio contexts.** There are two by design, and both recover from iOS's
  `interrupted` state as well as `suspended`. The recorder opens its own only
  while recording.
- **Storage access.** All `localStorage` access goes through try/catch
  wrappers.
- **"Delete everything"** clears the new error log, because it clears all
  local storage.

## Deferred, with reasons

- **1.5 moving the breath onto the compositor (Web Animations).** About 40
  layers across six forms are driven by `calc(var(--e))`. Rebuilding them as
  keyframe animations risks changing the look, and that can't be checked
  without a real phone. Once the title stopped causing layout, style
  recalculation costs about 3 ms a frame on this CPU-only test browser, and
  there were no long tasks. Revisit if a real device still shows hitches.
- **FLIP-transform stage expansion.** Scaling the stage would distort its
  rounded corners and contents in mid-flight. The visible symptom (the words
  resizing on every frame) is fixed. The remaining 620 ms of layout happens
  once per tap.
- **Dark-mode `mix-blend-mode: screen` on the petals and veils.** That
  blending is what makes them glow, so removing it would change the design.
  The layers are bounded by `isolation: isolate`.
- **iOS Dynamic Type (`font: -apple-system-body`).** This would rescale the
  whole type system. The type is already in `rem` and works with browser zoom.
- **Whether `isLowPowerDevice()` marks every iPhone as low-power.** Safari
  doesn't expose `deviceMemory`, and what it reports for
  `hardwareConcurrency` needs checking on a real device.

## Needs a real phone

Test on her iPhone, once in Safari and once installed to the home screen:

1. Start a session with Cinematic typography on, and watch "Breathe in /
   Breathe out" for a few minutes. It should open and close smoothly, with no
   shimmer.
2. Scroll the Player so the URL bar collapses and expands. The orb should
   stay the same size.
3. Expand the stage. The words should change size at most once.
4. Lock the phone for five minutes during a session, then unlock. The audio
   should still be playing, and the screen shouldn't dim while she watches.
5. Take or decline a call during a session. The audio should come back.
6. Settings → Accessibility → Motion → Reduce Motion: the app should go
   still. Then turn it off and try Appearance → Motion → Gentle.
7. Settings → Accessibility → Display & Text Size → Increase Contrast: the
   quiet labels should get firmer.
8. Run VoiceOver for one breath: it should announce "Breathe in", "Breathe
   out" and nothing every second.
9. Run a 60-minute session. It shouldn't crash or slow down.
