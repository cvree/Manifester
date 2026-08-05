/**
 * Test-only helpers for rendering and measuring generated audio.
 *
 * `node-web-audio-api` is a real Web Audio implementation, so these renders
 * exercise the same graph the browser will build — including the audio-rate
 * `AudioParam` connections that carry the brainwave rate. Nothing in the shipped
 * app imports this file.
 */

import { OfflineAudioContext } from 'node-web-audio-api'

/** Low enough to render 30 seconds instantly; high enough for a 200 Hz tone. */
export const TEST_SAMPLE_RATE = 16_000

export interface RenderedAudio {
  channels: Float32Array[]
  sampleRate: number
  duration: number
}

/**
 * Render a graph offline. The callback receives a context typed as the DOM
 * `BaseAudioContext`, which is what the production code takes — the two are
 * structurally the same graph API.
 */
export async function render(
  seconds: number,
  build: (ctx: BaseAudioContext) => void,
  channelCount = 1,
  sampleRate = TEST_SAMPLE_RATE,
): Promise<RenderedAudio> {
  const ctx = new OfflineAudioContext(
    channelCount,
    Math.ceil(seconds * sampleRate),
    sampleRate,
  )
  build(ctx as unknown as BaseAudioContext)
  const buffer = await ctx.startRendering()

  const channels: Float32Array[] = []
  for (let i = 0; i < buffer.numberOfChannels; i += 1) {
    channels.push(Float32Array.from(buffer.getChannelData(i)))
  }
  return { channels, sampleRate, duration: buffer.length / sampleRate }
}

export interface TimelineStep {
  /** Seconds into the render at which to run `act`. */
  at: number
  act: () => void
}

/**
 * Render a graph while interrupting it partway through.
 *
 * `OfflineAudioContext.suspend(t)` runs the render up to `t` and hands control
 * back, so a step's `act` sees `ctx.currentTime === t` and can call the
 * production API exactly as a live session would — no test-only time argument
 * required. That matters here because scheduling automation at a *future* time
 * is not portable: `node-web-audio-api` will not insert a hold event ahead of
 * time, so a fade started that way interpolates from the wrong place.
 */
export async function renderTimeline(
  seconds: number,
  build: (ctx: BaseAudioContext) => void,
  steps: TimelineStep[],
  channelCount = 1,
  sampleRate = TEST_SAMPLE_RATE,
): Promise<RenderedAudio> {
  const ctx = new OfflineAudioContext(
    channelCount,
    Math.ceil(seconds * sampleRate),
    sampleRate,
  )
  build(ctx as unknown as BaseAudioContext)

  for (const step of [...steps].sort((a, b) => a.at - b.at)) {
    void ctx.suspend(step.at).then(() => {
      step.act()
      void ctx.resume()
    })
  }

  const buffer = await ctx.startRendering()
  const channels: Float32Array[] = []
  for (let i = 0; i < buffer.numberOfChannels; i += 1) {
    channels.push(Float32Array.from(buffer.getChannelData(i)))
  }
  return { channels, sampleRate, duration: buffer.length / sampleRate }
}

/** A steady 1.0, for measuring a modulation envelope on its own. */
export function constantOne(ctx: BaseAudioContext): AudioScheduledSourceNode {
  const source = ctx.createConstantSource()
  source.offset.value = 1
  source.start()
  return source
}

/**
 * The rate of a periodic signal, from the time between its first and last
 * upward crossings of its own mean.
 *
 * Measuring across the whole render rather than averaging per-cycle intervals is
 * what makes this precise enough to catch a rate that is off by a few
 * hundredths of a hertz.
 */
export function measureRateHz(
  samples: Float32Array,
  sampleRate: number,
  /** Ignore the first stretch, where a fade or ramp is still settling. */
  skipSeconds = 0,
): number {
  const from = Math.floor(skipSeconds * sampleRate)
  const slice = samples.subarray(from)

  let sum = 0
  for (let i = 0; i < slice.length; i += 1) sum += slice[i]
  const mean = sum / slice.length

  let first = -1
  let last = -1
  let crossings = 0

  for (let i = 1; i < slice.length; i += 1) {
    const previous = slice[i - 1] - mean
    const current = slice[i] - mean
    if (previous <= 0 && current > 0) {
      // Interpolate the exact crossing point, so precision does not depend on
      // the sample rate.
      const position = i - 1 + previous / (previous - current)
      if (first < 0) first = position
      last = position
      crossings += 1
    }
  }

  if (crossings < 2) return 0
  return ((crossings - 1) * sampleRate) / (last - first)
}

/**
 * A smoothed amplitude envelope: rectify, then low-pass.
 *
 * Rectifying a 200 Hz carrier leaves a strong 400 Hz ripple, and a single pole
 * does not remove enough of it — the leftover wobble adds spurious crossings
 * right where the envelope crosses its own mean, which is exactly where the
 * rate is measured. Cascading three poles at the modulation rate itself pushes
 * that ripple three orders of magnitude down. It attenuates the envelope and
 * delays it too, neither of which changes the rate.
 */
export function envelopeOf(
  samples: Float32Array,
  sampleRate: number,
  cutoffHz: number,
  poles = 3,
): Float32Array {
  const alpha = Math.min(1, (2 * Math.PI * cutoffHz) / sampleRate)
  let current = Float32Array.from(samples, Math.abs)

  for (let pole = 0; pole < poles; pole += 1) {
    const out = new Float32Array(current.length)
    let state = 0
    for (let i = 0; i < current.length; i += 1) {
      state += alpha * (current[i] - state)
      out[i] = state
    }
    current = out
  }

  return current
}

export function peakOf(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.abs(samples[i])
    if (value > peak) peak = value
  }
  return peak
}

export function rmsOf(samples: Float32Array, from = 0): number {
  let sum = 0
  let count = 0
  for (let i = from; i < samples.length; i += 1) {
    sum += samples[i] * samples[i]
    count += 1
  }
  return count === 0 ? 0 : Math.sqrt(sum / count)
}
