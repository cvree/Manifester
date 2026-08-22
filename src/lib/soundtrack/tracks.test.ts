import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { OfflineAudioContext } from 'node-web-audio-api'
import { LoopVoice, SEAM_SECONDS, loopRegion } from './loop'
import { SOUNDTRACK_TRACKS, findTrack, trackUrl } from './tracks'
import { rmsOf } from '../testing/audioHarness'

/**
 * Low enough that decoding three minutes of music is instant and the buffer is
 * a few megabytes rather than sixty; high enough that every envelope
 * measurement below means what it says. It is also what a real device does
 * anyway — a phone running its context at 48 kHz resamples these files on the
 * way out, and this only differs in the direction.
 */
const RATE = 16_000

function decode(file: string): Promise<AudioBuffer> {
  const path = fileURLToPath(new URL(`../../../public/music/${file}`, import.meta.url))
  const bytes = readFileSync(path)
  const ctx = new OfflineAudioContext(2, 1024, RATE)
  return ctx.decodeAudioData(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  ) as unknown as Promise<AudioBuffer>
}

/**
 * Render one seam.
 *
 * The voice is started a few seconds short of the end of a repetition, so the
 * join arrives at a known moment instead of a minute and a half later. That is
 * the same code path an hour of listening takes — `start` treats a phase like
 * any other — and it is what makes it possible to measure every piece's seam
 * in a test rather than by listening to five tracks twice round each.
 */
async function renderSeam(buffer: AudioBuffer, loopSeconds: number, lead = 3) {
  const region = loopRegion(buffer, loopSeconds)
  const seconds = lead + region.seamSeconds + lead
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE)

  const voice = new LoopVoice(ctx as unknown as BaseAudioContext, buffer, loopSeconds)
  voice.output.gain.value = 1
  voice.output.connect(ctx.destination as unknown as AudioNode)
  voice.start(0, region.periodSeconds - lead)

  const rendered = await ctx.startRendering()
  return {
    samples: Float32Array.from(rendered.getChannelData(0)),
    region,
    /** The seam runs from `lead` to `lead + seamSeconds`. */
    lead,
  }
}

const db = (value: number) => 20 * Math.log10(value)

describe('the soundtrack table', () => {
  it('has one entry per piece, each with a loop shorter than its file', () => {
    expect(SOUNDTRACK_TRACKS).toHaveLength(5)
    const ids = new Set(SOUNDTRACK_TRACKS.map((track) => track.id))
    expect(ids.size).toBe(SOUNDTRACK_TRACKS.length)

    for (const track of SOUNDTRACK_TRACKS) {
      expect(findTrack(track.id)).toBe(track)
      // The loop always stops before the composed ending, and never by so much
      // that the piece is being cut in half.
      expect(track.loopSeconds).toBeLessThan(track.fileSeconds)
      expect(track.loopSeconds).toBeGreaterThan(track.fileSeconds * 0.8)
      // Long enough that the seam is a small fraction of one time round.
      expect(track.loopSeconds).toBeGreaterThan(SEAM_SECONDS * 20)
    }
  })

  it('builds urls under the deployment base path', () => {
    expect(trackUrl(findTrack('the-glass-room'))).toMatch(/music\/the-glass-room\.mp3$/)
  })
})

/**
 * The claim this whole module exists to make, measured on the files that ship
 * rather than on a synthetic stand-in.
 *
 * Two separate things have to be true for a join to be inaudible, and they
 * belong to two different parts of this work, so they are asserted separately:
 *
 *  - **The loop point is level-matched.** The last second and a bit of the
 *    repeating region has to be as loud as the first, or the crossfade is a
 *    swell rather than a join. That is the table's claim, measured straight
 *    off the decoded file — `scripts/music-loop-points.mjs` chose each number
 *    to make it true, and this is what stops the table and the files drifting
 *    apart.
 *  - **The crossfade conserves power.** Two uncorrelated stretches summed
 *    under sine and cosine weights carry the root-mean-square of the two, and
 *    that is exactly what the rendered join has to measure. A linear crossfade
 *    would come in 3 dB under it; a missing fade would come in 3 dB over.
 *
 * Then the two ways a join fails outright: a gap, from padding or a loop point
 * past the end of the music, and a click, from splicing one waveform onto
 * another.
 */
describe.each(SOUNDTRACK_TRACKS)('$title loops without a seam', (track) => {
  it('is level-matched at the loop point', async () => {
    const buffer = await decode(track.file)
    const region = loopRegion(buffer, track.loopSeconds)
    const { offsetSeconds, lengthSeconds, seamSeconds } = region

    const head = bufferRms(buffer, offsetSeconds, offsetSeconds + seamSeconds)
    const tail = bufferRms(
      buffer,
      offsetSeconds + lengthSeconds - seamSeconds,
      offsetSeconds + lengthSeconds,
    )

    expect(Math.abs(db(head) - db(tail))).toBeLessThan(1.5)
  })

  /**
   * The join, rendered and then compared against the arithmetic that defines
   * it, sample window by sample window.
   *
   * The reference is built here from the same decoded file: the outgoing
   * stretch under a cosine, the incoming stretch under a sine, summed. If the
   * player reads the wrong part of the buffer, drops a repetition, stacks two
   * without fading, splices instead of overlapping, or lets a frame of padding
   * through, the rendered envelope stops matching. Envelopes rather than
   * samples, because a scheduler is entitled to round a start time to the
   * nearest sample and a one-sample shift is not a defect.
   */
  it('renders the join exactly as the crossfade specifies', async () => {
    const buffer = await decode(track.file)
    const { samples, region, lead } = await renderSeam(buffer, track.loopSeconds)
    const reference = expectedSeam(buffer, region, lead, samples.length)

    const size = Math.round(0.05 * RATE)
    for (let start = 0; start + size <= samples.length - size; start += size) {
      const rendered = rmsOf(samples.subarray(start, start + size))
      const wanted = rmsOf(reference.subarray(start, start + size))
      // Skip the handful of windows where the music itself is near silence and
      // a ratio stops being a meaningful measure of anything.
      if (wanted < 0.002) continue
      expect(Math.abs(db(rendered) - db(wanted))).toBeLessThan(1)
    }

    /*
     * And no click. Measured against the reference over the same stretch
     * rather than against the music before the join: three of these pieces
     * spend their last seconds getting quieter, so the incoming half of the
     * crossfade is legitimately more energetic than anything just before it,
     * and a click test anchored there would be measuring the composition. The
     * arithmetic contains whatever jumps the music contains and no others, so
     * exceeding it is the definition of a splice.
     */
    expect(maxStep(samples, lead, lead + region.seamSeconds)).toBeLessThanOrEqual(
      maxStep(reference, lead, lead + region.seamSeconds) * 1.25,
    )
  })
})

/**
 * What the render should contain: one repetition running out under a cosine
 * while the next comes in under a sine.
 */
function expectedSeam(
  buffer: AudioBuffer,
  region: ReturnType<typeof loopRegion>,
  lead: number,
  length: number,
): Float32Array {
  const rate = buffer.sampleRate
  const mono = downmix(buffer)

  const offset = Math.round(region.offsetSeconds * rate)
  const loop = Math.round(region.lengthSeconds * rate)
  const seam = Math.round(region.seamSeconds * rate)
  const phase = Math.round((region.periodSeconds - lead) * rate)
  /** Where the incoming repetition starts, in render samples. */
  const entry = loop - phase - seam

  const out = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    let value = 0

    const outgoing = phase + i
    if (outgoing < loop) {
      const intoFade = i - entry
      const gain =
        intoFade <= 0 ? 1 : Math.cos((Math.PI / 2) * Math.min(1, intoFade / seam))
      value += (mono[offset + outgoing] ?? 0) * gain
    }

    if (i >= entry) {
      const incoming = i - entry
      const gain = Math.sin((Math.PI / 2) * Math.min(1, incoming / seam))
      value += (mono[offset + incoming] ?? 0) * gain
    }

    out[i] = value
  }
  return out
}

/** A stereo file as the graph hears it on the way to a mono destination. */
function downmix(buffer: AudioBuffer): Float32Array {
  const channels = []
  for (let c = 0; c < buffer.numberOfChannels; c += 1) channels.push(buffer.getChannelData(c))
  const out = new Float32Array(buffer.length)
  for (let i = 0; i < buffer.length; i += 1) {
    let sum = 0
    for (const channel of channels) sum += channel[i]
    out[i] = sum / channels.length
  }
  return out
}

/**
 * The level of a stretch of a decoded file, downmixed the way the graph
 * downmixes it — a stereo source into a mono destination is the average of the
 * two channels, not either one of them.
 */
function bufferRms(buffer: AudioBuffer, fromSeconds: number, toSeconds: number): number {
  const rate = buffer.sampleRate
  const from = Math.max(0, Math.round(fromSeconds * rate))
  const to = Math.min(buffer.length, Math.round(toSeconds * rate))
  const channels = []
  for (let c = 0; c < buffer.numberOfChannels; c += 1) channels.push(buffer.getChannelData(c))

  let sum = 0
  for (let i = from; i < to; i += 1) {
    let mono = 0
    for (const channel of channels) mono += channel[i]
    mono /= channels.length
    sum += mono * mono
  }
  return Math.sqrt(sum / Math.max(1, to - from))
}

function maxStep(samples: Float32Array, fromSeconds: number, toSeconds: number): number {
  const from = Math.max(1, Math.round(fromSeconds * RATE))
  const to = Math.min(samples.length, Math.round(toSeconds * RATE))
  let largest = 0
  for (let i = from; i < to; i += 1) {
    const step = Math.abs(samples[i] - samples[i - 1])
    if (step > largest) largest = step
  }
  return largest
}
