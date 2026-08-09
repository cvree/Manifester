/**
 * The breath's own voice.
 *
 * The point of this module is a single, narrow one: **you should be able to
 * follow the guide with your eyes shut.** A visual orb is useless the moment
 * someone closes their eyes, which is exactly when a breathing exercise starts
 * working — so the sound has to carry the whole shape of the breath on its own.
 *
 * Every voice therefore says three things without a word:
 *
 *   · *breathe in*   — rising: brighter, higher, louder
 *   · *breathe out*  — falling: darker, lower, receding
 *   · *hold*         — still: a level tone, or nothing at all
 *
 * Two families do that in different ways. The **sustained** voices (ocean,
 * breath, drone) are one continuous sound whose brightness and pitch travel
 * with you for the entire phase, so you always know where in the breath you
 * are, not merely that a phase has changed. The **struck** voices (chime,
 * bowl) sound once at each turn and then get out of the way, for people who
 * find a continuous sound intrusive.
 *
 * Everything is synthesised at the moment it plays — there are no audio files
 * in this repository. It runs on its own `AudioContext`, separate from the
 * session bus, so a breath cue can never be caught by a session fade, ducked
 * by the ambience, or suspended along with the music.
 */

import {
  claimMediaChannel,
  claimPlaybackSession,
  keepAwake,
  wake,
} from './audioSession'
import { easeInOut, type BreathPhase } from './breathing'

export type BreathVoiceId = 'chime' | 'bowl' | 'ocean' | 'breath' | 'drone'
export type BreathSound = 'off' | BreathVoiceId

export interface BreathVoiceMeta {
  id: BreathVoiceId
  name: string
  description: string
  /** True when the voice sounds through the whole phase rather than at its turn. */
  sustained: boolean
}

export const BREATH_VOICES: BreathVoiceMeta[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'A wave gathering as you breathe in and drawing back as you let go.',
    sustained: true,
  },
  {
    id: 'breath',
    name: 'Hush',
    description: 'A soft breath alongside yours. The easiest one to follow blind.',
    sustained: true,
  },
  {
    id: 'drone',
    name: 'Drone',
    description: 'A warm tone that climbs on the way in and falls on the way out.',
    sustained: true,
  },
  {
    id: 'chime',
    name: 'Chime',
    description: 'Two clear notes at each turn — up to breathe in, down to let go.',
    sustained: false,
  },
  {
    id: 'bowl',
    name: 'Singing bowl',
    description: 'One struck bowl at each turn, ringing out into the quiet.',
    sustained: false,
  },
]

export function findVoice(id: BreathSound): BreathVoiceMeta | null {
  return BREATH_VOICES.find((voice) => voice.id === id) ?? null
}

/** The slider's top. Breath cues sit under the voice, never over it. */
export const MAX_BREATH_VOLUME = 1
export const DEFAULT_BREATH_VOLUME = 0.6

/**
 * Peak gain per voice at volume 1.
 *
 * Set by ear against a spoken affirmation rather than by level-matching: a
 * struck bell reads as much louder than a bed of noise at the same peak, so
 * the sustained voices sit higher here and still feel quieter.
 */
const VOICE_GAIN: Record<BreathVoiceId, number> = {
  ocean: 0.3,
  breath: 0.34,
  drone: 0.16,
  chime: 0.14,
  bowl: 0.16,
}

/** How many linear segments approximate one eased ramp. */
const CURVE_STEPS = 24
/** Ramp used when a phase is cut short, or the guide stops. */
const RELEASE_SECONDS = 0.5

/* ── Context and noise ──────────────────────────────────────── */

let sharedContext: AudioContext | null = null
let releaseContext: (() => void) | null = null

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null

  // The guide's voice is media too, and on iOS it is muted by the silent
  // switch unless the page says so. See `audioSession.ts`.
  claimPlaybackSession()
  /*
   * The breath has a voice of its own on a context of its own, and someone can
   * be listening to it with no ambience and no rhythm behind it — so it has to
   * ask for the media route itself rather than rely on the session bus having
   * asked first. Idempotent: there is one element for the page.
   */
  claimMediaChannel()

  if (!sharedContext) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    sharedContext = new Ctor()
    releaseContext = keepAwake(sharedContext)
  }

  // Not `state === 'suspended'`: iOS parks an interrupted context in a state
  // of its own, and this loop is exactly the kind of long-running audio that
  // gets interrupted — a call, an alarm, the screen locking.
  wake(sharedContext)
  return sharedContext
}

const noiseCache = new WeakMap<AudioContext, AudioBuffer>()

/**
 * Three seconds of pink-ish noise, looped.
 *
 * White noise is too bright to sound like either water or a person; a one-pole
 * lowpass over it lands close enough to pink for the filters downstream to
 * shape it into both.
 */
function noise(ctx: AudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx)
  if (cached) return cached

  const length = Math.floor(ctx.sampleRate * 3)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  let last = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    last = (last + 0.035 * white) / 1.035
    data[i] = last * 3.2
  }

  // Cross-fade the seam so the loop point is not a click every three seconds.
  const fade = Math.floor(ctx.sampleRate * 0.05)
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade
    data[i] = data[i] * t + data[length - fade + i] * (1 - t)
  }

  noiseCache.set(ctx, buffer)
  return buffer
}

/* ── Param helpers ──────────────────────────────────────────── */

function pin(param: AudioParam, at: number): void {
  param.cancelScheduledValues(at)
  param.setValueAtTime(param.value, at)
}

/**
 * Travel a param from where it is to `to` over `seconds`, along `shape`.
 *
 * Deliberately a chain of short linear ramps rather than
 * `setValueCurveAtTime`: a curve throws if it overlaps another curve, and
 * these are interrupted constantly — every pause, every pattern edit, every
 * phase that ends early. Linear segments can always be cancelled and
 * re-pointed from wherever the value actually reached, which is the property
 * that keeps this click-free.
 */
function glide(
  param: AudioParam,
  to: number,
  seconds: number,
  start: number,
  shape: (t: number) => number = easeInOut,
): void {
  pin(param, start)
  if (seconds <= 0) {
    param.setValueAtTime(to, start)
    return
  }
  const from = param.value
  for (let i = 1; i <= CURVE_STEPS; i += 1) {
    const t = i / CURVE_STEPS
    param.linearRampToValueAtTime(
      from + (to - from) * shape(t),
      start + seconds * t,
    )
  }
}

/**
 * Swell up and back down across one phase, peaking at `peak`.
 *
 * This is what a real breath does — it is loudest in the middle, not at either
 * end — and it is why the hush voice sounds like someone breathing beside you
 * rather than like a fader being pushed.
 */
function swell(
  param: AudioParam,
  peak: number,
  seconds: number,
  start: number,
  floor = 0,
): void {
  pin(param, start)
  if (seconds <= 0) {
    param.setValueAtTime(floor, start)
    return
  }
  const from = param.value
  for (let i = 1; i <= CURVE_STEPS; i += 1) {
    const t = i / CURVE_STEPS
    // A raised sine hump: zero at both ends, one in the middle.
    const bell = Math.sin(Math.PI * t) ** 1.4
    const target = floor + (peak - floor) * bell
    const eased = t < 0.15 ? from + (target - from) * (t / 0.15) : target
    param.linearRampToValueAtTime(eased, start + seconds * t)
  }
}

/* ── The player ─────────────────────────────────────────────── */

interface Sustained {
  /** The voice's own level, ramped per phase. */
  level: GainNode
  /** Brightness for the noise voices, pitch for the drone. */
  colour: AudioParam
  /** Second colour target, where a voice has one. */
  colour2?: AudioParam
  dispose: () => void
}

/**
 * One independent breath voice.
 *
 * Two of these exist at a time — the live guide, and the audition inside the
 * settings sheet — so pressing "hear it" while a session is running never
 * interrupts the breath you are actually following.
 *
 * It deliberately never suspends or resumes the context it is handed. The
 * context belongs to whoever created it — `context()` below wakes the shared
 * one on every access — and a class that reached in to change the transport
 * state of a context it does not own would be fighting its owner for control
 * of the clock.
 */
export class BreathVoicePlayer {
  private ctx: AudioContext
  private out: GainNode
  private voice: BreathSound = 'off'
  private volume = DEFAULT_BREATH_VOLUME
  private sustained: Sustained | null = null
  private running = false

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = this.volume
    this.out.connect(destination)
  }

  setVolume(value: number): void {
    this.volume = Math.min(MAX_BREATH_VOLUME, Math.max(0, value))
    const now = this.ctx.currentTime
    pin(this.out.gain, now)
    this.out.gain.linearRampToValueAtTime(this.volume, now + 0.08)
  }

  /**
   * Choose the voice. Changing it while running rebuilds the graph, so the
   * settings sheet can be flipped through with a session in progress and each
   * choice takes effect on the next phase.
   */
  setVoice(voice: BreathSound): void {
    if (voice === this.voice) return
    this.voice = voice
    if (this.running) {
      this.teardown()
      this.build()
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.build()
  }

  /** Fade out and release everything. Safe to call when already stopped. */
  stop(): void {
    if (!this.running) return
    this.running = false
    this.teardown()
  }

  /**
   * Sound one phase of the breath, scheduled across its whole duration.
   *
   * Called once per phase change rather than per frame: the Web Audio clock is
   * sample-accurate and the animation clock is not, so handing the phase's
   * length to the audio thread keeps the sound exactly in step even while the
   * main thread is busy laying out a settings sheet.
   */
  phase(phase: BreathPhase, seconds: number): void {
    if (!this.running || this.voice === 'off') return

    const now = this.ctx.currentTime
    const length = Math.max(0.15, seconds)

    if (this.sustained) this.sustainedPhase(phase, length, now)
    else this.struckPhase(phase, now)
  }

  dispose(): void {
    this.stop()
    try {
      this.out.disconnect()
    } catch {
      /* Already gone. */
    }
  }

  /* ── Graph construction ── */

  private build(): void {
    const meta = findVoice(this.voice)
    if (!meta?.sustained) return

    const ctx = this.ctx
    const level = ctx.createGain()
    level.gain.value = 0
    level.connect(this.out)

    if (this.voice === 'drone') {
      // Two oscillators a beat apart: the detune is what stops a plain sine
      // from sounding like a test tone.
      const oscA = ctx.createOscillator()
      const oscB = ctx.createOscillator()
      oscA.type = 'sine'
      oscB.type = 'triangle'
      oscA.frequency.value = DRONE_BASE
      oscB.frequency.value = DRONE_BASE
      oscB.detune.value = 7

      const warmth = ctx.createBiquadFilter()
      warmth.type = 'lowpass'
      warmth.frequency.value = 1400

      const blend = ctx.createGain()
      blend.gain.value = 0.55
      oscA.connect(blend)
      oscB.connect(blend)
      blend.connect(warmth).connect(level)

      oscA.start()
      oscB.start()

      this.sustained = {
        level,
        colour: oscA.frequency,
        colour2: oscB.frequency,
        dispose: () => {
          try {
            oscA.stop()
            oscB.stop()
            oscA.disconnect()
            oscB.disconnect()
            blend.disconnect()
            warmth.disconnect()
            level.disconnect()
          } catch {
            /* Already gone. */
          }
        },
      }
      return
    }

    // Ocean and hush are both shaped noise; they differ in the filter.
    const source = ctx.createBufferSource()
    source.buffer = noise(ctx)
    source.loop = true

    const body = ctx.createBiquadFilter()
    const air = ctx.createBiquadFilter()

    if (this.voice === 'ocean') {
      body.type = 'lowpass'
      body.frequency.value = OCEAN_LOW
      body.Q.value = 0.9
      air.type = 'highpass'
      air.frequency.value = 90
    } else {
      // A band around the vocal-tract region, which is what makes noise read
      // as a person breathing rather than as static.
      body.type = 'bandpass'
      body.frequency.value = HUSH_LOW
      body.Q.value = 1.1
      air.type = 'highpass'
      air.frequency.value = 180
    }

    source.connect(air).connect(body).connect(level)
    source.start()

    this.sustained = {
      level,
      colour: body.frequency,
      dispose: () => {
        try {
          source.stop()
          source.disconnect()
          air.disconnect()
          body.disconnect()
          level.disconnect()
        } catch {
          /* Already gone. */
        }
      },
    }
  }

  private teardown(): void {
    const graph = this.sustained
    this.sustained = null
    if (!graph) return

    // Fade before releasing: cutting a running noise bed is a loud click.
    const now = this.ctx.currentTime
    pin(graph.level.gain, now)
    graph.level.gain.linearRampToValueAtTime(0, now + RELEASE_SECONDS)
    if (typeof window !== 'undefined') {
      window.setTimeout(() => graph.dispose(), (RELEASE_SECONDS + 0.1) * 1000)
    } else {
      graph.dispose()
    }
  }

  /* ── Per-phase scheduling ── */

  private sustainedPhase(phase: BreathPhase, seconds: number, now: number): void {
    const graph = this.sustained
    if (!graph) return

    const peak = VOICE_GAIN[this.voice as BreathVoiceId] ?? 0.2
    const { level, colour, colour2 } = graph

    if (this.voice === 'drone') {
      // Pitch alone carries the phase: up a fifth on the way in, back down on
      // the way out, held still through a hold.
      const target =
        phase === 'inhale' || phase === 'holdIn' ? DRONE_BASE * 1.5 : DRONE_BASE
      const travel = phase === 'inhale' || phase === 'exhale' ? seconds : 0.25
      glide(colour, target, travel, now)
      if (colour2) glide(colour2, target, travel, now)

      const loud =
        phase === 'inhale' || phase === 'holdIn' ? peak : peak * 0.72
      glide(level.gain, phase === 'holdOut' ? peak * 0.4 : loud, Math.min(seconds, 1.2), now)
      return
    }

    if (this.voice === 'ocean') {
      switch (phase) {
        case 'inhale':
          // The wave gathers: louder and brighter the further in you get.
          glide(level.gain, peak, seconds, now)
          glide(colour, OCEAN_HIGH, seconds, now)
          break
        case 'holdIn':
          glide(level.gain, peak * 0.8, Math.min(seconds, 1), now)
          glide(colour, OCEAN_HIGH * 0.85, Math.min(seconds, 1), now)
          break
        case 'exhale':
          glide(level.gain, peak * 0.12, seconds, now)
          glide(colour, OCEAN_LOW, seconds, now)
          break
        case 'holdOut':
          glide(level.gain, 0, Math.min(seconds, 0.8), now)
          glide(colour, OCEAN_LOW, Math.min(seconds, 0.8), now)
          break
      }
      return
    }

    // Hush: loudest in the middle of each breath, silent through the holds,
    // with the band rising on the way in and falling on the way out.
    switch (phase) {
      case 'inhale':
        swell(level.gain, peak, seconds, now)
        glide(colour, HUSH_HIGH, seconds, now)
        break
      case 'exhale':
        swell(level.gain, peak * 0.92, seconds, now)
        glide(colour, HUSH_LOW, seconds, now)
        break
      default:
        glide(level.gain, 0, Math.min(seconds, 0.45), now)
        break
    }
  }

  private struckPhase(phase: BreathPhase, now: number): void {
    const shape = (this.voice === 'bowl' ? BOWL : CHIME)[phase]
    if (!shape) return

    const gain = (VOICE_GAIN[this.voice as BreathVoiceId] ?? 0.14) * shape.gain
    shape.notes.forEach((frequency, index) => {
      this.strike(frequency, now + index * shape.spacing, shape.decay, gain)
    })
  }

  /**
   * One struck partial: an instant attack and a long exponential tail, with
   * the two inharmonic overtones that make a bell a bell rather than a beep.
   */
  private strike(
    frequency: number,
    at: number,
    decay: number,
    gain: number,
  ): void {
    const ctx = this.ctx
    const partials = this.voice === 'bowl' ? BOWL_PARTIALS : CHIME_PARTIALS

    partials.forEach(([ratio, weight]) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequency * ratio

      const envelope = ctx.createGain()
      const peak = Math.max(0.0002, gain * weight)
      const tail = decay * (1 / (1 + (ratio - 1) * 0.6))

      envelope.gain.setValueAtTime(0, at)
      envelope.gain.linearRampToValueAtTime(peak, at + 0.012)
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + tail)

      osc.connect(envelope).connect(this.out)
      osc.start(at)
      osc.stop(at + tail + 0.08)
      osc.onended = () => {
        try {
          osc.disconnect()
          envelope.disconnect()
        } catch {
          /* Already gone. */
        }
      }
    })
  }
}

/* ── Voice tables ───────────────────────────────────────────── */

const DRONE_BASE = 174
const OCEAN_LOW = 260
const OCEAN_HIGH = 1500
const HUSH_LOW = 420
const HUSH_HIGH = 1050

/** Bell: near-harmonic, so it rings sweetly. */
const CHIME_PARTIALS: Array<[number, number]> = [
  [1, 1],
  [2, 0.3],
  [3, 0.12],
]

/** Bowl: inharmonic, which is what gives it the shimmer and the long beat. */
const BOWL_PARTIALS: Array<[number, number]> = [
  [1, 1],
  [2.76, 0.34],
  [5.4, 0.14],
  [8.9, 0.05],
]

interface StruckShape {
  notes: number[]
  /** Seconds between notes in the figure. */
  spacing: number
  decay: number
  gain: number
}

/** Rising to breathe in, falling to let go — legible without looking. */
const CHIME: Partial<Record<BreathPhase, StruckShape>> = {
  inhale: { notes: [523.25, 783.99], spacing: 0.22, decay: 1.6, gain: 1 },
  holdIn: { notes: [1046.5], spacing: 0, decay: 0.7, gain: 0.4 },
  exhale: { notes: [523.25, 349.23], spacing: 0.26, decay: 2.2, gain: 0.9 },
  holdOut: { notes: [261.63], spacing: 0, decay: 0.9, gain: 0.35 },
}

const BOWL: Partial<Record<BreathPhase, StruckShape>> = {
  inhale: { notes: [432], spacing: 0, decay: 3.4, gain: 1 },
  holdIn: { notes: [648], spacing: 0, decay: 1.6, gain: 0.35 },
  exhale: { notes: [288], spacing: 0, decay: 4.2, gain: 0.95 },
  holdOut: { notes: [216], spacing: 0, decay: 1.8, gain: 0.3 },
}

/* ── Module-level players ───────────────────────────────────── */

let live: BreathVoicePlayer | null = null
let audition: BreathVoicePlayer | null = null
let auditionTimers: number[] = []

function player(which: 'live' | 'audition'): BreathVoicePlayer | null {
  const ctx = context()
  if (!ctx) return null
  if (which === 'live') {
    if (!live) live = new BreathVoicePlayer(ctx, ctx.destination)
    return live
  }
  if (!audition) audition = new BreathVoicePlayer(ctx, ctx.destination)
  return audition
}

/** The guide's own voice — driven by `useBreathing`. */
export function liveBreathVoice(): BreathVoicePlayer | null {
  return player('live')
}

/**
 * Play one breath in the chosen voice, for the settings sheet.
 *
 * Runs on its own player so auditioning a voice mid-session leaves the breath
 * you are actually following completely untouched.
 */
export function auditionBreathVoice(
  voice: BreathSound,
  volume: number,
  inhaleSeconds = 3,
  exhaleSeconds = 4,
): void {
  stopAudition()
  if (voice === 'off') return

  const target = player('audition')
  if (!target) return

  target.setVoice(voice)
  target.setVolume(volume)
  target.start()
  target.phase('inhale', inhaleSeconds)

  auditionTimers = [
    window.setTimeout(
      () => target.phase('exhale', exhaleSeconds),
      inhaleSeconds * 1000,
    ),
    window.setTimeout(
      () => target.stop(),
      (inhaleSeconds + exhaleSeconds) * 1000,
    ),
  ]
}

export function stopAudition(): void {
  auditionTimers.forEach((id) => window.clearTimeout(id))
  auditionTimers = []
  audition?.stop()
}

/**
 * Open the audio context from a user gesture. iOS refuses to start audio
 * otherwise, and the first breath of a session would be silently swallowed.
 */
export function primeBreathAudio(): void {
  context()
}

export function disposeBreathAudio(): void {
  stopAudition()
  live?.dispose()
  audition?.dispose()
  live = null
  audition = null
  if (sharedContext) {
    releaseContext?.()
    releaseContext = null
    void sharedContext.close().catch(() => undefined)
    sharedContext = null
  }
}
