import { describe, expect, it } from 'vitest'
import { findAmbientPreset } from './ambient'
import { buildBusGraph } from './audioBus'
import { rampParam } from './audioParams'
import {
  createBrainwaveGraph,
  getTargetHz,
  type BrainwaveGraph,
} from './brainwaveAudio'
import {
  envelopeOf,
  peakOf,
  render,
  renderTimeline,
  rmsOf,
} from './testing/audioHarness'

/**
 * The largest jump between two neighbouring samples.
 *
 * This is what a click *is*. A 200 Hz tone at amplitude `a` rises by at most
 * `a · 2π · 200 / sampleRate` per sample, so a transition that steps the
 * waveform rather than ramping it shows up here immediately.
 */
function maxStep(samples: Float32Array, from = 0, to = samples.length): number {
  let largest = 0
  for (let i = Math.max(1, from); i < Math.min(to, samples.length); i += 1) {
    const step = Math.abs(samples[i] - samples[i - 1])
    if (step > largest) largest = step
  }
  return largest
}

/**
 * The largest jump in a signal's smoothed envelope, over windows of `seconds`.
 *
 * Noise has big sample-to-sample steps by nature, so `maxStep` says nothing
 * about an ambience. Its envelope does: a click or a cut appears as a step there,
 * where a scheduled ramp cannot.
 */
function maxEnvelopeStep(
  samples: Float32Array,
  sampleRate: number,
  seconds: number,
): number {
  const envelope = envelopeOf(samples, sampleRate, 8)
  const window = Math.max(1, Math.floor(seconds * sampleRate))
  let largest = 0
  for (let i = window; i < envelope.length; i += window) {
    largest = Math.max(largest, Math.abs(envelope[i] - envelope[i - window]))
  }
  return largest
}

const SR = 44_100
const at = (seconds: number) => Math.floor(seconds * SR)

describe('the rhythm never clicks', () => {
  /**
   * One render covering every transition a session puts a rhythm through:
   * arriving, being turned down and up, having its intensity changed, and
   * leaving. Each step runs at the context's own `currentTime`, so this drives
   * the same code path the player does.
   */
  it('arrives, changes level and intensity, and leaves without a step', async () => {
    let graph: BrainwaveGraph | null = null

    const { channels } = await renderTimeline(
      14,
      (ctx) => {
        graph = createBrainwaveGraph(ctx, {
          targetHz: 10,
          mode: 'amplitude-modulation',
          depth: 1,
        })
        graph.out.connect(ctx.destination)
        graph.setLevel(1)
      },
      [
        { at: 4, act: () => graph!.setLevel(0.2, 0.25) },
        { at: 6, act: () => graph!.setLevel(0.9, 0.25) },
        { at: 8, act: () => graph!.setDepth(0.2, 0.3) },
        { at: 10, act: () => graph!.setDepth(1, 0.3) },
        { at: 12, act: () => graph!.fadeOut(1.8) },
      ],
      1,
      SR,
    )

    const samples = channels[0]
    // The reference: the tone running undisturbed, after the arrival fade.
    const steady = maxStep(samples, at(2.5), at(3.8))
    expect(steady).toBeGreaterThan(0)
    expect(maxStep(samples)).toBeLessThan(steady * 1.2)
    // And it really did leave.
    expect(peakOf(samples.subarray(at(13.9)))).toBeLessThan(0.002)
  })

  it('crossfades between two presets without a step or a gap', async () => {
    let outgoing: BrainwaveGraph | null = null
    let incoming: BrainwaveGraph | null = null

    const { channels } = await renderTimeline(
      10,
      (ctx) => {
        outgoing = createBrainwaveGraph(ctx, {
          targetHz: 10,
          mode: 'amplitude-modulation',
          depth: 1,
        })
        outgoing.out.connect(ctx.destination)
        outgoing.setLevel(0.8, 0)

        incoming = createBrainwaveGraph(ctx, {
          targetHz: 6,
          mode: 'amplitude-modulation',
          depth: 1,
        })
        incoming.out.connect(ctx.destination)
        incoming.setLevel(0, 0)
      },
      [
        // Exactly what changing preset does: one leaves as the other arrives.
        {
          at: 4,
          act: () => {
            outgoing!.fadeOut(1.8)
            incoming!.setLevel(0.8, 1.8)
          },
        },
      ],
      1,
      SR,
    )

    const samples = channels[0]
    const before = maxStep(samples, at(1), at(3.5))
    expect(maxStep(samples)).toBeLessThan(before * 1.6)

    // The rhythm stays present right through the handover rather than dipping
    // out between the two presets.
    const during = rmsOf(samples.subarray(at(4.6), at(5.4)))
    const after = rmsOf(samples.subarray(at(7), at(9)))
    expect(during).toBeGreaterThan(after * 0.4)
  })

  it('holds the level a fade had reached when it is interrupted', async () => {
    let graph: BrainwaveGraph | null = null

    const { channels } = await renderTimeline(
      9,
      (ctx) => {
        graph = createBrainwaveGraph(ctx, {
          targetHz: 10,
          mode: 'amplitude-modulation',
          depth: 1,
        })
        graph.out.connect(ctx.destination)
        graph.setLevel(1, 0)
      },
      [
        // A long fade out…
        { at: 2, act: () => graph!.fadeOut(4) },
        // …changed our mind about half way down. This is the case a naive
        // cancel steps back to a stale value.
        { at: 4, act: () => graph!.setLevel(1, 1) },
        { at: 7, act: () => graph!.fadeOut(1.5) },
      ],
      1,
      SR,
    )

    const samples = channels[0]
    const steady = maxStep(samples, at(0.5), at(1.8))
    expect(maxStep(samples)).toBeLessThan(steady * 1.2)

    // Half way through a 4 s fade from full, so around half level — not back at
    // full, and not snapped to silence.
    const interrupted = peakOf(samples.subarray(at(3.8), at(4.0)))
    const full = peakOf(samples.subarray(at(0.5), at(1.5)))
    expect(interrupted).toBeGreaterThan(full * 0.25)
    expect(interrupted).toBeLessThan(full * 0.75)

    expect(peakOf(samples.subarray(at(8.7)))).toBeLessThan(0.002)
  })

  it('opens and closes a binaural pair on both channels together', async () => {
    let graph: BrainwaveGraph | null = null

    const { channels } = await renderTimeline(
      8,
      (ctx) => {
        graph = createBrainwaveGraph(ctx, {
          targetHz: getTargetHz('theta'),
          mode: 'binaural',
          depth: 1,
        })
        graph.out.connect(ctx.destination)
        graph.setLevel(0.8)
      },
      [{ at: 6, act: () => graph!.fadeOut(1.8) }],
      2,
      SR,
    )

    for (const channel of channels) {
      const steady = maxStep(channel, at(2.5), at(4))
      expect(maxStep(channel)).toBeLessThan(steady * 1.2)
      expect(peakOf(channel.subarray(at(7.9)))).toBeLessThan(0.002)
    }
  })

  it('resumes at the phase it was paused at', async () => {
    /*
     * Pausing a session suspends the whole context, which stops `currentTime`
     * advancing. Because the rhythm is an oscillator driven by context time and
     * nothing restarts it, the phase on resume is exactly where it was — so the
     * rendered signal either side of a suspension is one continuous wave.
     *
     * Rendering with a suspension in the middle and finding no discontinuity at
     * the seam is that property, measured.
     */
    let graph: BrainwaveGraph | null = null

    const { channels } = await renderTimeline(
      6,
      (ctx) => {
        graph = createBrainwaveGraph(ctx, {
          targetHz: 10,
          mode: 'amplitude-modulation',
          depth: 1,
        })
        graph.out.connect(ctx.destination)
        graph.setLevel(1, 0)
      },
      // A suspension that changes nothing: the graph is untouched while paused,
      // which is exactly what `pause()` and `resume()` do to it.
      [{ at: 3, act: () => undefined }],
      1,
      SR,
    )

    const samples = channels[0]
    const steady = maxStep(samples, at(0.5), at(2.5))
    expect(maxStep(samples, at(2.9), at(3.2))).toBeLessThanOrEqual(steady * 1.05)
  })
})

describe('ambience never clicks', () => {
  it('fades in smoothly rather than switching on', async () => {
    for (const id of ['rain-window', 'ocean-tide', 'fireplace-glow'] as const) {
      const { channels, sampleRate } = await render(
        4,
        (ctx) => {
          findAmbientPreset(id)!.build(ctx, ctx.destination, { seed: 17 })
        },
        1,
        22_050,
      )

      const envelope = envelopeOf(channels[0], sampleRate, 8)
      expect(envelope[0], id).toBeLessThan(0.002)
      // Over a 1.5 s fade, no 20 ms slice can account for much of the climb.
      expect(maxEnvelopeStep(channels[0], sampleRate, 0.02), id).toBeLessThan(
        peakOf(envelope) * 0.15,
      )
    }
  })

  it('fades out from wherever it had reached, part-way through arriving', async () => {
    // Previewing a sound and changing your mind after half a second: the fade-in
    // is still climbing when the fade-out starts.
    let handle: { stop: (seconds?: number) => void } | null = null

    const { channels, sampleRate } = await renderTimeline(
      5,
      (ctx) => {
        handle = findAmbientPreset('ocean-tide')!.build(ctx, ctx.destination, {
          seed: 12,
        })
      },
      [{ at: 0.6, act: () => handle!.stop(1.5) }],
      1,
      22_050,
    )

    expect(maxEnvelopeStep(channels[0], sampleRate, 0.02)).toBeLessThan(
      peakOf(envelopeOf(channels[0], sampleRate, 8)) * 0.2,
    )
    // Gone by the end of its fade.
    expect(peakOf(channels[0].subarray(Math.floor(sampleRate * 2.6)))).toBeLessThan(
      0.002,
    )
  })

  it('crossfades one soundscape into another at a steady level', async () => {
    let outgoing: { stop: (seconds?: number) => void } | null = null

    const { channels, sampleRate } = await renderTimeline(
      8,
      (ctx) => {
        const graph = buildBusGraph(ctx, ctx.destination, 0.5)
        outgoing = findAmbientPreset('rain-window')!.build(ctx, graph.music, {
          offlineSeconds: 8,
          seed: 4,
        })
        // Both are wired up front; the handover happens on the timeline.
        const incoming = findAmbientPreset('ocean-tide')!.build(ctx, graph.music, {
          seed: 5,
        })
        void incoming
        expect(graph.generated.gain.value).toBeCloseTo(0.5)
      },
      [{ at: 3, act: () => outgoing!.stop(1.5) }],
      1,
      22_050,
    )

    // Never silent during the handover, and never louder than either sound
    // alone — the volume node was untouched throughout.
    const middle = rmsOf(
      channels[0].subarray(
        Math.floor(sampleRate * 3),
        Math.floor(sampleRate * 4.5),
      ),
    )
    const after = rmsOf(channels[0].subarray(Math.floor(sampleRate * 6)))
    expect(middle).toBeGreaterThan(after * 0.5)
    expect(peakOf(channels[0])).toBeLessThan(0.5)
    expect(maxEnvelopeStep(channels[0], sampleRate, 0.02)).toBeLessThan(
      peakOf(envelopeOf(channels[0], sampleRate, 8)) * 0.25,
    )
  })

  it('changes the master volume on a ramp, not a step', async () => {
    let gain: AudioParam | null = null

    const { channels, sampleRate } = await renderTimeline(
      6,
      (ctx) => {
        const graph = buildBusGraph(ctx, ctx.destination, 0.2)
        findAmbientPreset('fireplace-glow')!.build(ctx, graph.music, {
          offlineSeconds: 6,
          seed: 6,
        })
        gain = graph.generated.gain
      },
      // The same scheduling `AudioBus.setMusicVolume` performs.
      [{ at: 3, act: () => rampParam(gain!, 1, 0.12, 3) }],
      1,
      22_050,
    )

    const quiet = rmsOf(
      channels[0].subarray(
        Math.floor(sampleRate * 1),
        Math.floor(sampleRate * 2.5),
      ),
    )
    const loud = rmsOf(channels[0].subarray(Math.floor(sampleRate * 4)))
    expect(loud).toBeGreaterThan(quiet * 3)

    // A 2 ms window cannot contain a jump, because the ramp is far longer.
    expect(maxEnvelopeStep(channels[0], sampleRate, 0.002)).toBeLessThan(
      peakOf(envelopeOf(channels[0], sampleRate, 8)) * 0.1,
    )
  })
})

describe('rampParam', () => {
  it('keeps the value a ramp had reached, rather than resetting it', async () => {
    let gain: GainNode | null = null

    const { channels } = await renderTimeline(
      4,
      (ctx) => {
        const source = ctx.createConstantSource()
        source.offset.value = 1
        gain = ctx.createGain()
        gain.gain.value = 0
        // Climb to 1 over two seconds…
        gain.gain.setValueAtTime(0, 0)
        gain.gain.linearRampToValueAtTime(1, 2)
        source.connect(gain)
        gain.connect(ctx.destination)
        source.start()
      },
      // …then interrupt at one second, where the ramp has reached 0.5, and hold.
      [{ at: 1, act: () => rampParam(gain!.gain, 0.5, 0, 1) }],
      1,
      SR,
    )

    const samples = channels[0]
    expect(samples[at(0.9)]).toBeCloseTo(0.45, 1)
    // Held where the ramp had got to, not snapped anywhere else.
    expect(samples[at(1.5)]).toBeCloseTo(0.5, 1)
    expect(samples[at(3.5)]).toBeCloseTo(0.5, 1)
    expect(maxStep(samples)).toBeLessThan(0.01)
  })
})
