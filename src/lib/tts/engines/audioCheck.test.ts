import { describe, expect, it } from 'vitest'
import { describeCheck, inspectSpeech } from './audioCheck'

/**
 * The check that decides whether a device gets a voice.
 *
 * Both directions matter and they matter differently. Letting noise through is
 * the bug this exists for — somebody downloads ninety megabytes, is told it
 * worked, and hears their own words come back as static. Rejecting real speech
 * is worse in one specific way: it takes a feature away from a device that
 * could have run it, after that same download, with no way for the person to
 * argue. So the fixtures below include several kinds of *legitimate* speech
 * near the edges of what is allowed, not only the failures.
 */

const RATE = 24_000

/**
 * Something with the statistics of a spoken line.
 *
 * A voiced carrier around 130 Hz — a low speaking pitch, which is the hardest
 * case for the zero-crossing bound — under a syllable-rate envelope that
 * returns to silence between the sounds, plus a little breath noise. What
 * matters is not that it is convincing to a listener but that its peak, RMS and
 * crossing rate land where a real line's do.
 */
function speechLike(seconds = 1.2, pitch = 130): Float32Array {
  const samples = new Float32Array(Math.round(seconds * RATE))
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / RATE
    // Syllables at roughly four a second, with real gaps between them.
    const envelope = Math.max(0, Math.sin(2 * Math.PI * 4 * t)) ** 2
    const voiced =
      Math.sin(2 * Math.PI * pitch * t) + 0.4 * Math.sin(2 * Math.PI * pitch * 2 * t)
    // Deterministic, so a failure is reproducible rather than a bad afternoon.
    const breath = (((index * 1103515245 + 12345) % 2048) / 2048 - 0.5) * 0.02
    samples[index] = envelope * voiced * 0.28 + breath * envelope
  }
  return samples
}

/** Full-scale white noise: what a broken graph hands back. */
function noise(seconds = 1): Float32Array {
  const samples = new Float32Array(Math.round(seconds * RATE))
  let seed = 7
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    samples[index] = (seed / 0x7fffffff) * 2 - 1
  }
  return samples
}

describe('inspecting the warm-up', () => {
  it('accepts a line that behaves like speech', () => {
    expect(inspectSpeech(speechLike(), RATE).ok).toBe(true)
  })

  it('accepts a quiet, low, slow voice as well as a loud one', () => {
    // Fen is low and unhurried, and a phone at half volume is quieter still.
    // Neither is a reason to refuse somebody the feature.
    const quiet = speechLike(1.5, 85).map((sample) => sample * 0.12)
    expect(inspectSpeech(quiet, RATE).ok).toBe(true)
  })

  it('rejects white noise, loud or quiet', () => {
    // Full scale is a wall of sound and is caught as one; the bound that names
    // it does not matter, only that it never reaches somebody's speakers.
    expect(inspectSpeech(noise(), RATE)).toMatchObject({
      ok: false,
      reason: 'a continuous roar',
    })

    /*
     * The harder half, and the more common one: corruption at a *plausible*
     * level. Nothing about its peak or its loudness is out of the ordinary —
     * only the fact that its sign changes on half of all samples, which no
     * voice does.
     */
    const hiss = noise().map((sample) => sample * 0.15)
    expect(inspectSpeech(hiss, RATE)).toMatchObject({
      ok: false,
      reason: 'noise rather than a voice',
    })
  })

  /**
   * The one that would otherwise pass everything.
   *
   * Every statistic computed from a buffer containing `NaN` is itself `NaN`,
   * and every `>` comparison against `NaN` is false — so a completely dead clip
   * satisfies each bound below it. It has to be caught by asking rather than by
   * measuring.
   */
  it('rejects samples that are not numbers', () => {
    const broken = speechLike()
    broken[5000] = Number.NaN
    expect(inspectSpeech(broken, RATE)).toMatchObject({
      ok: false,
      reason: 'samples that are not numbers',
    })

    const infinite = speechLike()
    infinite[10] = Number.POSITIVE_INFINITY
    expect(inspectSpeech(infinite, RATE).ok).toBe(false)
  })

  it('rejects silence', () => {
    expect(inspectSpeech(new Float32Array(RATE), RATE)).toMatchObject({
      ok: false,
      reason: 'silence',
    })
  })

  it('rejects a clip with nothing in it at all', () => {
    expect(inspectSpeech(new Float32Array(0), RATE).ok).toBe(false)
    expect(inspectSpeech(speechLike(), 0).ok).toBe(false)
  })

  it('rejects a clip too short to be a sentence', () => {
    expect(inspectSpeech(speechLike(0.05), RATE)).toMatchObject({
      ok: false,
      reason: 'far too short',
    })
  })

  it('rejects a signal pinned at full scale', () => {
    const square = new Float32Array(RATE)
    for (let index = 0; index < square.length; index += 1) {
      // Slow enough not to be caught as noise, so it is the clipping bound
      // that has to do the work here.
      square[index] = Math.floor(index / 120) % 2 === 0 ? 1 : -1
    }
    expect(inspectSpeech(square, RATE)).toMatchObject({
      ok: false,
      reason: 'clipping from end to end',
    })
  })

  it('reports numbers a bug report can carry', () => {
    const line = describeCheck(inspectSpeech(speechLike(), RATE))
    expect(line).toMatch(/^1\.20s peak /)
    expect(line).toContain('crossings')
  })
})
