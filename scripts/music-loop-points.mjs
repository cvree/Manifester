/**
 * Measure where each soundtrack piece can be looped without a seam.
 *
 * Every track in `public/music` is a mastered MP3, and two things about that
 * have to be measured rather than guessed before it can repeat indefinitely:
 *
 *  1. **Encoder padding.** MP3 is a framed format, so a decoder hands back a
 *     few tens of milliseconds of digital silence before the first sample the
 *     composer wrote. Looping the buffer as decoded puts that silence in the
 *     middle of the piece, once per repetition, which is the gap people mean
 *     when they say an MP3 loop "clicks".
 *  2. **A composed ending.** All five pieces spend their last few seconds
 *     winding down and then fading to nothing. Playing that and cutting back
 *     to a full-level opening is the most obvious restart a loop can have, and
 *     no crossfade can hide it: by then the material is already gone.
 *
 * So the loop runs from the first real sample to a point chosen *before* the
 * ending, and the player overlaps that boundary with a short equal-power
 * crossfade — see `soundtrack/loop.ts`. The point is chosen by level rather
 * than by where the fade nominally starts, because what makes a seam audible
 * on slow ambient material is not a click but a step in loudness: the search
 * below takes the latest moment whose final `OVERLAP` seconds are the same
 * loudness as the opening's first `OVERLAP` seconds, within eight seconds of
 * the ending. That costs a few percent of each piece's decrescendo and buys a
 * seam that measures flat.
 *
 *     node scripts/music-loop-points.mjs
 *
 * Prints the table `src/lib/soundtrack/tracks.ts` carries, so adding a sixth
 * piece is a run of this rather than an ear and a guess. The leading silence
 * is re-measured at runtime instead of being taken from here, because decoders
 * disagree about it by a frame or so; the loop length is measured from the
 * first real sample, where they agree.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OfflineAudioContext } from 'node-web-audio-api'

/** Anything below this is silence rather than a very quiet note. */
const SILENCE = 1e-4
/** The resolution the envelope is measured at. */
const WINDOW_SECONDS = 0.05
/**
 * How far below the piece's own typical level counts as "the ending has begun".
 *
 * −4 dB rather than something deeper: these are slow pieces whose quietest
 * musical passages sit within a couple of decibels of their loudest, so a
 * threshold much lower than this stops telling the composed ending apart from
 * the composition.
 */
const FADE_RATIO = 0.63
/** How far back from the ending a better-matched loop point may be found. */
const SEARCH_SECONDS = 8
/** Must match `SEAM_SECONDS` in `soundtrack/loop.ts`. */
const OVERLAP = 1.2

const dir = fileURLToPath(new URL('../public/music', import.meta.url))
const db = (value) => (value <= 0 ? -Infinity : 20 * Math.log10(value))

async function decode(file) {
  const bytes = readFileSync(file)
  const ctx = new OfflineAudioContext(2, 1024, 44100)
  return ctx.decodeAudioData(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
}

function measure(buffer) {
  const rate = buffer.sampleRate
  const length = buffer.length
  const channels = []
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    channels.push(buffer.getChannelData(c))
  }
  const peakAt = (i) => {
    let peak = 0
    for (const channel of channels) peak = Math.max(peak, Math.abs(channel[i]))
    return peak
  }
  const rmsOver = (from, to) => {
    let sum = 0
    let count = 0
    for (let i = Math.max(0, from); i < Math.min(to, length); i += 1) {
      const value = peakAt(i)
      sum += value * value
      count += 1
    }
    return count === 0 ? 0 : Math.sqrt(sum / count)
  }

  let first = 0
  while (first < length && peakAt(first) < SILENCE) first += 1

  const window = Math.round(rate * WINDOW_SECONDS)
  const bins = Math.floor(length / window)
  const envelope = new Float64Array(bins)
  for (let bin = 0; bin < bins; bin += 1) {
    let sum = 0
    for (let i = bin * window; i < (bin + 1) * window; i += 1) {
      const value = peakAt(i)
      sum += value * value
    }
    envelope[bin] = Math.sqrt(sum / window)
  }
  const median = Float64Array.from(envelope).sort()[Math.floor(bins / 2)]

  let bin = bins - 1
  while (bin > 0 && envelope[bin] < median * FADE_RATIO) bin -= 1
  const endingAt = (bin + 1) * window

  const head = rmsOver(first, first + rate * OVERLAP)
  const step = Math.round(rate * WINDOW_SECONDS)
  let best = null
  for (
    let end = endingAt - Math.round(rate * SEARCH_SECONDS);
    end <= endingAt;
    end += step
  ) {
    if (end - first < rate * OVERLAP * 4) continue
    const match = db(head) - db(rmsOver(end - rate * OVERLAP, end))
    if (!best || Math.abs(match) < Math.abs(best.match)) best = { end, match }
  }

  return {
    seconds: length / rate,
    leadInMs: (first / rate) * 1000,
    loopSeconds: (best.end - first) / rate,
    keptPercent: ((best.end - first) / length) * 100,
    match: best.match,
  }
}

for (const name of readdirSync(dir).filter((n) => n.endsWith('.mp3')).sort()) {
  const m = measure(await decode(join(dir, name)))
  console.log(
    [
      name.padEnd(26),
      `file ${m.seconds.toFixed(2)}s`,
      `lead-in ${m.leadInMs.toFixed(0)}ms`,
      `loopSeconds: ${m.loopSeconds.toFixed(3)},`.padEnd(24),
      `keeps ${m.keptPercent.toFixed(0)}%`,
      `seam ${m.match >= 0 ? '+' : ''}${m.match.toFixed(2)} dB`,
    ].join('  '),
  )
}
