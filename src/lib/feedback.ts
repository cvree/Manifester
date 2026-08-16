/**
 * Touch feedback: what a control does when you press it.
 *
 * Two answers, from one call. `cue('save')` both plays the save cue and fires
 * the save haptic, so a component never has to know which of the two a
 * particular device or a particular person's settings will actually produce.
 *
 * The sound design lives next door in `cueSounds.ts` — the note tables, the
 * envelopes, and the ceiling that keeps any of it from ever rising over a
 * spoken affirmation. This file is the part that has to survive contact with a
 * real app: opening the audio hardware only when a gesture allows it, refusing
 * to let a dragged slider turn into a rattle, and ducking out of the way while
 * words are being spoken.
 *
 * ── Why cues came back ──
 *
 * They were removed once, and the reason given was right: the old family of
 * synthetic confirmation chimes was more noticeable than useful in a nighttime
 * product. The answer to that is a quieter, warmer vocabulary, not silence —
 * an app where every control answers with nothing at all feels unresponsive
 * rather than calm. So they are back, an order of magnitude below where they
 * were, and they are still off in one press for anybody who disagrees.
 */

import { openCueContext } from './breathAudio'
import {
  CUE_DESIGNS,
  cueAllowed,
  cueIsAudible,
  renderCue,
  type Cue,
} from './cueSounds'

export type { Cue } from './cueSounds'

/**
 * The trim every cue passes through, before the ducking below.
 *
 * The designs already carry their own peaks; this is the one number to move if
 * the whole vocabulary ever needs to sit lower.
 */
const CUE_BUS_GAIN = 1

/**
 * How far cues step back while something is being spoken.
 *
 * The affirmation is the point of the app and a cue is punctuation around it.
 * They rarely overlap — most cues come from a tap, and taps mostly happen
 * between lines — but the ones that do (adjusting a slider mid-session, opening
 * the mixer over a running loop) must not compete with the words. Under a
 * spoken line a cue is barely there; that is the intended result.
 */
const DUCKED_GAIN = 0.45
/** Long enough not to be a step, short enough that the next cue is already down. */
const DUCK_RAMP_SECONDS = 0.12

const PATTERNS: Partial<Record<Cue, number | number[]>> = {
  tap: 7,
  select: 5,
  start: 12,
  stop: 14,
  save: [8, 28, 10],
  inhale: 12,
  exhale: 18,
  hold: 6,
  complete: [12, 48, 22],
  error: [24, 45, 24],
}

let hapticsEnabled = true
let soundEnabled = false
let ducked = false

/** Interface cues are audible again; this is the switch that governs them. */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
  if (!enabled) return
  // Nothing is opened here: a preference restored on load is not a gesture, and
  // a browser would refuse. The first tap opens the hardware — see `cue`.
}

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled
}

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** True where the browser can synthesise at all. */
export function soundSupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    typeof window.AudioContext === 'function' ||
    typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext ===
      'function'
  )
}

/**
 * Step the cues down while a voice is speaking.
 *
 * Called by the session provider from the status the voice layer already
 * publishes, rather than read from here, so this module never has to import
 * the whole TTS stack to find out whether it should be quiet.
 */
export function setCueDucking(active: boolean): void {
  if (ducked === active) return
  ducked = active
  const bus = cueBus
  const ctx = busContext
  if (!bus || !ctx) return
  const now = ctx.currentTime
  bus.gain.cancelScheduledValues(now)
  bus.gain.setValueAtTime(bus.gain.value, now)
  bus.gain.linearRampToValueAtTime(busLevel(), now + DUCK_RAMP_SECONDS)
}

function busLevel(): number {
  return ducked ? CUE_BUS_GAIN * DUCKED_GAIN : CUE_BUS_GAIN
}

/* ── Gesture bookkeeping ─────────────────────────────────────── */

let sawGesture = false
if (typeof window !== 'undefined') {
  const remember = () => {
    sawGesture = true
    window.removeEventListener('pointerdown', remember)
    window.removeEventListener('keydown', remember)
  }
  window.addEventListener('pointerdown', remember, { once: true, passive: true })
  window.addEventListener('keydown', remember, { once: true })
}

function mayVibrate(): boolean {
  if (!hapticsSupported()) return false
  const activation = (
    navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
  ).userActivation
  return activation ? activation.hasBeenActive : sawGesture
}

export function haptic(name: Cue): void {
  const pattern = PATTERNS[name]
  if (!hapticsEnabled || pattern == null || !mayVibrate()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* Hidden pages and a few embedded browsers refuse vibration. */
  }
}

/* ── The audio side ──────────────────────────────────────────── */

let busContext: AudioContext | null = null
let cueBus: GainNode | null = null

/** Voices currently ringing, with the time each is due to have finished. */
let voicesEndingAt: number[] = []
const lastPlayedAt = new Map<Cue, number>()
let lastAnyAt = 0

/**
 * The node cues connect to, opening the hardware if a gesture allows it.
 *
 * Returns null rather than throwing anywhere audio is unavailable, refused, or
 * simply not wanted — a browser with no `AudioContext`, a page that has not
 * been touched yet, a person who has turned cues off.
 */
function bus(): { ctx: AudioContext; node: GainNode } | null {
  const ctx = openCueContext()
  if (!ctx) return null

  if (busContext !== ctx || !cueBus) {
    const node = ctx.createGain()
    node.gain.value = busLevel()
    node.connect(ctx.destination)
    busContext = ctx
    cueBus = node
    voicesEndingAt = []
  }

  return { ctx, node: cueBus }
}

function pruneVoices(contextTime: number): number {
  voicesEndingAt = voicesEndingAt.filter((endsAt) => endsAt > contextTime)
  return voicesEndingAt.length
}

function play(name: Cue): void {
  if (!soundEnabled || !cueIsAudible(name)) return

  const wiring = bus()
  if (!wiring) return
  const { ctx, node } = wiring

  const design = CUE_DESIGNS[name]
  const at = ctx.currentTime
  const now = Date.now()

  /*
   * Three guards, answering three different kinds of spam: the same cue
   * repeating faster than it reads as one gesture, any two cues landing on top
   * of one another, and enough overlapping tails to turn a vocabulary into a
   * wash. The decision itself is pure and lives next door, where a test can
   * reach it — see `cueAllowed`.
   */
  const allowed = cueAllowed(name, now, {
    lastSameAt: lastPlayedAt.get(name) ?? null,
    lastAnyAt: lastAnyAt || null,
    ringing: pruneVoices(at),
  })
  if (!allowed) return

  let started = 0
  try {
    started = renderCue(ctx, node, design, at)
  } catch {
    /* A context that has gone away mid-cue is not worth surfacing. */
    return
  }
  if (started === 0) return

  lastPlayedAt.set(name, now)
  lastAnyAt = now

  const endsAt = at + cueLength(name)
  for (let i = 0; i < started; i += 1) voicesEndingAt.push(endsAt)
}

function cueLength(name: Cue): number {
  const design = CUE_DESIGNS[name]
  let longest = 0
  for (const tone of design.tones) {
    longest = Math.max(longest, tone.delay + tone.attack + tone.decay)
  }
  if (design.air) {
    longest = Math.max(longest, design.air.attack + design.air.decay)
  }
  return longest
}

/* ── The one call the app makes ──────────────────────────────── */

/** Answer a press: a sound where they are wanted, a buzz where they are felt. */
export function cue(name: Cue): void {
  play(name)
  haptic(name)
}

/**
 * Open the audio hardware from inside a gesture.
 *
 * Cues are the *first* sound in most sessions — a tap on Start answers before
 * anything it starts does — so the context has to exist by then. Safe and free
 * to call on every press.
 */
export function primeFeedback(): void {
  if (!soundEnabled) return
  bus()
}

export function disposeFeedback(): void {
  try {
    cueBus?.disconnect()
  } catch {
    /* Already gone. */
  }
  cueBus = null
  busContext = null
  voicesEndingAt = []
  lastPlayedAt.clear()
  lastAnyAt = 0
}
