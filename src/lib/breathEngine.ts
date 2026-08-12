/**
 * The breath, as an engine rather than as a component.
 *
 * ── What was wrong ──
 *
 * The guide used to live inside the player: one `requestAnimationFrame` loop
 * that computed the breath, wrote it onto the orb, *and* told the voice when a
 * phase had turned. That is a perfectly reasonable shape for something you are
 * looking at, and it has two failures that only appear when you stop looking.
 *
 * Switch to another tab and animation frames stop. The loop stops with them, so
 * the phase turn that was due four seconds later never arrives, the voice is
 * never told, and the sound holds whatever it was last asked for — a sustained
 * voice sits at the top of an inhale for as long as you are away, a struck one
 * simply falls silent. Come back and the clock has moved twelve seconds; the
 * next frame lands in a completely different phase and the guide lurches.
 *
 * Leave the player for the library and the component unmounts. Its cleanup
 * stopped the voice outright, so the ambience and the words carried on while
 * the breath cues vanished, and returning started the breath again from zero,
 * out of step with the session that had never stopped.
 *
 * ── What it is now ──
 *
 * One engine at module scope, owned by the session rather than by a screen.
 * Nothing about it is mounted, so nothing about it can unmount. It has two
 * halves that do not depend on each other:
 *
 *  · **The clock** is the wall clock. Elapsed time is banked when the guide
 *    pauses and measured from `performance.now()` while it runs, so a stalled
 *    tab, a slow frame or twenty minutes in another application change where
 *    the breath *is* not at all — only when anyone next asks.
 *
 *  · **The sound is written ahead.** Every heartbeat (see `heartbeat.ts`) the
 *    engine asks what phases begin within the next `LOOKAHEAD_SECONDS` and
 *    hands each of them to the audio clock at its exact moment. The audio
 *    thread then plays them whether or not this page is being rendered,
 *    scheduled, or thought about. A heartbeat that arrives twice as late as it
 *    should — which is what a hidden tab does to a timer — costs nothing,
 *    because the sound it would have scheduled was scheduled seconds ago.
 *
 * The visible guide is a *reader* of this clock, not its owner: `useBreathing`
 * subscribes, draws frames while the page is visible, and stops drawing when it
 * is not. Which is the correct behaviour for a picture, and now has no bearing
 * whatsoever on the sound.
 */

import {
  activePhases,
  breathStateAt,
  cycleSeconds,
  isPatternValid,
  DEFAULT_PATTERN,
  type BreathPattern,
  type BreathPhase,
  type BreathState,
} from './breathing'
import {
  breathContext,
  findVoice,
  liveBreathVoice,
  primeBreathAudio,
  type BreathSound,
} from './breathAudio'
import { haptic } from './feedback'
import { beat, onHeartbeat } from './heartbeat'

/**
 * How far ahead the audio clock is written.
 *
 * Generously more than any plausible gap between heartbeats. Even Chrome's
 * harshest background clamp — one timer a minute — cannot silence more than the
 * tail of this, and the audio-clock ticker in `heartbeat.ts` means that clamp is
 * not reached in the first place. Eight seconds is also comfortably longer than
 * the longest single phase any preset has (ten), which keeps the arithmetic
 * below honest: there is always at least one whole phase inside the horizon.
 */
const LOOKAHEAD_SECONDS = 8

/**
 * A boundary this recently past still counts as "just now" for haptics.
 *
 * The heartbeat is half a second, so a turn is noticed up to half a second
 * late; buzzing a wrist a second after the breath turned is worse than not
 * buzzing it, and this is the line between the two.
 */
const TURN_GRACE_SECONDS = 0.6

export interface BreathEngineConfig {
  pattern: BreathPattern
  sound: BreathSound
  volume: number
  haptics: boolean
}

/** What a subscriber is told when the breath turns. */
export interface BreathTurn {
  phase: BreathPhase
  /** Whole breaths completed since the guide started. */
  breaths: number
}

type Listener = (turn: BreathTurn) => void

let config: BreathEngineConfig = {
  pattern: DEFAULT_PATTERN,
  sound: 'off',
  volume: 0.6,
  haptics: false,
}

let active = false
/** Seconds banked from previous runs. */
let banked = 0
/** `performance.now()` at which the current run began, or 0 when stopped. */
let startedAt = 0

/**
 * Elapsed seconds up to which phases have been handed to the audio clock.
 * `-1` means nothing is scheduled, which is also the state after any change
 * that invalidates what was.
 */
let scheduledThrough = -1

/** The phase the wall clock was last observed to be in. */
let lastPhase: BreathPhase | null = null

const listeners = new Set<Listener>()
let release: (() => void) | null = null

/* ── The clock ──────────────────────────────────────────────── */

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/** Seconds into the guide, wall-clock measured and pause-aware. */
export function breathElapsed(): number {
  return active && startedAt > 0 ? banked + (now() - startedAt) / 1000 : banked
}

/** The full breath state at this instant — what the orb is drawn from. */
export function breathStateNow(): BreathState {
  return breathStateAt(config.pattern, breathElapsed())
}

export function breathConfig(): BreathEngineConfig {
  return config
}

export function isBreathActive(): boolean {
  return active && isPatternValid(config.pattern)
}

/* ── Phase arithmetic ───────────────────────────────────────── */

export interface Placed {
  phase: BreathPhase
  /** Elapsed seconds at which this phase begins. */
  startsAt: number
  duration: number
}

/**
 * Which phase `elapsed` falls in, and exactly when that phase began.
 *
 * `breathStateAt` answers "where am I", which is what a picture needs.
 * Scheduling needs "when did this start and when does the next one", so the
 * walk is done here in absolute elapsed seconds rather than in an offset that
 * has already been folded back into one cycle.
 */
export function placeAt(pattern: BreathPattern, elapsed: number): Placed | null {
  const phases = activePhases(pattern)
  const total = cycleSeconds(pattern)
  if (phases.length === 0 || total <= 0) return null

  const cycle = Math.floor(elapsed / total)
  let cursor = cycle * total
  let offset = elapsed - cursor

  for (const phase of phases) {
    const duration = pattern[phase]
    if (offset < duration) return { phase, startsAt: cursor, duration }
    offset -= duration
    cursor += duration
  }

  // Floating point can land a hair past the end of the last phase.
  const last = phases[phases.length - 1]
  return {
    phase: last,
    startsAt: cursor - pattern[last],
    duration: pattern[last],
  }
}

/** The phase that begins exactly where the previous one ended. */
export function placeAfter(
  pattern: BreathPattern,
  endsAt: number,
): Placed | null {
  // A hair past the boundary, so a phase of zero length cannot be re-selected.
  return placeAt(pattern, endsAt + 1e-6)
}

/* ── Writing the sound down in advance ──────────────────────── */

/**
 * Bring the audio schedule up to the horizon.
 *
 * Idempotent by construction: it works out what *should* already have been
 * scheduled from the wall clock and schedules only the part that has not been.
 * Called twice in a millisecond it does nothing the second time; called once
 * after a minute away it catches up in one pass.
 */
function pump(): void {
  if (!active) return

  const pattern = config.pattern
  if (!isPatternValid(pattern)) return

  const elapsed = breathElapsed()
  noticeTurn(pattern, elapsed)

  if (config.sound === 'off') return

  const ctx = breathContext()
  const voice = liveBreathVoice()
  if (!ctx || !voice) return
  // A suspended or interrupted context has a frozen `currentTime`; anything
  // scheduled against it would land at the wrong moment. `keepAwake` is already
  // trying to bring it back — this simply declines to guess in the meantime.
  if (ctx.state !== 'running') return

  const ctxNow = ctx.currentTime
  /** Elapsed seconds → context seconds, re-derived every pass so drift between
   *  the two clocks corrects itself rather than accumulating. */
  const at = (seconds: number) => ctxNow + (seconds - elapsed)

  const sustained = findVoice(config.sound)?.sustained ?? false
  const horizon = elapsed + LOOKAHEAD_SECONDS

  if (scheduledThrough < elapsed) {
    /*
     * Nothing scheduled, or the clock jumped past what was — a resumed session,
     * a pattern edit, a device that went to sleep mid-breath.
     *
     * A sustained voice is placed into the *middle* of the phase we are
     * actually in, over whatever is left of it, so resuming into an out-breath
     * sounds like an out-breath. A struck voice waits for a real turn instead:
     * ringing a bell to announce a breath that began four seconds ago is worse
     * than staying quiet until the next one.
     */
    const here = placeAt(pattern, elapsed)
    if (!here) return
    const remaining = here.startsAt + here.duration - elapsed
    if (sustained && remaining > 0.05) voice.phase(here.phase, remaining)
    else voice.resetSchedule()
    scheduledThrough = here.startsAt + here.duration
  }

  // And then whole phases, at their exact moments, out to the horizon.
  let guard = 0
  while (scheduledThrough < horizon && guard < 64) {
    guard += 1
    const next = placeAfter(pattern, scheduledThrough)
    if (!next) return
    voice.phase(next.phase, next.duration, at(next.startsAt))
    scheduledThrough = next.startsAt + next.duration
  }
}

/**
 * Notice, in real time, that the breath has turned — for the things that cannot
 * be scheduled.
 *
 * Sound is written ahead; a wrist buzz cannot be. So this watches the wall
 * clock instead and fires on the crossing, skipping any turn it learns about
 * too late to be honest about. Subscribers hear it too, which is how the
 * player's phase label and countdown stay right without owning a clock of
 * their own.
 */
function noticeTurn(pattern: BreathPattern, elapsed: number): void {
  const here = placeAt(pattern, elapsed)
  if (!here) return
  if (here.phase === lastPhase) return

  const previous = lastPhase
  lastPhase = here.phase

  const state = breathStateAt(pattern, elapsed)
  const turn: BreathTurn = { phase: here.phase, breaths: state.completedBreaths }

  // The phase we happened to start inside is not a turn.
  if (previous !== null && elapsed - here.startsAt <= TURN_GRACE_SECONDS) {
    if (config.haptics) {
      haptic(
        here.phase === 'inhale'
          ? 'inhale'
          : here.phase === 'exhale'
            ? 'exhale'
            : 'hold',
      )
    }
  }

  for (const listener of [...listeners]) {
    try {
      listener(turn)
    } catch {
      /* A subscriber's problem, not the breath's. */
    }
  }
}

/**
 * Throw away the schedule and rebuild it from where the sound actually is.
 *
 * Every change that makes what was written down untrue goes through here: a new
 * pattern, a new voice, a resumed session. The alternative — letting eight
 * seconds of the old pattern play out under a new one — is exactly the "why did
 * the sound change?" that this whole pass exists to remove.
 */
function invalidate(): void {
  scheduledThrough = -1
  liveBreathVoice()?.resetSchedule()
}

/* ── The public surface ─────────────────────────────────────── */

/**
 * Set what the guide is doing. Only the fields given are changed.
 *
 * Changing the volume moves a fader; changing the pattern or the voice rebuilds
 * the schedule. Nothing here ever restarts the clock — the breath you are in
 * the middle of is not interrupted by turning its volume down.
 */
export function configureBreath(patch: Partial<BreathEngineConfig>): void {
  const previous = config
  config = { ...config, ...patch }

  const patternChanged =
    patch.pattern != null &&
    (previous.pattern.inhale !== config.pattern.inhale ||
      previous.pattern.holdIn !== config.pattern.holdIn ||
      previous.pattern.exhale !== config.pattern.exhale ||
      previous.pattern.holdOut !== config.pattern.holdOut)

  const soundChanged = previous.sound !== config.sound

  if (patternChanged) {
    // A new pattern begins a new breath. Continuing five seconds into a cycle
    // that is now four seconds long would be arithmetic rather than breathing.
    banked = 0
    startedAt = active ? now() : 0
    lastPhase = null
  }

  if (config.volume !== previous.volume) {
    liveBreathVoice()?.setVolume(config.volume)
  }

  if (soundChanged) {
    const voice = liveBreathVoice()
    if (config.sound === 'off') voice?.stop()
    else if (active) {
      voice?.setVoice(config.sound)
      voice?.setVolume(config.volume)
      voice?.start()
    }
  }

  if (patternChanged || soundChanged) {
    invalidate()
    if (active) beat()
  }
}

/**
 * Start or stop the guide.
 *
 * Stopping banks the elapsed time rather than discarding it, so a paused
 * session resumes mid-breath instead of beginning again — which is what makes
 * pausing feel like holding still rather than like starting over.
 */
export function setBreathActive(on: boolean): void {
  if (on === active) return

  if (on) {
    // The context has to exist before anything can be scheduled against it, and
    // it can only be opened from a gesture — which is where the press that
    // started the session already put us.
    primeBreathAudio()
    active = true
    startedAt = now()
    lastPhase = null
    scheduledThrough = -1

    const voice = liveBreathVoice()
    if (voice && config.sound !== 'off') {
      voice.setVoice(config.sound)
      voice.setVolume(config.volume)
      voice.start()
    }

    if (!release) release = onHeartbeat(pump)
    beat()
    return
  }

  banked = breathElapsed()
  active = false
  startedAt = 0
  scheduledThrough = -1
  lastPhase = null
  liveBreathVoice()?.stop()
  release?.()
  release = null
}

/** Begin the guide again from the top of an in-breath. */
export function resetBreath(): void {
  banked = 0
  startedAt = active ? now() : 0
  scheduledThrough = -1
  lastPhase = null
  liveBreathVoice()?.resetSchedule()
  if (active) beat()
}

/**
 * Hear about every phase turn.
 *
 * This is what the visible guide uses for its phase name and countdown. It is
 * deliberately *not* how the guide gets its expansion value — that is read
 * from `breathStateNow()` on every animation frame, because sixty React
 * renders a second to move a circle would be a strange way to pay for smooth.
 */
export function subscribeBreath(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test-only: put the engine back the way it was found. */
export function resetBreathEngine(): void {
  setBreathActive(false)
  listeners.clear()
  config = {
    pattern: DEFAULT_PATTERN,
    sound: 'off',
    volume: 0.6,
    haptics: false,
  }
  banked = 0
}

/** Test-only: the schedule's horizon, in elapsed seconds. */
export function breathScheduledThrough(): number {
  return scheduledThrough
}

/** Test-only: run one scheduling pass without waiting for a heartbeat. */
export function pumpBreath(): void {
  pump()
}
