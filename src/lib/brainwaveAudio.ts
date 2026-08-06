/**
 * Brainwave rhythms.
 *
 * The five presets are named after the conventional EEG frequency bands. That
 * is all the names mean here: each one generates an audible carrier whose
 * amplitude rises and falls at an exact rate, or — with headphones — two tones
 * whose frequencies differ by exactly that rate. Nothing in this file claims a
 * clinical effect, and nothing should.
 *
 * Two rules shape the whole implementation:
 *
 *  1. **The rate is exact and it is owned by one table.** `BRAINWAVE_PRESETS`
 *     is the only place a frequency is written down. Persisted values are
 *     re-derived from the preset id rather than trusted, so a hand-edited or
 *     out-of-date saved ritual can never play at some other rate.
 *  2. **The rate lives on the audio thread.** The modulation comes from an
 *     `OscillatorNode` connected to a `GainNode`'s `gain` `AudioParam`. No
 *     interval, frame callback or restarted oscillator is involved, so a
 *     throttled tab or a dropped frame cannot shift the frequency.
 *
 * 2 Hz, 6 Hz and 10 Hz are never played as pitches — they are far below
 * hearing, and a speaker asked to reproduce them mostly produces nothing.
 * They are modulation rates and frequency differences only.
 */

import type { AudioBus } from './audioBus'
import { rampParam } from './audioParams'

/* ── The one source of truth ─────────────────────────────────── */

/**
 * The audible tone the rhythm rides on. Low enough to feel restful, high
 * enough that phone speakers reproduce it properly.
 */
export const CARRIER_HZ = 200

export type BrainwavePresetId = 'gamma' | 'beta' | 'alpha' | 'theta' | 'delta'

export type BrainwaveMode = 'amplitude-modulation' | 'binaural'

/**
 * Exact generated rates, with the conventional EEG band each name refers to.
 *
 * Band edges differ slightly between clinical and research references, so the
 * ranges are presented as conventional rather than universal. The `targetHz`
 * values, by contrast, are fixed and exact.
 */
export const BRAINWAVE_PRESETS = {
  gamma: { targetHz: 40, minHz: 30, maxHz: 80 },
  beta: { targetHz: 20, minHz: 13, maxHz: 30 },
  alpha: { targetHz: 10, minHz: 8, maxHz: 13 },
  theta: { targetHz: 6, minHz: 4, maxHz: 8 },
  delta: { targetHz: 2, minHz: 0.5, maxHz: 4 },
} as const

export type BrainwaveTargetHz =
  (typeof BRAINWAVE_PRESETS)[BrainwavePresetId]['targetHz']

/** Display order: fastest rhythm at the top, slowest at the bottom. */
export const BRAINWAVE_ORDER: BrainwavePresetId[] = [
  'gamma',
  'beta',
  'alpha',
  'theta',
  'delta',
]

/**
 * Binaural beating is generally discussed within roughly a 1–30 Hz difference,
 * so 40 Hz Gamma is generated as amplitude modulation even in headphone mode.
 */
export const BINAURAL_MAX_HZ = 30

export interface BrainwaveSettings {
  enabled: boolean
  preset: BrainwavePresetId
  targetHz: BrainwaveTargetHz
  mode: BrainwaveMode
  /** 0 – 1, relative to the master sound volume. */
  volume: number
  /** 0.2 – 1. How deeply the carrier's amplitude swings each cycle. */
  depth: number
}

export const DEFAULT_BRAINWAVE: BrainwaveSettings = {
  enabled: false,
  preset: 'alpha',
  targetHz: 10,
  mode: 'amplitude-modulation',
  // The rhythm sits under the master sound volume, so it was doubly quiet.
  volume: 0.55,
  depth: 0.7,
}

export const BRAINWAVE_DEPTH_LIMITS = { min: 0.2, max: 1 } as const

/** Neutral one-line character, never a promised outcome. */
const CHARACTER: Record<BrainwavePresetId, string> = {
  gamma: 'High-frequency rhythm',
  beta: 'Active rhythm',
  alpha: 'Resting rhythm',
  theta: 'Slow rhythm',
  delta: 'Very slow rhythm',
}

const LABEL: Record<BrainwavePresetId, string> = {
  gamma: 'Gamma Waves',
  beta: 'Beta Waves',
  alpha: 'Alpha Waves',
  theta: 'Theta Waves',
  delta: 'Delta Waves',
}

export interface BrainwaveMeta {
  id: BrainwavePresetId
  label: string
  character: string
  targetHz: BrainwaveTargetHz
  minHz: number
  maxHz: number
}

export const BRAINWAVE_LIST: BrainwaveMeta[] = BRAINWAVE_ORDER.map((id) => ({
  id,
  label: LABEL[id],
  character: CHARACTER[id],
  targetHz: BRAINWAVE_PRESETS[id].targetHz,
  minHz: BRAINWAVE_PRESETS[id].minHz,
  maxHz: BRAINWAVE_PRESETS[id].maxHz,
}))

/** The compact, claim-free explanation shown wherever the feature appears. */
export const BRAINWAVE_DISCLOSURE =
  'These names refer to conventional EEG frequency bands. The sound uses an ' +
  'audible carrier modulated at the selected rate. Experiences vary, and this ' +
  'feature is not a medical treatment or diagnostic tool.'

/** Shown when Gamma is chosen while headphone mode is on. */
export const GAMMA_BINAURAL_NOTE =
  '40 Hz Gamma uses rhythmic amplitude modulation. Standard binaural-beat ' +
  'perception is generally studied at lower difference frequencies.'

/* ── Pure frequency maths ────────────────────────────────────── */

export function isBrainwavePreset(value: unknown): value is BrainwavePresetId {
  return typeof value === 'string' && value in BRAINWAVE_PRESETS
}

/** The exact modulation rate for a preset. The only way to obtain one. */
export function getTargetHz(preset: BrainwavePresetId): BrainwaveTargetHz {
  return BRAINWAVE_PRESETS[preset].targetHz
}

export function getBand(preset: BrainwavePresetId): {
  minHz: number
  maxHz: number
} {
  const { minHz, maxHz } = BRAINWAVE_PRESETS[preset]
  return { minHz, maxHz }
}

/** e.g. `"approximately 8–13 Hz"`. */
export function getBandLabel(preset: BrainwavePresetId): string {
  const { minHz, maxHz } = getBand(preset)
  return `approximately ${formatHz(minHz, false)}–${formatHz(maxHz)}`
}

export function formatHz(hz: number, withUnit = true): string {
  const value = Number.isInteger(hz) ? String(hz) : hz.toFixed(1)
  return withUnit ? `${value} Hz` : value
}

/**
 * The two channel frequencies for a binaural beat, placed symmetrically either
 * side of the carrier so their difference is exactly `targetHz` and their mean
 * is exactly `CARRIER_HZ`.
 */
export function getBinauralPair(targetHz: number): {
  leftHz: number
  rightHz: number
} {
  return {
    leftHz: CARRIER_HZ - targetHz / 2,
    rightHz: CARRIER_HZ + targetHz / 2,
  }
}

/** The beat rate a channel pair actually produces. */
export function getBeatHz(leftHz: number, rightHz: number): number {
  return Math.abs(rightHz - leftHz)
}

/** True when a rate sits inside the range binaural beating is discussed for. */
export function supportsBinaural(targetHz: number): boolean {
  return targetHz >= 1 && targetHz <= BINAURAL_MAX_HZ
}

/**
 * What will actually be generated. Choosing Gamma with headphone mode on falls
 * back to amplitude modulation rather than silently producing a 40 Hz pair
 * outside the range binaural beating is studied at.
 */
export function resolveMode(
  preset: BrainwavePresetId,
  mode: BrainwaveMode,
): BrainwaveMode {
  if (mode !== 'binaural') return 'amplitude-modulation'
  return supportsBinaural(getTargetHz(preset)) ? 'binaural' : 'amplitude-modulation'
}

/** True when the user asked for headphone mode but this preset cannot use it. */
export function isBinauralSubstituted(
  preset: BrainwavePresetId,
  mode: BrainwaveMode,
): boolean {
  return mode === 'binaural' && resolveMode(preset, mode) !== 'binaural'
}

export function describeMode(mode: BrainwaveMode): string {
  return mode === 'binaural' ? 'Binaural headphones' : 'Rhythmic modulation'
}

/**
 * Rebuild a trustworthy settings object from whatever was persisted.
 *
 * A saved ritual may come from an older version with no `brainwave` key at all,
 * or carry a `targetHz` that no longer matches its preset. Either way the rate
 * is re-derived from the preset, never read back.
 */
export function normaliseBrainwave(
  raw: Partial<BrainwaveSettings> | null | undefined,
): BrainwaveSettings {
  if (!raw) return { ...DEFAULT_BRAINWAVE }

  const preset = isBrainwavePreset(raw.preset) ? raw.preset : DEFAULT_BRAINWAVE.preset
  const mode: BrainwaveMode =
    raw.mode === 'binaural' ? 'binaural' : 'amplitude-modulation'

  return {
    enabled: raw.enabled === true,
    preset,
    // Derived, never trusted.
    targetHz: getTargetHz(preset),
    mode,
    volume: clampRange(raw.volume, 0, 1, DEFAULT_BRAINWAVE.volume),
    depth: clampRange(
      raw.depth,
      BRAINWAVE_DEPTH_LIMITS.min,
      BRAINWAVE_DEPTH_LIMITS.max,
      DEFAULT_BRAINWAVE.depth,
    ),
  }
}

/** Move to a different preset, keeping level and intensity. */
export function withPreset(
  settings: BrainwaveSettings,
  preset: BrainwavePresetId,
): BrainwaveSettings {
  return {
    ...settings,
    enabled: true,
    preset,
    targetHz: getTargetHz(preset),
  }
}

function clampRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/* ── Graph construction ──────────────────────────────────────── */

/** Long enough that the rhythm arrives and leaves without ever announcing itself. */
export const BRAINWAVE_FADE_SECONDS = 1.8

/**
 * Peak amplitude of the summed carriers before the fade envelope.
 *
 * Doubled from the original 0.3 / 0.34 at the user's request, so 100% on the
 * rhythm volume slider is twice as loud as it used to be. The shared mix
 * ceiling in `audioBus.ts` is what keeps this from clipping when a rhythm at
 * full level stacks with ambience on top of it.
 */
const AM_TRIM = 0.6
const BINAURAL_TRIM = 0.68

/**
 * A soft organ-like timbre rather than a bare sine, so a 200 Hz tone can run
 * for half an hour without becoming a test signal. Every voice passes through
 * the same modulated gain, so all of them carry the identical rhythm.
 */
const AM_PARTIALS: Array<{ ratio: number; gain: number }> = [
  { ratio: 1, gain: 1 },
  { ratio: 2, gain: 0.2 },
  { ratio: 3, gain: 0.075 },
]

/** Well clear of 200 Hz and of the ±40 Hz sidebands, so the rate is untouched. */
const SHAPE_HIGHPASS_HZ = 45
const SHAPE_LOWPASS_HZ = 2200

export interface ModulationEnvelope {
  /**
   * Feed a carrier in here and its amplitude follows the rhythm. Feed a
   * constant 1 in and the output *is* the envelope, which is how the frequency
   * tests measure the rate directly rather than inferring it from a tone.
   */
  node: GainNode
  setDepth: (depth: number, ramp?: number) => void
  /** The oscillator carrying the rate, so a caller can stop it. */
  modulator: OscillatorNode
  /** Everything the caller has to disconnect on teardown. */
  nodes: AudioNode[]
}

/**
 * The rhythm itself: a gain whose value is driven at audio rate by an
 * oscillator running at exactly `targetHz`.
 *
 * At depth 1 the resting value and the modulator's amplitude are both 0.5,
 * giving `0.5 · [1 + sin(2π · targetHz · t)]` exactly. Lower depths raise the
 * resting value and shrink the swing by the same amount, so the peak stays put
 * and — the part that matters — the rate never moves.
 */
export function createModulationEnvelope(
  ctx: BaseAudioContext,
  targetHz: number,
  depth: number,
): ModulationEnvelope {
  const node = ctx.createGain()

  const modulator = ctx.createOscillator()
  modulator.type = 'sine'
  modulator.frequency.value = targetHz
  const modDepth = ctx.createGain()
  modulator.connect(modDepth)
  modDepth.connect(node.gain)
  modulator.start()

  const setDepth = (next: number, ramp = 0.25) => {
    const clamped = Math.min(1, Math.max(0, next))
    const now = ctx.currentTime
    // The resting value and the swing move together and by the same amount, so
    // the peak stays put — and neither is ever stepped.
    rampParam(node.gain, 1 - clamped / 2, ramp, now)
    rampParam(modDepth.gain, clamped / 2, ramp, now)
  }

  setDepth(depth, 0)
  return { node, setDepth, modulator, nodes: [node, modDepth] }
}

export interface BrainwaveGraphOptions {
  targetHz: number
  /** Already resolved — pass `resolveMode()`'s answer, not the raw setting. */
  mode: BrainwaveMode
  depth: number
}

export interface BrainwaveGraph {
  readonly mode: BrainwaveMode
  readonly targetHz: number
  /** The node to connect onward. Carries the fade envelope and the level. */
  readonly out: GainNode
  /** Ramp the depth of the amplitude swing. A no-op in binaural mode. */
  setDepth: (depth: number, ramp?: number) => void
  /** Ramp the level, fading up from silence on the first call. */
  setLevel: (level: number, ramp?: number) => void
  /** Fade to silence over `seconds`. */
  fadeOut: (seconds?: number) => void
  /** Stop every source and unwire everything. */
  dispose: () => void
}

/**
 * Wire up one rhythm.
 *
 * Amplitude modulation, the default, works on speakers and headphones alike:
 *
 *     carrier(t)  = sin(2π · 200 · t)
 *     envelope(t) = 0.5 · [1 + sin(2π · targetHz · t)]
 *     output(t)   = gain · carrier(t) · envelope(t)
 *
 * `envelope` is an `OscillatorNode` running at exactly `targetHz`, connected
 * through a gain into the carrier gain's `gain` param. At depth 1 the offset
 * and the modulator's amplitude are both 0.5, which is the formula above
 * exactly; lower depths raise the offset and shrink the swing by the same
 * amount, so the rate never changes.
 */
export function createBrainwaveGraph(
  ctx: BaseAudioContext,
  options: BrainwaveGraphOptions,
): BrainwaveGraph {
  const { targetHz, mode } = options
  const sources: AudioScheduledSourceNode[] = []
  const nodes: AudioNode[] = []

  const out = ctx.createGain()
  out.gain.value = 0
  nodes.push(out)

  let setDepth: BrainwaveGraph['setDepth'] = () => undefined

  if (mode === 'binaural') {
    /*
     * Hard channel separation: one oscillator per ear into a channel merger,
     * which is `discrete` by definition. A panned mono signal would put both
     * frequencies in both ears and there would be no beat to perceive.
     *
     * Deliberately unfiltered pure sines. Any harmonic content would beat at a
     * multiple of the target rate as well, and any filter after the merger is
     * one more thing that has to behave identically on both channels.
     */
    const { leftHz, rightHz } = getBinauralPair(targetHz)
    const merger = ctx.createChannelMerger(2)
    nodes.push(merger)

    for (const [index, hz] of [leftHz, rightHz].entries()) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = hz
      const trim = ctx.createGain()
      trim.gain.value = BINAURAL_TRIM
      osc.connect(trim)
      trim.connect(merger, 0, index)
      osc.start()
      sources.push(osc)
      nodes.push(trim)
    }

    merger.connect(out)
  } else {
    const envelope = createModulationEnvelope(ctx, targetHz, options.depth)
    const modulated = envelope.node
    setDepth = envelope.setDepth
    sources.push(envelope.modulator)
    nodes.push(...envelope.nodes)

    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = SHAPE_HIGHPASS_HZ
    highpass.Q.value = 0.4

    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = SHAPE_LOWPASS_HZ
    lowpass.Q.value = 0.4

    nodes.push(highpass, lowpass)

    for (const partial of AM_PARTIALS) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = CARRIER_HZ * partial.ratio
      const voice = ctx.createGain()
      voice.gain.value = partial.gain * AM_TRIM
      osc.connect(voice)
      voice.connect(modulated)
      osc.start()
      sources.push(osc)
      nodes.push(voice)
    }

    modulated.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(out)
  }

  let disposed = false

  return {
    mode,
    targetHz,
    out,

    setDepth,

    setLevel(next, ramp = BRAINWAVE_FADE_SECONDS) {
      if (disposed) return
      const target = Math.min(1, Math.max(0, next))
      rampParam(out.gain, target, ramp, ctx.currentTime)
    },

    fadeOut(seconds = BRAINWAVE_FADE_SECONDS) {
      if (disposed) return
      rampParam(out.gain, 0, Math.max(0.05, seconds), ctx.currentTime)
    },

    dispose() {
      if (disposed) return
      disposed = true
      for (const source of sources) {
        try {
          source.stop()
        } catch {
          /* already stopped */
        }
      }
      for (const node of nodes) {
        try {
          node.disconnect()
        } catch {
          /* already disconnected */
        }
      }
    },
  }
}

/* ── The session-facing voice ────────────────────────────────── */

function later(callback: () => void, ms: number): number {
  const host = typeof window === 'undefined' ? globalThis : window
  return host.setTimeout(callback, ms) as unknown as number
}

function cancelLater(id: number): void {
  const host = typeof window === 'undefined' ? globalThis : window
  host.clearTimeout(id)
}

/**
 * One brainwave rhythm attached to an `AudioBus`.
 *
 * Nothing here reaches for audio on its own: `apply()` only builds a graph once
 * the bus already has a context, which the app creates inside a real tap. Pause
 * and resume are the bus suspending the whole context, which freezes
 * `currentTime` and so preserves the oscillators' phase exactly.
 */
export class BrainwaveVoice {
  private readonly bus: AudioBus
  private graph: BrainwaveGraph | null = null
  /** Graphs mid-fade after a preset change, disposed once they are silent. */
  private retiring: BrainwaveGraph[] = []
  private timers: number[] = []
  private current: BrainwaveSettings | null = null

  constructor(bus: AudioBus) {
    this.bus = bus
  }

  get isActive(): boolean {
    return this.graph !== null
  }

  /** What is playing right now, for tests and for the player's readout. */
  get activeMode(): BrainwaveMode | null {
    return this.graph?.mode ?? null
  }

  get activeTargetHz(): number | null {
    return this.graph?.targetHz ?? null
  }

  /**
   * Bring the rhythm in line with `settings`, whatever it is doing now.
   *
   * A change of preset or mode crossfades to a fresh graph; a change of level
   * or depth is a scheduled ramp on the running one. Either way there is no
   * click and no second copy of the same oscillators.
   */
  apply(settings: BrainwaveSettings): void {
    const wanted = normaliseBrainwave(settings)

    if (!wanted.enabled) {
      this.stop()
      return
    }

    const ctx = this.bus.ensure()
    const destination = this.bus.rhythmNode
    if (!ctx || !destination) return

    const mode = resolveMode(wanted.preset, wanted.mode)
    const targetHz = getTargetHz(wanted.preset)

    const needsRebuild =
      !this.graph || this.graph.mode !== mode || this.graph.targetHz !== targetHz

    if (needsRebuild) {
      if (this.graph) this.retire(this.graph)
      const graph = createBrainwaveGraph(ctx, {
        targetHz,
        mode,
        depth: wanted.depth,
      })
      graph.out.connect(destination)
      graph.setLevel(wanted.volume)
      this.graph = graph
    } else if (this.graph) {
      this.graph.setDepth(wanted.depth)
      // Level changes while running are a short ramp, not the long arrival fade.
      const ramp =
        this.current && this.current.volume !== wanted.volume ? 0.25 : undefined
      this.graph.setLevel(wanted.volume, ramp)
    }

    this.current = wanted
  }

  /** Fade out and let go of everything. Safe to call when nothing is playing. */
  stop(fadeSeconds = BRAINWAVE_FADE_SECONDS): void {
    if (this.graph) {
      this.retire(this.graph, fadeSeconds)
      this.graph = null
    }
    this.current = null
  }

  /** Drop everything immediately, for teardown. */
  dispose(): void {
    this.timers.forEach(cancelLater)
    this.timers = []
    this.graph?.dispose()
    this.graph = null
    this.retiring.forEach((graph) => graph.dispose())
    this.retiring = []
    this.current = null
  }

  private retire(graph: BrainwaveGraph, fadeSeconds = BRAINWAVE_FADE_SECONDS): void {
    graph.fadeOut(fadeSeconds)
    this.retiring.push(graph)
    const timer = later(
      () => {
        graph.dispose()
        this.retiring = this.retiring.filter((item) => item !== graph)
        this.timers = this.timers.filter((id) => id !== timer)
      },
      // A little past the end of the fade, so nothing is cut off.
      (fadeSeconds + 0.25) * 1000,
    )
    this.timers.push(timer)
  }
}
