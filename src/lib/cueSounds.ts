/**
 * The interface's own voice.
 *
 * Manifester is a nighttime product, and the first version of this file was a
 * family of synthetic confirmation beeps that were more noticeable than useful.
 * They were removed rather than fixed, which left every control in the app
 * answering silently. This is the fix: not generic UI beeps, but a small set of
 * cues designed for *this* app, against the same brief as the breath voices and
 * the ambiences — you should be able to use the app with your eyes shut, and
 * nothing should ever startle you.
 *
 * Three rules shape every design below.
 *
 *  1. **Nothing above the ambience, ever.** A cue is a texture under the words,
 *     not an announcement over them. `CUE_PEAK_CEILING` is a hard bound on what
 *     any cue can produce, and it sits an order of magnitude below a spoken
 *     line. `cueSounds.test.ts` renders every one of them and asserts it.
 *  2. **Low and round, never bright and sharp.** Every cue is sine partials
 *     through a lowpass, with a measurable attack. A step edge is a click, a
 *     click is the sharpest noise a phone can make, and the sharp
 *     high-frequency ping is the exact sound this app must never make.
 *  3. **The hierarchy is the message.** A tap is almost nothing; a save is a
 *     warm chord; completing a loop is the one moment the app is allowed to
 *     bloom. The cost of the loudest cue being genuinely rewarding is that
 *     everything below it stays out of the way.
 *
 * The notes are a major pentatonic on F, which is why any two cues heard
 * together — and they will be, on a fast double tap — are consonant rather than
 * merely quiet.
 */

/* ── The vocabulary ──────────────────────────────────────────── */

export type Cue =
  | 'tap'
  | 'select'
  | 'start'
  | 'stop'
  | 'save'
  | 'inhale'
  | 'exhale'
  | 'hold'
  | 'complete'
  | 'error'

/**
 * The hard ceiling on the peak sample any single cue may produce.
 *
 * Chosen against the two things a cue plays underneath. A spoken affirmation
 * leaves the voice path at up to 1.0, and the loudest ambience peaks around
 * 0.33 before the master trim — so 0.075 is roughly 13 dB below the quietest
 * thing it ever has to sit beneath. It is a bound, not a target: most cues land
 * well below it, and the test suite renders each design to check.
 */
export const CUE_PEAK_CEILING = 0.075

/** One sine voice inside a cue. */
export interface CueTone {
  /** Hz. Nothing here goes above 700: brightness is what makes a cue a ping. */
  frequency: number
  /** Seconds after the cue begins. Stagger is what makes a chord bloom. */
  delay: number
  /** Peak gain of this voice alone. */
  peak: number
  /** Seconds. Never zero — a zero attack is a click. */
  attack: number
  /** Seconds to the tail's end. */
  decay: number
  /**
   * Weight of the octave above, relative to the fundamental.
   *
   * A bare sine reads as a test tone; a touch of the octave reads as something
   * struck. Kept small, and it inherits the same lowpass, so it can add body
   * without adding edge.
   */
  shimmer?: number
}

/** A breath of filtered noise under the tones — air, not hiss. */
export interface CueAir {
  peak: number
  attack: number
  decay: number
  cutoffHz: number
}

export interface CueDesign {
  /** Empty means this cue is deliberately silent and haptic-only. */
  tones: CueTone[]
  /** The lowpass every voice in the cue passes through. */
  cutoffHz: number
  air?: CueAir
  /**
   * The shortest gap between two of *this* cue before the second is dropped.
   *
   * Not a stylistic nicety — it is the whole of the anti-spam design. Somebody
   * dragging a slider or flicking down a list of voices generates cues far
   * faster than anybody wants to hear them, and a cue you notice is a cue that
   * has failed. Short for taps, long for the ones that mean something.
   */
  minGapMs: number
}

/* ── The designs ─────────────────────────────────────────────── */

/** F major pentatonic. Any two of these sound well together. */
const F4 = 349.23
const G4 = 392.0
const A4 = 440.0
const C5 = 523.25
const D5 = 587.33
const F5 = 698.46
const F3 = 174.61
const A3 = 220.0

export const CUE_DESIGNS: Record<Cue, CueDesign> = {
  /*
   * Barely a sound at all — a fingertip on soft wood. It exists to make a
   * control feel answered, and it is over before you could describe it.
   */
  tap: {
    tones: [{ frequency: F4, delay: 0, peak: 0.026, attack: 0.005, decay: 0.075 }],
    cutoffHz: 1150,
    minGapMs: 45,
  },

  /*
   * A hair brighter and a hair longer than a tap, because choosing is a
   * slightly larger act than touching. Still under a tenth of a second.
   */
  select: {
    tones: [
      { frequency: C5, delay: 0, peak: 0.03, attack: 0.005, decay: 0.11, shimmer: 0.1 },
    ],
    cutoffHz: 1600,
    minGapMs: 55,
  },

  /*
   * Two notes rising a fourth: the shape of something opening. Warm rather
   * than triumphant — this plays every time somebody presses play, so it has
   * to be a sound you can hear a hundred times.
   */
  start: {
    tones: [
      { frequency: G4, delay: 0, peak: 0.032, attack: 0.008, decay: 0.34 },
      { frequency: C5, delay: 0.075, peak: 0.028, attack: 0.008, decay: 0.5, shimmer: 0.12 },
    ],
    cutoffHz: 1800,
    air: { peak: 0.008, attack: 0.04, decay: 0.42, cutoffHz: 900 },
    minGapMs: 200,
  },

  /* The same figure inverted, and softer: something closing rather than shutting. */
  stop: {
    tones: [
      { frequency: C5, delay: 0, peak: 0.026, attack: 0.01, decay: 0.3 },
      { frequency: G4, delay: 0.08, peak: 0.03, attack: 0.012, decay: 0.62 },
    ],
    cutoffHz: 1300,
    minGapMs: 200,
  },

  /*
   * A chord rather than a sequence, with a low root underneath it. Saving is
   * one act, so it gets one sound, and the fifth is what makes it read as
   * settled rather than as another step in something.
   */
  save: {
    tones: [
      { frequency: F3, delay: 0, peak: 0.02, attack: 0.014, decay: 0.8 },
      { frequency: F4, delay: 0.01, peak: 0.026, attack: 0.01, decay: 0.62 },
      { frequency: C5, delay: 0.045, peak: 0.022, attack: 0.01, decay: 0.78, shimmer: 0.1 },
    ],
    cutoffHz: 1600,
    air: { peak: 0.007, attack: 0.06, decay: 0.6, cutoffHz: 800 },
    minGapMs: 260,
  },

  /*
   * The one cue allowed to be an event.
   *
   * Four notes of the pentatonic arriving a breath apart, each with a tail
   * measured in seconds, over a slow swell of air — a bloom that opens and then
   * takes its time leaving. It plays once, at the end of a ritual somebody has
   * just spent ten minutes inside, and it is the only place in the app where
   * the right answer is *more* sound rather than less.
   *
   * The staggering is what keeps it inside the ceiling: no two peaks land
   * together, so the loudest instant is one note, not four.
   */
  complete: {
    tones: [
      { frequency: F4, delay: 0, peak: 0.026, attack: 0.012, decay: 2.4, shimmer: 0.14 },
      { frequency: A4, delay: 0.1, peak: 0.022, attack: 0.012, decay: 2.8, shimmer: 0.12 },
      { frequency: C5, delay: 0.22, peak: 0.02, attack: 0.014, decay: 3.2, shimmer: 0.1 },
      { frequency: F5, delay: 0.37, peak: 0.014, attack: 0.016, decay: 3.6, shimmer: 0.08 },
      { frequency: D5, delay: 0.62, peak: 0.011, attack: 0.02, decay: 3.4 },
    ],
    cutoffHz: 2100,
    air: { peak: 0.009, attack: 0.55, decay: 2.9, cutoffHz: 780 },
    minGapMs: 700,
  },

  /*
   * Calm, and deliberately not a buzzer.
   *
   * Two low notes falling a fourth, with a slow attack and a lowpass down at
   * 560 Hz — the sound of something settling rather than something wrong. An
   * error in this app is nearly always "the voice could not be reached", which
   * is a piece of news, not an alarm, and being told it harshly at eleven at
   * night is worse than not being told at all.
   */
  error: {
    tones: [
      { frequency: A3, delay: 0, peak: 0.028, attack: 0.03, decay: 0.55 },
      { frequency: F3, delay: 0.13, peak: 0.026, attack: 0.035, decay: 0.85 },
    ],
    cutoffHz: 560,
    minGapMs: 450,
  },

  /*
   * The breath already has a voice of its own — five of them, designed to be
   * followed with your eyes shut. See `breathAudio`. A second sound on the same
   * turn would be two guides disagreeing, so these stay haptic-only.
   */
  inhale: { tones: [], cutoffHz: 1000, minGapMs: 400 },
  exhale: { tones: [], cutoffHz: 1000, minGapMs: 400 },
  hold: { tones: [], cutoffHz: 1000, minGapMs: 400 },
}

/**
 * The shortest gap between any two cues, of any kind.
 *
 * Separate from the per-cue gaps because it answers a different question: those
 * stop one control from rattling, this stops two different controls answering
 * in the same instant — a tap and a select from one press on a list row, say —
 * which is heard as a single thicker click rather than as two cues.
 */
export const GLOBAL_MIN_GAP_MS = 28

export interface CueThrottleState {
  /** When this same cue last sounded, in milliseconds, or `null`. */
  lastSameAt: number | null
  /** When any cue last sounded. */
  lastAnyAt: number | null
  /** How many cue voices are still ringing. */
  ringing: number
}

/**
 * The most cue voices allowed to be ringing at once.
 *
 * `complete` alone is nine, and it is the only cue with a tail long enough to
 * still be sounding when the next one arrives. The cap is what stops a fast
 * hand on a list of voices from stacking a dozen overlapping tails into a
 * smear — past it, the newest cue is simply dropped, which is inaudible in a
 * way that the smear is not.
 */
export const MAX_CONCURRENT_VOICES = 14

/**
 * Whether a cue may sound right now.
 *
 * Pure, and separated from the audio for exactly one reason: this is the part
 * that decides whether somebody dragging a slider hears a texture or a rattle,
 * and that decision is worth pinning in a test rather than discovering on a
 * phone. `feedback.ts` supplies the state; this decides.
 */
export function cueAllowed(
  name: Cue,
  at: number,
  state: CueThrottleState,
): boolean {
  if (!cueIsAudible(name)) return false
  if (state.ringing >= MAX_CONCURRENT_VOICES) return false
  if (state.lastAnyAt != null && at - state.lastAnyAt < GLOBAL_MIN_GAP_MS) return false
  if (state.lastSameAt != null && at - state.lastSameAt < CUE_DESIGNS[name].minGapMs) {
    return false
  }
  return true
}

/** True when a cue has a sound at all, as opposed to only a haptic. */
export function cueIsAudible(name: Cue): boolean {
  return CUE_DESIGNS[name].tones.length > 0
}

/** How long a cue rings for, from its start to the end of its longest tail. */
export function cueDurationSeconds(design: CueDesign): number {
  const tones = design.tones.reduce(
    (longest, tone) => Math.max(longest, tone.delay + tone.attack + tone.decay),
    0,
  )
  const air = design.air ? design.air.attack + design.air.decay : 0
  return Math.max(tones, air)
}

/* ── Rendering ───────────────────────────────────────────────── */

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

/**
 * A second of soft noise, shared per context.
 *
 * One-pole filtered so it is closer to pink than white before the cue's own
 * lowpass touches it: white noise under a chime reads as static, and the point
 * of the air layer is that you cannot hear it as a layer at all.
 */
function airBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx)
  if (cached) return cached

  const length = Math.max(1, Math.floor(ctx.sampleRate))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    last = (last + 0.04 * white) / 1.04
    data[i] = last * 3
  }

  noiseCache.set(ctx, buffer)
  return buffer
}

/**
 * Lay one cue onto the audio thread, in full, at `when`.
 *
 * Everything is scheduled up front on `AudioParam`s rather than driven by a
 * timer, for the same reason the breath is: the audio clock is sample-accurate
 * and immune to a busy main thread, so a cue fired while React is rendering a
 * sheet still arrives clean. It returns the number of source nodes it started,
 * which is what the concurrency guard in `feedback.ts` counts.
 *
 * Deliberately free of module state, so a test can render it into an
 * `OfflineAudioContext` and measure what a real device would actually hear.
 */
export function renderCue(
  ctx: BaseAudioContext,
  destination: AudioNode,
  design: CueDesign,
  when: number = ctx.currentTime,
): number {
  if (design.tones.length === 0) return 0

  const colour = ctx.createBiquadFilter()
  colour.type = 'lowpass'
  colour.frequency.value = design.cutoffHz
  colour.Q.value = 0.55
  colour.connect(destination)

  let started = 0
  const release: AudioNode[] = [colour]

  for (const tone of design.tones) {
    const at = when + tone.delay
    const end = at + tone.attack + tone.decay

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(tone.peak, at + tone.attack)
    // Exponential, because that is how anything struck actually dies away —
    // and it never reaches zero, so it is pinned to silence at the end.
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.00005, tone.peak * 0.0008),
      end,
    )
    envelope.gain.setValueAtTime(0, end)
    envelope.connect(colour)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = tone.frequency
    osc.connect(envelope)
    osc.start(at)
    osc.stop(end + 0.02)
    started += 1

    if (tone.shimmer) {
      const upper = ctx.createGain()
      upper.gain.value = tone.shimmer
      upper.connect(envelope)
      const octave = ctx.createOscillator()
      octave.type = 'sine'
      octave.frequency.value = tone.frequency * 2
      octave.connect(upper)
      octave.start(at)
      octave.stop(end + 0.02)
      started += 1
      release.push(upper)
      octave.onended = () => disconnect([octave, upper])
    }

    release.push(envelope)
    osc.onended = () => disconnect([osc, envelope])
  }

  if (design.air) {
    const { peak, attack, decay, cutoffHz } = design.air
    const end = when + attack + decay

    const band = ctx.createBiquadFilter()
    band.type = 'lowpass'
    band.frequency.value = cutoffHz
    band.Q.value = 0.5
    band.connect(destination)

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime(peak, when + attack)
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.00005, peak * 0.001), end)
    envelope.gain.setValueAtTime(0, end)
    envelope.connect(band)

    const source = ctx.createBufferSource()
    source.buffer = airBuffer(ctx)
    source.loop = true
    source.connect(envelope)
    source.start(when)
    source.stop(end + 0.02)
    started += 1
    source.onended = () => disconnect([source, envelope, band])
  }

  return started
}

function disconnect(nodes: AudioNode[]): void {
  for (const node of nodes) {
    try {
      node.disconnect()
    } catch {
      /* Already released. */
    }
  }
}
