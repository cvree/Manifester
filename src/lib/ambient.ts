/**
 * The built-in ambiences.
 *
 * These are *generated*, not sampled — oscillators, filters and shaped noise
 * built live in the Web Audio graph. That keeps the download tiny, makes them
 * work offline forever, and means there is no third-party audio in this
 * repository at all.
 *
 * A few conventions hold across all five:
 *
 *  - **One noise buffer per shape, per context.** A soundscape may read the
 *    same few seconds of pink or brown noise from a dozen places; generating
 *    it once and re-reading it at different offsets and rates costs nothing.
 *  - **Transients are scheduled in a rolling window.** Rain droplets, fire
 *    crackles and ocean waves are laid onto the audio thread a couple of
 *    seconds ahead, so their timing survives a throttled tab, and a stop
 *    cancels everything still in flight.
 *  - **Every soundscape owns one master gain.** It fades in on arrival and out
 *    on departure, which is what makes switching between two of them a
 *    crossfade rather than a cut.
 *  - **Randomness is bounded and, when asked, seeded.** Every random parameter
 *    is drawn from a curated range with a hard ceiling on gain, so nothing can
 *    ever arrive louder than intended.
 */

import { createSoftCeiling, rampParam } from './audioParams'
import { onHeartbeat } from './heartbeat'

/* ── Public shape ────────────────────────────────────────────── */

/** Stable ids. Renaming one would orphan every saved ritual using it. */
export type BuiltInAmbientId =
  | 'moon-garden'
  | 'soft-horizon'
  | 'rain-window'
  | 'ocean-tide'
  | 'fireplace-glow'

/** How dense and bright Rain on Window is. */
export type RainCharacter = 'soft' | 'steady' | 'full'

export const RAIN_CHARACTERS: RainCharacter[] = ['soft', 'steady', 'full']

export function isRainCharacter(value: unknown): value is RainCharacter {
  return value === 'soft' || value === 'steady' || value === 'full'
}

/**
 * Long enough that an ambience never announces its arrival or departure, and
 * long enough that two of them overlapping reads as one sound becoming another.
 */
export const AMBIENCE_FADE_SECONDS = 1.5

/**
 * Output trim per soundscape, so all five land at a comparable loudness.
 *
 * Moon Garden and Soft Horizon stay at 1 — they set the house level long before
 * the other three existed, and moving them would change every saved ritual that
 * uses them. The new three are built from quiet noise layers and need lifting to
 * match, which is done once at their output rather than by inflating each layer.
 */
const LEVELS: Record<BuiltInAmbientId, number> = {
  'moon-garden': 1,
  'soft-horizon': 1,
  'rain-window': 2.9,
  'ocean-tide': 2.1,
  'fireplace-glow': 1.95,
}

export interface AmbientHandle {
  /** Fade out, then stop and disconnect everything. */
  stop: (fadeSeconds?: number) => void
  /**
   * What this soundscape is still holding open. Exposed so the lifecycle tests
   * can assert that stopping really does release every node and cancel every
   * scheduled transient, rather than just sounding as though it did.
   */
  inspect: () => { sources: number; scheduling: boolean; stopped: boolean }
}

export interface AmbientBuildOptions {
  /**
   * Set when rendering into an `OfflineAudioContext` for export. Anything that
   * would normally be driven by a timer is instead scheduled up front across
   * this many seconds, because offline rendering finishes long before any
   * `setTimeout` would fire.
   */
  offlineSeconds?: number
  /** Fixes every random choice, so a test can assert on the exact result. */
  seed?: number
  /** Rain on Window's density and brightness. */
  rainCharacter?: RainCharacter
  /** Drops the optional layers on modest hardware. */
  lowPower?: boolean
}

export interface AmbientPreset {
  id: BuiltInAmbientId
  name: string
  /** One sentence, shown under the name wherever the sound is listed. */
  description: string
  /** Wire the preset into `destination` and return a stop handle. */
  build: (
    ctx: BaseAudioContext,
    destination: AudioNode,
    options?: AmbientBuildOptions,
  ) => AmbientHandle
}

/* ── Random parameter bounds ─────────────────────────────────── */

/**
 * Hard ceilings on every generated transient.
 *
 * These are the numbers that guarantee nothing startles anyone: no random draw
 * can produce a droplet, crackle, pop or burst of spray louder than its ceiling,
 * whatever the seed.
 */
export const TRANSIENT_CEILINGS = {
  droplet: 0.055,
  crackle: 0.05,
  pop: 0.09,
} as const

export interface GrainParams {
  frequency: number
  Q: number
  attack: number
  decay: number
  peak: number
  pan: number
  rate: number
}

/**
 * One rain droplet against the glass.
 *
 * `intensity` (0 – 1) comes from the character setting and only ever scales the
 * peak *down*, so `TRANSIENT_CEILINGS.droplet` is a true ceiling.
 */
export function randomDroplet(rng: () => number, intensity = 1): GrainParams {
  const scale = clamp(intensity, 0, 1)
  return {
    // Weighted low so most droplets are soft taps and only a few are bright.
    frequency: 1200 + Math.pow(rng(), 1.7) * 3300,
    Q: 2.5 + rng() * 4.5,
    attack: 0.001 + rng() * 0.004,
    decay: 0.03 + rng() * 0.13,
    peak: TRANSIENT_CEILINGS.droplet * (0.35 + rng() * 0.65) * scale,
    pan: (rng() * 2 - 1) * 0.72,
    rate: 0.8 + rng() * 1.6,
  }
}

/** One small crackle in the fire. */
export function randomCrackle(rng: () => number): GrainParams {
  return {
    frequency: 700 + Math.pow(rng(), 1.6) * 4300,
    Q: 2 + rng() * 6,
    // Never a true zero attack: a couple of milliseconds is what stops a burst
    // of noise from arriving as a click.
    attack: 0.0015 + rng() * 0.0025,
    decay: 0.015 + rng() * 0.085,
    peak: TRANSIENT_CEILINGS.crackle * (0.22 + rng() * 0.78),
    pan: (rng() * 2 - 1) * 0.8,
    rate: 0.7 + rng() * 1.5,
  }
}

export interface PopParams {
  thumpHz: number
  thumpDecay: number
  noiseDecay: number
  peak: number
  pan: number
  /** Seconds until the next pop. Never a repeating interval. */
  gap: number
}

/** A rare, rounded wood pop. */
export function randomPop(rng: () => number): PopParams {
  return {
    thumpHz: 90 + rng() * 100,
    thumpDecay: 0.06 + rng() * 0.08,
    noiseDecay: 0.02 + rng() * 0.05,
    peak: TRANSIENT_CEILINGS.pop * (0.4 + rng() * 0.6),
    pan: (rng() * 2 - 1) * 0.55,
    gap: 4 + rng() * 11,
  }
}

/* ── Shared helpers ──────────────────────────────────────────── */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * A small deterministic generator, so a test can pin every random choice.
 * Falls back to `Math.random` when no seed is given, because a listener should
 * never hear the same evening twice.
 */
export function makeRng(seed?: number): () => number {
  if (seed === undefined) return Math.random
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type NoiseKind = 'white' | 'pink' | 'brown'

const noiseCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>()

/**
 * Shared, looping noise. Cached per context and per shape: five soundscapes
 * previewed in a row reuse the same handful of buffers rather than filling
 * memory with near-identical noise.
 */
function noiseBuffer(
  ctx: BaseAudioContext,
  kind: NoiseKind,
  seconds: number,
  seed?: number,
): AudioBuffer {
  let cache = noiseCache.get(ctx)
  if (!cache) {
    cache = new Map()
    noiseCache.set(ctx, cache)
  }
  const key = `${kind}:${seconds}:${seed ?? 'random'}`
  const cached = cache.get(key)
  if (cached) return cached

  const rng = makeRng(seed)
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  if (kind === 'brown') {
    let last = 0
    for (let i = 0; i < length; i += 1) {
      const white = rng() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
  } else if (kind === 'pink') {
    // Paul Kellet's economical pink filter: -3 dB/octave, six one-pole stages.
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    let b4 = 0
    let b5 = 0
    let b6 = 0
    for (let i = 0; i < length; i += 1) {
      const white = rng() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }
  } else {
    for (let i = 0; i < length; i += 1) data[i] = rng() * 2 - 1
  }

  // Cross-fade the seam so the loop point is inaudible.
  const fade = Math.min(Math.floor(ctx.sampleRate * 0.25), Math.floor(length / 3))
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade
    data[i] = data[i] * t + data[length - fade + i] * (1 - t)
  }

  cache.set(key, buffer)
  return buffer
}

function later(callback: () => void, ms: number): number {
  const host = typeof window === 'undefined' ? globalThis : window
  return host.setTimeout(callback, ms) as unknown as number
}

function cancelLater(id: number): void {
  const host = typeof window === 'undefined' ? globalThis : window
  host.clearTimeout(id)
}

/** Older Safari has no `StereoPannerNode`; centre the sound rather than fail. */
function createPan(ctx: BaseAudioContext, pan: number): AudioNode {
  if (typeof ctx.createStereoPanner === 'function') {
    const node = ctx.createStereoPanner()
    node.pan.value = clamp(pan, -1, 1)
    return node
  }
  return ctx.createGain()
}

function panParam(node: AudioNode): AudioParam | null {
  return (node as Partial<StereoPannerNode>).pan ?? null
}

/**
 * The scaffolding every soundscape is built on: a master gain that fades, a
 * register of everything that has to be released, and a rolling scheduler for
 * transients.
 */
class Rig {
  readonly ctx: BaseAudioContext
  readonly out: GainNode
  readonly rng: () => number
  readonly offlineSeconds: number | undefined
  readonly lowPower: boolean

  /** Sources that run for the life of the soundscape. */
  private readonly sustained: AudioScheduledSourceNode[] = []
  /** Short-lived transients still in flight. Pruned as they end. */
  private readonly transients = new Set<AudioScheduledSourceNode>()
  private readonly nodes: AudioNode[] = []
  /** Cancels every rolling scheduler this soundscape started. */
  private readonly cancels: Array<() => void> = []
  private scheduling = false
  private stopped = false

  constructor(
    ctx: BaseAudioContext,
    destination: AudioNode,
    options: AmbientBuildOptions | undefined,
    /**
     * Per-soundscape output trim, so all five arrive at a comparable loudness
     * and switching between them is not also a change of volume. Applied at the
     * very end, which keeps each soundscape's internal balance exactly as it
     * was designed.
     */
    level = 1,
  ) {
    this.ctx = ctx
    this.rng = makeRng(options?.seed)
    this.offlineSeconds = options?.offlineSeconds
    this.lowPower = options?.lowPower === true

    this.out = ctx.createGain()
    this.out.connect(destination)

    // An offline render is looped and crossfaded by the exporter, so a fade-in
    // here would only put a dip at every wrap point.
    const fade = this.offlineSeconds ? 0 : AMBIENCE_FADE_SECONDS
    if (fade > 0) {
      this.out.gain.value = 0
      this.out.gain.setValueAtTime(0, ctx.currentTime)
      this.out.gain.linearRampToValueAtTime(level, ctx.currentTime + fade)
    } else {
      this.out.gain.value = level
    }
  }

  /** Register a node so it is disconnected when the soundscape stops. */
  node<T extends AudioNode>(node: T): T {
    this.nodes.push(node)
    return node
  }

  /** Start and register a source that runs until the soundscape stops. */
  sustain<T extends AudioScheduledSourceNode>(source: T): T {
    source.start()
    this.sustained.push(source)
    this.nodes.push(source)
    return source
  }

  /** A looping read of one of the shared noise buffers. */
  noise(kind: NoiseKind, seconds: number, seed?: number): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource()
    source.buffer = noiseBuffer(this.ctx, kind, seconds, seed)
    source.loop = true
    return this.sustain(source)
  }

  /** A sine modulator added on top of a param's own value. */
  lfo(frequency: number, depth: number, target: AudioParam): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = frequency
    const gain = this.node(this.ctx.createGain())
    gain.gain.value = depth
    osc.connect(gain)
    gain.connect(target)
    this.sustain(osc)
  }

  /**
   * Track a transient so a stop can cancel it mid-flight, and unwire its whole
   * chain the moment it finishes.
   *
   * A half-hour session schedules tens of thousands of these, so nothing may be
   * left connected behind them.
   */
  transient<T extends AudioScheduledSourceNode>(source: T, chain: AudioNode[] = []): T {
    if (this.stopped) return source
    this.transients.add(source)
    source.onended = () => {
      this.transients.delete(source)
      for (const node of [source, ...chain]) {
        try {
          node.disconnect()
        } catch {
          /* already disconnected */
        }
      }
    }
    return source
  }

  /**
   * Lay transients onto the audio thread a window at a time.
   *
   * `fill(from, to)` is handed absolute context times and schedules whatever
   * belongs in that span. Offline, the whole render is filled in one call,
   * because no timer would ever fire.
   *
   * ── Why the window is this wide ──
   *
   * Rain used to thin out when you looked away. The horizon was two seconds and
   * it was refilled every 1.2, which is comfortable while a page is visible and
   * has no margin at all once it is not: a hidden tab clamps timers to one
   * second and is entitled to push them a great deal further. Miss one refill
   * and the audio thread runs out of droplets to play, so the rain quietly
   * becomes a drizzle — and then a downpour again when you came back and the
   * missed windows were filled at once.
   *
   * Six seconds of horizon, topped up twice a second by the heartbeat, is the
   * fix. The heartbeat is not a timer alone (see `heartbeat.ts`), and even if it
   * were reduced to one beat a second the horizon would still be five seconds
   * clear. The cost is a slightly longer list of scheduled transients on the
   * audio thread, which is a thing audio threads are extremely good at.
   */
  schedule(fill: (from: number, to: number) => void, windowSeconds = 6): void {
    const start = this.ctx.currentTime + 0.05

    if (this.offlineSeconds) {
      fill(start, this.ctx.currentTime + this.offlineSeconds)
      return
    }

    this.scheduling = true
    let horizon = start

    const tick = () => {
      if (this.stopped) return
      const to = this.ctx.currentTime + windowSeconds
      if (to > horizon) {
        fill(horizon, to)
        horizon = to
      }
    }

    /*
     * Both, deliberately. The heartbeat holds the cadence when the page is
     * hidden; its own timer covers the case where nothing has yet offered the
     * heartbeat an audio clock and the tab is throttled anyway. Refilling twice
     * when once would do is free — `tick` only ever fills the part of the
     * window that is not already filled.
     */
    const release = onHeartbeat(tick)
    let timer: number | null = null
    const own = () => {
      tick()
      timer = later(own, windowSeconds * 250)
    }

    this.cancels.push(() => {
      release()
      if (timer != null) cancelLater(timer)
      timer = null
    })

    own()
  }

  handle(): AmbientHandle {
    return {
      stop: (fadeSeconds = AMBIENCE_FADE_SECONDS) => this.stop(fadeSeconds),
      inspect: () => ({
        sources: this.sustained.length + this.transients.size,
        scheduling: this.scheduling,
        stopped: this.stopped,
      }),
    }
  }

  private stop(fadeSeconds: number): void {
    if (this.stopped) return
    this.stopped = true
    this.scheduling = false
    this.cancels.forEach((cancel) => cancel())
    this.cancels.length = 0

    // Leave from wherever the fade-in had reached, which may be part-way up.
    const fade = Math.max(0, fadeSeconds)
    rampParam(this.out.gain, 0, fade, this.ctx.currentTime)

    const release = () => {
      for (const source of [...this.sustained, ...this.transients]) {
        try {
          source.stop()
        } catch {
          /* already stopped, or never started */
        }
      }
      this.transients.clear()
      for (const node of [...this.nodes, this.out]) {
        try {
          node.disconnect()
        } catch {
          /* already disconnected */
        }
      }
      this.nodes.length = 0
      this.sustained.length = 0
    }

    // Release only once the fade has finished, so nothing is cut off mid-ramp.
    if (fade > 0) later(release, (fade + 0.2) * 1000)
    else release()
  }
}

interface GrainOptions extends GrainParams {
  when: number
  buffer: AudioBuffer
  destination: AudioNode
  filterType?: BiquadFilterType
}

/**
 * One short filtered-noise event — a droplet, a crackle, a breath of spray.
 *
 * The envelope is scheduled entirely on `AudioParam`s: a short linear attack so
 * nothing arrives as a click, then an exponential decay, which is how a real
 * transient dies away.
 */
function grain(rig: Rig, options: GrainOptions): void {
  const { ctx } = rig
  const { when, buffer, destination, attack, decay, peak } = options

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = options.rate

  const filter = ctx.createBiquadFilter()
  filter.type = options.filterType ?? 'bandpass'
  filter.frequency.value = options.frequency
  filter.Q.value = options.Q

  const envelope = ctx.createGain()
  const end = when + attack + decay
  envelope.gain.setValueAtTime(0, when)
  envelope.gain.linearRampToValueAtTime(peak, when + attack)
  envelope.gain.exponentialRampToValueAtTime(peak * 0.0015, end)
  envelope.gain.setValueAtTime(0, end)

  const pan = createPan(ctx, options.pan)

  source.connect(filter)
  filter.connect(envelope)
  envelope.connect(pan)
  pan.connect(destination)
  rig.transient(source, [filter, envelope, pan])

  // Read from a random point in the shared buffer so no two grains are twins.
  const span = Math.max(0, buffer.duration - (attack + decay) * options.rate - 0.02)
  source.start(when, rig.rng() * span)
  source.stop(end + 0.02)
}

/**
 * A wave's shape, as a normalised curve: a gradual arrival, a rounded crest,
 * and a withdrawal that takes noticeably longer than the arrival did.
 */
function swellCurve(
  riseFraction: number,
  holdFraction: number,
  peak: number,
  points = 96,
): Float32Array {
  const curve = new Float32Array(points)
  const rise = clamp(riseFraction, 0.05, 0.8)
  const hold = clamp(holdFraction, 0, 0.9 - rise)
  const fall = 1 - rise - hold

  for (let i = 0; i < points; i += 1) {
    const x = i / (points - 1)
    let value: number
    if (x < rise) {
      value = 0.5 - 0.5 * Math.cos(Math.PI * (x / rise))
    } else if (x < rise + hold) {
      value = 1
    } else {
      const k = fall <= 0 ? 1 : (x - rise - hold) / fall
      value = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, k)), 1.35)
    }
    curve[i] = value * peak
  }
  curve[points - 1] = 0
  return curve
}

/* ── Moon Garden ─────────────────────────────────────────────── */

/**
 * A slow major-ninth pad with occasional bell tones, like a wind chime in a
 * garden at night.
 */
const moonGarden: AmbientPreset = {
  id: 'moon-garden',
  name: 'Moon Garden',
  description: 'A slow pad with soft chimes drifting through it.',
  build(ctx, destination, options) {
    const rig = new Rig(ctx, destination, options, LEVELS['moon-garden'])

    // Pad: four detuned voices through a slowly opening filter.
    const padFilter = rig.node(ctx.createBiquadFilter())
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 620
    padFilter.Q.value = 0.6
    padFilter.connect(rig.out)

    const padGain = rig.node(ctx.createGain())
    padGain.gain.value = 0.16
    padGain.connect(padFilter)

    for (const [freq, detune] of [
      [110, -4],
      [164.81, 3],
      [220, -7],
      [246.94, 6],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.detune.value = detune
      const voice = rig.node(ctx.createGain())
      voice.gain.value = 0.25
      osc.connect(voice)
      voice.connect(padGain)
      rig.sustain(osc)
    }

    rig.lfo(0.035, 260, padFilter.frequency)
    rig.lfo(0.017, 0.05, padGain.gain)

    // Air: barely-there filtered noise so the pad is not sterile.
    const airFilter = rig.node(ctx.createBiquadFilter())
    airFilter.type = 'lowpass'
    airFilter.frequency.value = 900
    const airGain = rig.node(ctx.createGain())
    airGain.gain.value = 0.05
    rig.noise('brown', 6, options?.seed).connect(airFilter)
    airFilter.connect(airGain)
    airGain.connect(rig.out)

    // Chimes: a pentatonic scale, struck at unpredictable intervals.
    const scale = [523.25, 587.33, 698.46, 783.99, 880, 1046.5]

    const strikeAt = (when: number) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = scale[Math.floor(rig.rng() * scale.length)]

      const bell = ctx.createGain()
      bell.gain.setValueAtTime(0.0001, when)
      bell.gain.exponentialRampToValueAtTime(0.07, when + 0.04)
      bell.gain.exponentialRampToValueAtTime(0.0001, when + 4.5)

      osc.connect(bell)
      bell.connect(rig.out)
      rig.transient(osc, [bell])
      osc.start(when)
      osc.stop(when + 4.8)
    }

    let nextStrike = 0
    rig.schedule((from, to) => {
      let at = Math.max(from + 2.5, nextStrike)
      while (at < to) {
        strikeAt(at)
        at += 6 + rig.rng() * 9
      }
      nextStrike = at
    }, 6)

    return rig.handle()
  },
}

/* ── Soft Horizon ────────────────────────────────────────────── */

/**
 * A wide low drone under a slow filtered-noise swell — distant weather over
 * open ground.
 */
const softHorizon: AmbientPreset = {
  id: 'soft-horizon',
  name: 'Soft Horizon',
  description: 'A low warm drone under a slow, wave-like swell.',
  build(ctx, destination, options) {
    const rig = new Rig(ctx, destination, options, LEVELS['soft-horizon'])

    // Swell: brown noise through a filter that breathes open and closed.
    const swellFilter = rig.node(ctx.createBiquadFilter())
    swellFilter.type = 'lowpass'
    swellFilter.frequency.value = 480
    swellFilter.Q.value = 1.1

    const swellGain = rig.node(ctx.createGain())
    swellGain.gain.value = 0.16

    rig.noise('brown', 8, options?.seed).connect(swellFilter)
    swellFilter.connect(swellGain)
    swellGain.connect(rig.out)

    rig.lfo(0.055, 300, swellFilter.frequency)
    rig.lfo(0.038, 0.075, swellGain.gain)

    // Drone: an octave-and-a-fifth of very low warmth.
    const droneFilter = rig.node(ctx.createBiquadFilter())
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 320
    droneFilter.connect(rig.out)

    const droneGain = rig.node(ctx.createGain())
    droneGain.gain.value = 0.2
    droneGain.connect(droneFilter)

    for (const [freq, type] of [
      [65.41, 'sine'],
      [98, 'triangle'],
      [130.81, 'sine'],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      const voice = rig.node(ctx.createGain())
      voice.gain.value = type === 'triangle' ? 0.16 : 0.3
      osc.connect(voice)
      voice.connect(droneGain)
      rig.sustain(osc)
    }

    rig.lfo(0.021, 0.06, droneGain.gain)

    return rig.handle()
  },
}

/* ── Rain on Window ──────────────────────────────────────────── */

interface RainProfile {
  dropsPerSecond: number
  /** Low-pass on the rain bed: the difference between soft and full. */
  brightnessHz: number
  bedGain: number
  roomGain: number
  /** Scales droplet peaks down from their ceiling. */
  dropIntensity: number
}

const RAIN_PROFILES: Record<RainCharacter, RainProfile> = {
  soft: {
    dropsPerSecond: 2.2,
    brightnessHz: 6800,
    bedGain: 0.085,
    roomGain: 0.035,
    dropIntensity: 0.62,
  },
  steady: {
    dropsPerSecond: 3.4,
    brightnessHz: 7800,
    bedGain: 0.105,
    roomGain: 0.05,
    dropIntensity: 0.8,
  },
  full: {
    dropsPerSecond: 4.6,
    brightnessHz: 8800,
    bedGain: 0.125,
    roomGain: 0.075,
    dropIntensity: 1,
  },
}

/**
 * Steady rain a few inches away, on the other side of the glass.
 *
 * Four layers, none of them expensive: a filtered noise bed with a gentle lift
 * where rain meets glass, individual droplets at irregular intervals, two
 * almost-subliminal window resonances, and a low room tone so the whole thing
 * has a floor to sit on. There is no thunder and there never will be — the
 * point is a sound you can sleep through.
 */
const rainWindow: AmbientPreset = {
  id: 'rain-window',
  name: 'Rain on Window',
  description: 'Soft rain settling against a nearby window.',
  build(ctx, destination, options) {
    const rig = new Rig(ctx, destination, options, LEVELS['rain-window'])
    const profile = RAIN_PROFILES[options?.rainCharacter ?? 'steady']

    const rain = rig.noise('pink', 8, options?.seed)

    // Bed: sub-bass removed, hiss softened, a broad lift where the drops land.
    const highpass = rig.node(ctx.createBiquadFilter())
    highpass.type = 'highpass'
    highpass.frequency.value = 430
    highpass.Q.value = 0.5

    const lowpass = rig.node(ctx.createBiquadFilter())
    lowpass.type = 'lowpass'
    lowpass.frequency.value = profile.brightnessHz
    lowpass.Q.value = 0.5

    const glass = rig.node(ctx.createBiquadFilter())
    glass.type = 'peaking'
    glass.frequency.value = 2200
    glass.Q.value = 0.8
    glass.gain.value = 3.2

    const bedGain = rig.node(ctx.createGain())
    bedGain.gain.value = profile.bedGain

    rain.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(glass)
    glass.connect(bedGain)
    bedGain.connect(rig.out)

    rig.lfo(0.031, 550, lowpass.frequency)
    rig.lfo(0.019, 0.012, bedGain.gain)

    // Room tone: warmth under the rain, so it never sounds thin.
    const room = rig.node(ctx.createBiquadFilter())
    room.type = 'lowpass'
    room.frequency.value = 210
    const roomGain = rig.node(ctx.createGain())
    roomGain.gain.value = profile.roomGain
    rig.noise('brown', 6, options?.seed).connect(room)
    room.connect(roomGain)
    roomGain.connect(rig.out)

    // Window resonance: two narrow taps off the rain, kept near-subliminal.
    if (!rig.lowPower) {
      for (const [frequency, q, level, rate] of [
        [880, 7, 0.014, 0.013],
        [1950, 9, 0.01, 0.0207],
      ] as const) {
        const resonance = rig.node(ctx.createBiquadFilter())
        resonance.type = 'bandpass'
        resonance.frequency.value = frequency
        resonance.Q.value = q
        const level_ = rig.node(ctx.createGain())
        level_.gain.value = level
        rain.connect(resonance)
        resonance.connect(level_)
        level_.connect(rig.out)
        rig.lfo(rate, level * 0.65, level_.gain)
      }
    }

    // Droplets: a Poisson-ish arrival process, so there is no pattern to hear.
    const dropBuffer = noiseBuffer(ctx, 'white', 0.5, options?.seed)
    let nextDrop = 0

    rig.schedule((from, to) => {
      let at = Math.max(from, nextDrop)
      while (at < to) {
        const params = randomDroplet(rig.rng, profile.dropIntensity)
        grain(rig, {
          ...params,
          when: at,
          buffer: dropBuffer,
          destination: rig.out,
        })
        at += gapFor(rig.rng, profile.dropsPerSecond)
      }
      nextDrop = at
    })

    return rig.handle()
  },
}

/**
 * Time until the next event in a Poisson-like process, bounded either side so
 * a run of unlucky draws can neither bunch events up nor leave a hole.
 */
function gapFor(rng: () => number, perSecond: number): number {
  const mean = 1 / Math.max(0.05, perSecond)
  const draw = -Math.log(1 - rng() * 0.999) * mean
  return clamp(draw, mean * 0.25, mean * 3)
}

/* ── Ocean Tide ──────────────────────────────────────────────── */

/**
 * Slow coastal water: waves that arrive, spread and withdraw.
 *
 * Each wave is a scheduled envelope across three noise voices — a low body, a
 * mid foam layer that enters a moment later and leaves sooner, and an
 * occasional breath of spray near the crest. Several waves overlap, and the
 * spacing, length and height of each are drawn from ranges wide enough that the
 * pattern never closes on itself. Underneath it all a quiet water bed keeps
 * playing, so the shore is never silent.
 */
const oceanTide: AmbientPreset = {
  id: 'ocean-tide',
  name: 'Ocean Tide',
  description: 'Slow ocean waves arriving and fading into the shore.',
  build(ctx, destination, options) {
    const rig = new Rig(ctx, destination, options, LEVELS['ocean-tide'])

    // Two shared reads of different lengths, so their loops never line up.
    const body = rig.noise('brown', 9, options?.seed)
    const foamNoise = rig.noise('pink', 7, options?.seed)

    // The bed: always there, moving on three incommensurable periods.
    const bedFilter = rig.node(ctx.createBiquadFilter())
    bedFilter.type = 'lowpass'
    bedFilter.frequency.value = 380
    bedFilter.Q.value = 0.6
    const bedFloor = rig.node(ctx.createBiquadFilter())
    bedFloor.type = 'highpass'
    bedFloor.frequency.value = 42
    const bedGain = rig.node(ctx.createGain())
    bedGain.gain.value = 0.05
    body.connect(bedFilter)
    bedFilter.connect(bedFloor)
    bedFloor.connect(bedGain)
    bedGain.connect(rig.out)
    rig.lfo(0.091, 0.014, bedGain.gain)
    rig.lfo(0.043, 0.01, bedGain.gain)
    rig.lfo(1 / 47, 0.008, bedGain.gain)

    interface WaveVoice {
      low: GainNode
      foam: GainNode
      spray: GainNode | null
      lowPan: AudioNode
      foamPan: AudioNode
      busyUntil: number
    }

    const voiceCount = rig.lowPower ? 3 : 4
    const voices: WaveVoice[] = []

    for (let index = 0; index < voiceCount; index += 1) {
      const spread = index / Math.max(1, voiceCount - 1)

      const lowPan = rig.node(createPan(ctx, 0))
      lowPan.connect(rig.out)
      const foamPan = rig.node(createPan(ctx, 0))
      foamPan.connect(rig.out)

      // Low body: broad and close to the centre.
      const lowFilter = rig.node(ctx.createBiquadFilter())
      lowFilter.type = 'lowpass'
      lowFilter.frequency.value = 520 + spread * 340
      lowFilter.Q.value = 0.7
      const lowFloor = rig.node(ctx.createBiquadFilter())
      lowFloor.type = 'highpass'
      lowFloor.frequency.value = 44
      const low = rig.node(ctx.createGain())
      low.gain.value = 0
      body.connect(lowFilter)
      lowFilter.connect(lowFloor)
      lowFloor.connect(low)
      low.connect(lowPan)

      // Foam: mid-band, spread wider than the body.
      const foamFilter = rig.node(ctx.createBiquadFilter())
      foamFilter.type = 'bandpass'
      foamFilter.frequency.value = 1150 + spread * 700
      foamFilter.Q.value = 0.6
      const foamCeiling = rig.node(ctx.createBiquadFilter())
      foamCeiling.type = 'lowpass'
      foamCeiling.frequency.value = 3400
      foamCeiling.Q.value = 0.5
      const foam = rig.node(ctx.createGain())
      foam.gain.value = 0
      foamNoise.connect(foamFilter)
      foamFilter.connect(foamCeiling)
      foamCeiling.connect(foam)
      foam.connect(foamPan)

      // Spray: quiet, high, and only on some waves.
      let spray: GainNode | null = null
      if (!rig.lowPower) {
        const sprayFilter = rig.node(ctx.createBiquadFilter())
        sprayFilter.type = 'highpass'
        sprayFilter.frequency.value = 3200
        sprayFilter.Q.value = 0.6
        spray = rig.node(ctx.createGain())
        spray.gain.value = 0
        foamNoise.connect(sprayFilter)
        sprayFilter.connect(spray)
        spray.connect(foamPan)
      }

      voices.push({ low, foam, spray, lowPan, foamPan, busyUntil: 0 })
    }

    /**
     * Slow amplitude drift across two long periods, so consecutive waves are
     * never the same height. These are soundscape motion, nothing more.
     */
    const swellAmount = (at: number) =>
      (0.7 + 0.3 * Math.sin((2 * Math.PI * at) / 17.3)) *
      (0.86 + 0.14 * Math.sin((2 * Math.PI * at) / 47.5))

    const scheduleWave = (at: number) => {
      const voice = voices.reduce((best, item) =>
        item.busyUntil < best.busyUntil ? item : best,
      )
      // Every voice still withdrawing: let this wave pass rather than clip one.
      if (voice.busyUntil > at) return

      const rise = 3.2 + rig.rng() * 2.6
      const hold = 0.5 + rig.rng() * 1.2
      const fall = rise * (1.6 + rig.rng() * 0.6)
      const total = rise + hold + fall
      const amount = swellAmount(at) * (0.85 + rig.rng() * 0.15)

      // The body arrives first and takes the longest to leave.
      voice.low.gain.setValueCurveAtTime(
        swellCurve(rise / total, hold / total, 0.3 * amount),
        at,
        total,
      )

      // Foam enters after the body and clears sooner.
      const foamStart = at + rise * 0.45
      const foamLength = total - rise * 0.45 - fall * 0.3
      voice.foam.gain.setValueCurveAtTime(
        swellCurve(0.32, 0.12, 0.16 * amount),
        foamStart,
        foamLength,
      )

      // Spray sits near the crest, on roughly two waves in five.
      if (voice.spray && rig.rng() < 0.4) {
        const sprayLength = 1.4 + rig.rng() * 1.6
        voice.spray.gain.setValueCurveAtTime(
          swellCurve(0.3, 0.08, 0.05 * amount),
          at + rise * 0.8,
          sprayLength,
        )
      }

      // Waves land in slightly different places; foam spreads wider than body.
      const position = (rig.rng() * 2 - 1)
      const lowPan = panParam(voice.lowPan)
      const foamPan = panParam(voice.foamPan)
      lowPan?.setTargetAtTime(position * 0.18, at, 1.5)
      foamPan?.setTargetAtTime(position * 0.5, at, 1.5)

      voice.busyUntil = at + total + 0.2
    }

    let nextWave = 0
    rig.schedule((from, to) => {
      let at = Math.max(from, nextWave)
      while (at < to) {
        scheduleWave(at)
        // Primary swell period.
        at += 9 + rig.rng() * 4
      }
      nextWave = at
    }, 4)

    return rig.handle()
  },
}

/* ── Fireplace Glow ──────────────────────────────────────────── */

/**
 * A fire in a quiet room.
 *
 * A low brown-noise flame bed whose level and cutoff drift on several
 * incommensurable periods — cheaper than smoothing random values, and it never
 * settles into a loop — with small crackles arriving in bursts and quiet
 * stretches, and a rounded wood pop every several seconds. Both kinds of
 * transient pass through their own compressor, so no random draw can ever
 * become the loud noise that makes someone jump.
 */
const fireplaceGlow: AmbientPreset = {
  id: 'fireplace-glow',
  name: 'Fireplace Glow',
  description: 'Warm flames, soft crackles, and a quiet room around you.',
  build(ctx, destination, options) {
    const rig = new Rig(ctx, destination, options, LEVELS['fireplace-glow'])
    const flame = rig.noise('brown', 7, options?.seed)

    // Flame bed.
    const bedFilter = rig.node(ctx.createBiquadFilter())
    bedFilter.type = 'lowpass'
    bedFilter.frequency.value = 700
    bedFilter.Q.value = 0.7
    const bedGain = rig.node(ctx.createGain())
    bedGain.gain.value = 0.115
    flame.connect(bedFilter)
    bedFilter.connect(bedGain)
    bedGain.connect(rig.out)

    // Warmth movement: slow, and never fast enough to hear as an effect.
    rig.lfo(0.037, 130, bedFilter.frequency)
    rig.lfo(0.0134, 90, bedFilter.frequency)
    rig.lfo(0.083, 0.022, bedGain.gain)
    rig.lfo(0.137, 0.014, bedGain.gain)
    rig.lfo(0.211, 0.008, bedGain.gain)

    // Body: a narrow band of low warmth under the flame.
    const bodyFilter = rig.node(ctx.createBiquadFilter())
    bodyFilter.type = 'bandpass'
    bodyFilter.frequency.value = 320
    bodyFilter.Q.value = 0.9
    const bodyGain = rig.node(ctx.createGain())
    bodyGain.gain.value = 0.06
    flame.connect(bodyFilter)
    bodyFilter.connect(bodyGain)
    bodyGain.connect(rig.out)
    rig.lfo(0.059, 0.012, bodyGain.gain)

    /*
     * A guaranteed ceiling on every transient, ahead of the shared mix.
     *
     * Crackles top out at 0.05 and sit inside this curve's linear region
     * untouched; a pop can reach 0.09 and gets rounded off to about 0.075. So the
     * loudest thing the fire can ever produce is a fixed number rather than
     * whatever a particular engine's compressor happens to let through.
     */
    const sparks = rig.node(ctx.createGain())
    const guard = rig.node(createSoftCeiling(ctx, 0.045, 0.03))
    sparks.connect(guard)
    guard.connect(rig.out)

    const burstBuffer = noiseBuffer(ctx, 'white', 0.5, options?.seed)

    let nextCrackle = 0
    let nextPop = 0
    let activity = 1
    let activityUntil = 0

    const popAt = (when: number, params: PopParams) => {
      // A low resonance that drops in pitch, plus a soft burst of noise: the
      // shape of a piece of wood giving way, without the crack.
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(params.thumpHz, when)
      osc.frequency.exponentialRampToValueAtTime(
        params.thumpHz * 0.62,
        when + params.thumpDecay,
      )
      const envelope = ctx.createGain()
      const end = when + params.thumpDecay
      envelope.gain.setValueAtTime(0, when)
      envelope.gain.linearRampToValueAtTime(params.peak, when + 0.004)
      envelope.gain.exponentialRampToValueAtTime(params.peak * 0.002, end)
      envelope.gain.setValueAtTime(0, end)

      const pan = createPan(ctx, params.pan)
      osc.connect(envelope)
      envelope.connect(pan)
      pan.connect(sparks)
      rig.transient(osc, [envelope, pan])
      osc.start(when)
      osc.stop(end + 0.02)

      grain(rig, {
        when,
        buffer: burstBuffer,
        destination: sparks,
        filterType: 'lowpass',
        frequency: 700,
        Q: 1.2,
        attack: 0.003,
        decay: params.noiseDecay,
        peak: params.peak * 0.5,
        pan: params.pan,
        rate: 1,
      })
    }

    rig.schedule((from, to) => {
      // Crackles come in bursts with quiet stretches between them.
      let at = Math.max(from, nextCrackle)
      while (at < to) {
        if (at > activityUntil) {
          activity = 0.25 + rig.rng() * 1.35
          activityUntil = at + 1.5 + rig.rng() * 2.5
          // Nudge the flame's colour while we are here, so even the slow
          // movement is not purely periodic.
          bedFilter.frequency.setTargetAtTime(520 + rig.rng() * 340, at, 2.5)
        }
        grain(rig, {
          ...randomCrackle(rig.rng),
          when: at,
          buffer: burstBuffer,
          destination: sparks,
        })
        at += gapFor(rig.rng, 5.5 * activity)
      }
      nextCrackle = at

      let popTime = Math.max(from, nextPop)
      while (popTime < to) {
        const params = randomPop(rig.rng)
        popAt(popTime, params)
        popTime += params.gap
      }
      nextPop = popTime
    })

    return rig.handle()
  },
}

/* ── The library ─────────────────────────────────────────────── */

/** Presentation order, and the order the Sounds tab renders. */
export const AMBIENT_PRESETS: AmbientPreset[] = [
  moonGarden,
  softHorizon,
  rainWindow,
  oceanTide,
  fireplaceGlow,
]

export const BUILTIN_AMBIENT_IDS: BuiltInAmbientId[] = AMBIENT_PRESETS.map(
  (preset) => preset.id,
)

export function findAmbientPreset(id: string): AmbientPreset | undefined {
  return AMBIENT_PRESETS.find((preset) => preset.id === id)
}

export function isBuiltInAmbientId(id: string): id is BuiltInAmbientId {
  return AMBIENT_PRESETS.some((preset) => preset.id === id)
}
