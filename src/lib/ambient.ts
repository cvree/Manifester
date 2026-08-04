/**
 * The two built-in ambiences.
 *
 * These are *generated*, not sampled — a handful of oscillators, filters and
 * shaped noise built live in the Web Audio graph. That keeps the download tiny,
 * makes them work offline forever, and means there is no third-party audio in
 * this repository at all.
 */

export interface AmbientHandle {
  stop: () => void
}

export interface AmbientPreset {
  id: string
  name: string
  description: string
  /** Wire the preset into `destination` and return a stop handle. */
  build: (ctx: AudioContext, destination: AudioNode) => AmbientHandle
}

/* ── Shared helpers ──────────────────────────────────────────── */

/** A few seconds of brown noise, looped — softer and warmer than white noise. */
function createNoiseBuffer(ctx: AudioContext, seconds = 6): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  let last = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }

  // Cross-fade the seam so the loop point is inaudible.
  const fade = Math.floor(ctx.sampleRate * 0.25)
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade
    data[i] = data[i] * t + data[length - fade + i] * (1 - t)
  }

  return buffer
}

function createLfo(
  ctx: AudioContext,
  frequency: number,
  depth: number,
  target: AudioParam,
): { osc: OscillatorNode; gain: GainNode } {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = frequency
  const gain = ctx.createGain()
  gain.gain.value = depth
  osc.connect(gain).connect(target)
  osc.start()
  return { osc, gain }
}

function makeStopper(
  nodes: Array<AudioScheduledSourceNode>,
  timers: number[],
  fadeGain: GainNode,
  ctx: AudioContext,
): AmbientHandle {
  let stopped = false
  return {
    stop() {
      if (stopped) return
      stopped = true
      timers.forEach((id) => clearTimeout(id))
      const now = ctx.currentTime
      fadeGain.gain.cancelScheduledValues(now)
      fadeGain.gain.setValueAtTime(Math.max(0.0001, fadeGain.gain.value), now)
      fadeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
      window.setTimeout(() => {
        nodes.forEach((node) => {
          try {
            node.stop()
          } catch {
            /* already stopped */
          }
          try {
            node.disconnect()
          } catch {
            /* already disconnected */
          }
        })
        try {
          fadeGain.disconnect()
        } catch {
          /* already disconnected */
        }
      }, 800)
    },
  }
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
  build(ctx, destination) {
    const nodes: AudioScheduledSourceNode[] = []
    const timers: number[] = []

    const out = ctx.createGain()
    out.gain.value = 0.0001
    out.connect(destination)
    out.gain.setTargetAtTime(1, ctx.currentTime, 2)

    // Pad: three detuned voices through a slowly opening filter.
    const padFilter = ctx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 620
    padFilter.Q.value = 0.6
    padFilter.connect(out)

    const padGain = ctx.createGain()
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
      const voice = ctx.createGain()
      voice.gain.value = 0.25
      osc.connect(voice).connect(padGain)
      osc.start()
      nodes.push(osc)
    }

    nodes.push(createLfo(ctx, 0.035, 260, padFilter.frequency).osc)
    nodes.push(createLfo(ctx, 0.017, 0.05, padGain.gain).osc)

    // Air: barely-there filtered noise so the pad is not sterile.
    const air = ctx.createBufferSource()
    air.buffer = createNoiseBuffer(ctx)
    air.loop = true
    const airFilter = ctx.createBiquadFilter()
    airFilter.type = 'lowpass'
    airFilter.frequency.value = 900
    const airGain = ctx.createGain()
    airGain.gain.value = 0.05
    air.connect(airFilter).connect(airGain).connect(out)
    air.start()
    nodes.push(air)

    // Chimes: a pentatonic scale, struck at unpredictable intervals.
    const scale = [523.25, 587.33, 698.46, 783.99, 880, 1046.5]
    const strike = () => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = scale[Math.floor(Math.random() * scale.length)]

      const bell = ctx.createGain()
      const now = ctx.currentTime
      bell.gain.setValueAtTime(0.0001, now)
      bell.gain.exponentialRampToValueAtTime(0.07, now + 0.04)
      bell.gain.exponentialRampToValueAtTime(0.0001, now + 4.5)

      osc.connect(bell).connect(out)
      osc.start(now)
      osc.stop(now + 4.8)

      timers.push(
        window.setTimeout(strike, 6000 + Math.random() * 9000),
      )
    }
    timers.push(window.setTimeout(strike, 2500))

    return makeStopper(nodes, timers, out, ctx)
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
  build(ctx, destination) {
    const nodes: AudioScheduledSourceNode[] = []
    const timers: number[] = []

    const out = ctx.createGain()
    out.gain.value = 0.0001
    out.connect(destination)
    out.gain.setTargetAtTime(1, ctx.currentTime, 2.5)

    // Swell: brown noise through a filter that breathes open and closed.
    const swell = ctx.createBufferSource()
    swell.buffer = createNoiseBuffer(ctx, 8)
    swell.loop = true

    const swellFilter = ctx.createBiquadFilter()
    swellFilter.type = 'lowpass'
    swellFilter.frequency.value = 480
    swellFilter.Q.value = 1.1

    const swellGain = ctx.createGain()
    swellGain.gain.value = 0.16

    swell.connect(swellFilter).connect(swellGain).connect(out)
    swell.start()
    nodes.push(swell)

    nodes.push(createLfo(ctx, 0.055, 300, swellFilter.frequency).osc)
    nodes.push(createLfo(ctx, 0.038, 0.075, swellGain.gain).osc)

    // Drone: an octave-and-a-fifth of very low warmth.
    const droneFilter = ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 320
    droneFilter.connect(out)

    const droneGain = ctx.createGain()
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
      const voice = ctx.createGain()
      voice.gain.value = type === 'triangle' ? 0.16 : 0.3
      osc.connect(voice).connect(droneGain)
      osc.start()
      nodes.push(osc)
    }

    nodes.push(createLfo(ctx, 0.021, 0.06, droneGain.gain).osc)

    return makeStopper(nodes, timers, out, ctx)
  },
}

export const AMBIENT_PRESETS: AmbientPreset[] = [moonGarden, softHorizon]

export function findAmbientPreset(id: string): AmbientPreset | undefined {
  return AMBIENT_PRESETS.find((preset) => preset.id === id)
}
