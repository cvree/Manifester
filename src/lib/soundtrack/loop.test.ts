import { describe, expect, it } from 'vitest'
import { LoopVoice, SEAM_SECONDS, loopRegion } from './loop'
import { peakOf, render, renderTimeline, rmsOf } from '../testing/audioHarness'

const RATE = 16_000

/**
 * A stationary bed, which is what these pieces are and what makes the seam
 * measurable.
 *
 * Noise rather than a tone, and the reason is the physics the crossfade rests
 * on. Equal power holds when the two sides of a join are *uncorrelated* —
 * which two moments of a piece of ambient music are, and which two moments of
 * a sine wave emphatically are not: crossfading a tone with a phase-shifted
 * copy of itself is a comb filter, and it would fail this test for a reason
 * that has nothing to do with the code.
 *
 * Lightly smoothed so it has a slew rate a click can be measured against, and
 * seeded so a failure is reproducible.
 */
function bed(ctx: BaseAudioContext, seconds: number, leadInSeconds = 0): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.round(seconds * rate)
  const buffer = ctx.createBuffer(1, length, rate)
  const data = buffer.getChannelData(0)

  let seed = 12345
  let state = 0
  const lead = Math.round(leadInSeconds * rate)
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const white = (seed / 0xffffffff) * 2 - 1
    state += 0.08 * (white - state)
    data[i] = i < lead ? 0 : state * 4
  }
  return buffer
}

/** RMS in short windows, which is what "does the level hold?" means. */
function windows(samples: Float32Array, rate: number, seconds: number): number[] {
  const size = Math.round(seconds * rate)
  const out: number[] = []
  for (let start = 0; start + size <= samples.length; start += size) {
    out.push(rmsOf(samples.subarray(start, start + size)))
  }
  return out
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

/** The largest jump between neighbouring samples: what a click is. */
function maxStep(samples: Float32Array, from = 0): number {
  let largest = 0
  for (let i = Math.max(1, from); i < samples.length; i += 1) {
    const step = Math.abs(samples[i] - samples[i - 1])
    if (step > largest) largest = step
  }
  return largest
}

describe('finding the repeating region', () => {
  it('trims the silence a decoder leaves in front of the music', async () => {
    await render(0.1, (ctx) => {
      const buffer = bed(ctx, 8, 0.05)
      const region = loopRegion(buffer, 6)

      // The 50 ms of padding is gone, and the region is measured from what is
      // left rather than from the head of the file.
      expect(region.offsetSeconds).toBeGreaterThan(0.04)
      expect(region.offsetSeconds).toBeLessThan(0.07)
      expect(region.lengthSeconds).toBeCloseTo(6, 3)
      expect(region.seamSeconds).toBeCloseTo(SEAM_SECONDS, 6)
      // One time round is the region less the overlap, or the piece would grow
      // by the length of the seam on every repetition.
      expect(region.periodSeconds).toBeCloseTo(6 - SEAM_SECONDS, 6)
    })
  })

  /**
   * A performance rule with an audible failure, which is why it is a test.
   *
   * `getChannelData` reads like a property and behaves like a copy: on Chrome
   * it costs time proportional to the whole buffer. Calling it once per sample
   * while scanning for the lead-in froze the main thread for twenty-six
   * seconds on the three-minute piece — the app locked up between pressing
   * play and the music arriving. Nothing about the *result* changed when it
   * was hoisted, so only the call count can catch it coming back.
   */
  it('reads each channel once, however long the scan', async () => {
    await render(0.1, (ctx) => {
      const real = bed(ctx, 8, 0.9)
      let reads = 0
      const counted = {
        sampleRate: real.sampleRate,
        length: real.length,
        duration: real.duration,
        numberOfChannels: real.numberOfChannels,
        getChannelData(channel: number) {
          reads += 1
          return real.getChannelData(channel)
        },
      } as unknown as AudioBuffer

      loopRegion(counted, 6)
      // Nearly a second of silence to scan through, and one read per channel.
      expect(reads).toBe(real.numberOfChannels)
    })
  })

  it('never asks for more of a buffer than it has', async () => {
    await render(0.1, (ctx) => {
      const region = loopRegion(bed(ctx, 3), 60)
      expect(region.lengthSeconds).toBeCloseTo(3, 2)
      // And a seam can never be more than a third of what it joins.
      expect(region.seamSeconds).toBeLessThanOrEqual(1 + 1e-6)
    })
  })
})

describe('looping a piece', () => {
  /**
   * The headline promise: several repetitions in a row with nothing at any of
   * the joins.
   *
   * Measured against the material rather than against a number somebody liked.
   * The bed is rendered once straight through to find how much its own level
   * wanders in a short window — filtered noise wanders a fair amount — and the
   * looped render then has to stay inside that. A gap at a seam would drop
   * below the quietest the music ever is; a doubled overlap would rise above
   * the loudest. Neither is allowed a single window anywhere in seven
   * repetitions.
   */
  it('holds a steady level across repetition after repetition', async () => {
    const straight = await render(
      3.9,
      (ctx) => {
        const source = ctx.createBufferSource()
        source.buffer = bed(ctx, 4, 0.05)
        source.connect(ctx.destination)
        source.start(0)
      },
      1,
      RATE,
    )
    const natural = windows(straight.channels[0], straight.sampleRate, 0.05).slice(1, -1)
    const naturalQuietest = Math.min(...natural)
    const naturalLoudest = Math.max(...natural)
    let period = 0

    let voice: LoopVoice | null = null
    const { channels, sampleRate } = await renderTimeline(
      14,
      (ctx) => {
        voice = new LoopVoice(ctx, bed(ctx, 4, 0.05), 3)
        period = voice.periodSeconds
        voice.output.gain.value = 1
        voice.output.connect(ctx.destination)
        voice.start(0)
      },
      // The heartbeat, as the manager delivers it. Half a second apart is what
      // `heartbeat.ts` promises a visible page, and twice that when hidden —
      // both are a long way inside the four-second horizon.
      Array.from({ length: 27 }, (_, i) => ({
        at: (i + 1) * 0.5,
        act: () => voice!.tick(),
      })),
      1,
      RATE,
    )

    const samples = channels[0]
    // Fourteen seconds against a two-second period is seven times round.
    const levels = windows(samples, sampleRate, 0.05).slice(1, -1)

    /*
     * No window quieter than the music ever is — which is what a gap at a seam
     * would look like, and the reason this is the tight bound of the three.
     */
    expect(Math.min(...levels)).toBeGreaterThan(naturalQuietest * 0.97)
    /*
     * And none louder than it ever is, give or take the arithmetic of adding
     * two streams. Across the overlap the output is two independent stretches
     * of the same bed summed under sine and cosine weights, and while their
     * *expected* power is exactly one stretch's, a single fiftieth of a second
     * can land a few percent either side of that by chance. Eight percent is
     * generous to the statistics and still nowhere near the failure it is
     * looking for: a repetition stacked on another without the crossfade
     * measures forty percent up, not eight.
     */
    expect(Math.max(...levels)).toBeLessThan(naturalLoudest * 1.08)
    // The energy over the whole render is the material's, to within a percent.
    expect(mean(levels)).toBeCloseTo(mean(natural), 2)

    /*
     * And once it is running, the whole thing is exactly periodic — which is
     * the same claim from the other side. Every window is indistinguishable
     * from the window one repetition earlier, seams included, so a seam is not
     * a moment the piece does not otherwise contain.
     *
     * From the third repetition on, because the first is genuinely different:
     * it opens at full level with nothing to cross into, which is arriving
     * rather than looping. Fading it in as well would be two fades on top of
     * each other, and the manager already owns the one that matters.
     */
    const perWindow = Math.round(period / 0.05)
    for (let i = 2 * perWindow; i < levels.length; i += 1) {
      expect(levels[i]).toBeCloseTo(levels[i - perWindow], 3)
    }

    // Nothing that could be heard as a click, either. A one-pole-smoothed bed
    // cannot step by more than a fraction of its own amplitude in a sample.
    expect(maxStep(samples)).toBeLessThan(peakOf(samples) * 0.35)
  })

  it('starts where it left off when a piece is picked back up', async () => {
    const marked = (ctx: BaseAudioContext) => {
      // A ramp rather than a bed, so position is readable from the level.
      const buffer = ctx.createBuffer(1, Math.round(4 * ctx.sampleRate), ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (i / data.length) * ((i % 2) * 2 - 1)
      }
      return buffer
    }

    let phase = 0
    await render(0.5, (ctx) => {
      const voice = new LoopVoice(ctx, marked(ctx), 3)
      voice.start(0, 1.4)
      phase = voice.phaseSeconds
    })

    // Read back before any time has passed: the phase it was handed.
    expect(phase).toBeCloseTo(1.4, 3)

    const { channels } = await render(
      0.4,
      (ctx) => {
        const voice = new LoopVoice(ctx, marked(ctx), 3)
        voice.output.gain.value = 1
        voice.output.connect(ctx.destination)
        voice.start(0, 1.4)
      },
      1,
      RATE,
    )

    // 1.4 s into a buffer whose amplitude rises linearly over 4 s is about
    // 35% of the way up, not at the beginning.
    expect(peakOf(channels[0].subarray(0, 100))).toBeGreaterThan(0.3)
    expect(peakOf(channels[0].subarray(0, 100))).toBeLessThan(0.42)
  })

  it('leaves nothing running once it is stopped', async () => {
    let voice: LoopVoice | null = null
    const { channels, sampleRate } = await render(
      6,
      (ctx) => {
        voice = new LoopVoice(ctx, bed(ctx, 4), 3)
        voice.output.gain.value = 1
        voice.output.connect(ctx.destination)
        voice.start(0)
        voice.stop(0.5)
      },
      1,
      RATE,
    )

    // Silent from half a second on, and still silent a repetition later —
    // which is the assertion that a scheduled-ahead repetition cannot outlive
    // the voice that scheduled it.
    expect(rmsOf(channels[0].subarray(Math.floor(sampleRate * 0.8)))).toBeLessThan(
      0.001,
    )
    voice!.dispose()
  })
})
