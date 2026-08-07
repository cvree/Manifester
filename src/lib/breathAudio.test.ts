/**
 * The breath voices, rendered and measured.
 *
 * The whole promise of this module is that **you can follow the guide with
 * your eyes shut**, and that is a claim about the signal, not about the code:
 * the in-breath has to actually sound like it is rising and the out-breath
 * like it is falling. A test that only checked "some audio came out" would
 * pass just as happily on a voice that plays the same flat hiss both ways,
 * which is the exact failure that would make the feature pointless.
 *
 * So these render real graphs through `node-web-audio-api` and measure the
 * envelope, the brightness and the pitch, phase by phase.
 */

import { describe, expect, it } from 'vitest'
import { OfflineAudioContext } from 'node-web-audio-api'
import {
  BREATH_VOICES,
  BreathVoicePlayer,
  findVoice,
  type BreathVoiceId,
} from './breathAudio'

const RATE = 16_000

function window(samples: Float32Array, from: number, to: number): Float32Array {
  return samples.subarray(
    Math.max(0, Math.floor(from * RATE)),
    Math.min(samples.length, Math.floor(to * RATE)),
  )
}

/** Root-mean-square over a window, in seconds. */
function rms(samples: Float32Array, from: number, to: number): number {
  const slice = window(samples, from, to)
  let sum = 0
  for (const sample of slice) sum += sample * sample
  return slice.length > 0 ? Math.sqrt(sum / slice.length) : 0
}

/**
 * A brightness reading: mean absolute sample-to-sample difference, normalised
 * by level. High frequencies move further between samples, so this rises as a
 * filter opens even when the level has not changed.
 */
function brightness(samples: Float32Array, from: number, to: number): number {
  const slice = window(samples, from, to)
  let diff = 0
  let level = 0
  for (let i = 1; i < slice.length; i += 1) {
    diff += Math.abs(slice[i] - slice[i - 1])
    level += Math.abs(slice[i])
  }
  return level > 0 ? diff / level : 0
}

/** Fundamental of a near-periodic window, from upward mean crossings. */
function pitchHz(samples: Float32Array, from: number, to: number): number {
  const slice = window(samples, from, to)
  if (slice.length < 2) return 0
  let mean = 0
  for (const sample of slice) mean += sample
  mean /= slice.length

  let first = -1
  let last = -1
  let crossings = 0
  for (let i = 1; i < slice.length; i += 1) {
    if (slice[i - 1] <= mean && slice[i] > mean) {
      if (first < 0) first = i
      last = i
      crossings += 1
    }
  }
  if (crossings < 2) return 0
  return ((crossings - 1) * RATE) / (last - first)
}

/**
 * Render a single phase, from the guide's resting state.
 *
 * Everything that can be asked of one phase alone is asked this way. It needs
 * no `suspend()`, and `suspend()` is worth avoiding: it is the one part of
 * `node-web-audio-api` that misbehaves when renders overlap, and when it does
 * it fails by quietly not applying the automation rather than by throwing.
 */
async function renderPhase(
  voice: BreathVoiceId,
  phase: 'inhale' | 'exhale',
  seconds: number,
): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE)
  const player = new BreathVoicePlayer(
    ctx as unknown as AudioContext,
    (ctx as unknown as AudioContext).destination,
  )
  player.setVoice(voice)
  player.setVolume(1)
  player.start()
  player.phase(phase, seconds)

  const buffer = await ctx.startRendering()
  return Float32Array.from(buffer.getChannelData(0))
}

/**
 * Render a whole breath — inhale, then exhale — in one continuous context.
 *
 * Only the continuous voices need this, and only because an out-breath has to
 * begin from wherever the in-breath left the graph: that is the whole point of
 * them. The phase is handed over from inside `suspend`, exactly as the hook
 * does it at a real phase change, so the automation is scheduled from the
 * context's actual current time rather than from an offset the production code
 * never sees. See `audioHarness` for why that distinction matters.
 *
 * Driving the render is this test's job alone: the player never suspends or
 * resumes a context it was handed, which is what makes it renderable offline
 * at all. An earlier version did, and its `resume()` fired before rendering had
 * begun — silently wiping the automation this whole file exists to measure.
 */
async function renderBreath(
  voice: BreathVoiceId,
  inhale: number,
  exhale: number,
): Promise<Float32Array> {
  const total = inhale + exhale
  const ctx = new OfflineAudioContext(1, Math.ceil(total * RATE), RATE)
  const player = new BreathVoicePlayer(
    ctx as unknown as AudioContext,
    (ctx as unknown as AudioContext).destination,
  )

  player.setVoice(voice)
  player.setVolume(1)
  player.start()
  player.phase('inhale', inhale)

  void ctx.suspend(inhale).then(() => {
    player.phase('exhale', exhale)
    void ctx.resume()
  })

  const buffer = await ctx.startRendering()
  return Float32Array.from(buffer.getChannelData(0))
}

describe('breath voices', () => {
  it('offers both a continuous and a struck family', () => {
    expect(BREATH_VOICES.some((voice) => voice.sustained)).toBe(true)
    expect(BREATH_VOICES.some((voice) => !voice.sustained)).toBe(true)
    expect(findVoice('off')).toBeNull()
    expect(findVoice('chime')?.sustained).toBe(false)
  })

  it.each(BREATH_VOICES.map((voice) => voice.id))(
    '%s makes an audible sound on the in-breath',
    async (id) => {
      const samples = await renderPhase(id, 'inhale', 4)
      expect(rms(samples, 0.2, 3.8)).toBeGreaterThan(0.002)
    },
  )

  /*
   * Each continuous voice carries the breath in its own dimension, so each is
   * measured in that dimension. What they share is the only thing that
   * matters: from a one-second snippet you could say which way the breath was
   * going.
   */
  describe('ocean', () => {
    it('gathers through the in-breath and draws back through the out', async () => {
      const samples = await renderBreath('ocean', 6, 6)
      expect(rms(samples, 4.6, 5.8)).toBeGreaterThan(rms(samples, 0.3, 1.5) * 2)
      expect(rms(samples, 10.6, 11.8)).toBeLessThan(rms(samples, 6.2, 7.4) * 0.5)
    })

    it('is brighter at the top of the breath than at the bottom', async () => {
      const samples = await renderBreath('ocean', 6, 6)
      expect(brightness(samples, 4.6, 5.8)).toBeGreaterThan(
        brightness(samples, 10.6, 11.8),
      )
    })
  })

  describe('hush', () => {
    it('swells through the middle of a breath, the way a real one does', async () => {
      const samples = await renderBreath('breath', 6, 6)
      const middle = rms(samples, 2.6, 3.4)
      expect(middle).toBeGreaterThan(rms(samples, 0.05, 0.6) * 2)
      expect(middle).toBeGreaterThan(rms(samples, 5.5, 5.95) * 2)
    })

    it('breathes in brighter than it breathes out', async () => {
      const samples = await renderBreath('breath', 6, 6)
      // Late in each phase, where the two filter targets are furthest apart.
      expect(brightness(samples, 3.6, 4.8)).toBeGreaterThan(
        brightness(samples, 9.6, 10.8),
      )
    })
  })

  describe('drone', () => {
    it('climbs a fifth on the way in and falls back on the way out', async () => {
      const samples = await renderBreath('drone', 6, 6)
      const top = pitchHz(samples, 4.8, 5.9)
      const bottom = pitchHz(samples, 10.8, 11.9)
      expect(top).toBeGreaterThan(230)
      expect(bottom).toBeLessThan(200)
      expect(top / bottom).toBeGreaterThan(1.3)
    })
  })

  describe.each(
    BREATH_VOICES.filter((voice) => !voice.sustained).map((voice) => voice.id),
  )('%s (struck)', (id) => {
    it.each(['inhale', 'exhale'] as const)(
      'sounds at the %s and then gets out of the way',
      async (phase) => {
        const samples = await renderPhase(id, phase, 6)
        const strike = rms(samples, 0.05, 0.5)
        expect(strike).toBeGreaterThan(0.005)
        expect(strike).toBeGreaterThan(rms(samples, 5.4, 5.9) * 3)
      },
    )

    it('rings higher going in than coming out', async () => {
      const going = await renderPhase(id, 'inhale', 5)
      const coming = await renderPhase(id, 'exhale', 5)
      expect(pitchHz(going, 0.05, 0.6)).toBeGreaterThan(
        pitchHz(coming, 0.05, 0.6),
      )
    })
  })

  it('stays silent when the voice is off', async () => {
    const ctx = new OfflineAudioContext(1, RATE * 2, RATE)
    const player = new BreathVoicePlayer(
      ctx as unknown as AudioContext,
      (ctx as unknown as AudioContext).destination,
    )
    player.setVoice('off')
    player.start()
    player.phase('inhale', 2)

    const buffer = await ctx.startRendering()
    expect(rms(Float32Array.from(buffer.getChannelData(0)), 0, 2)).toBe(0)
  })

  it('never leaves full scale, even at the top of the volume range', async () => {
    for (const { id } of BREATH_VOICES) {
      for (const phase of ['inhale', 'exhale'] as const) {
        const samples = await renderPhase(id, phase, 3)
        let peak = 0
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
        expect(
          peak,
          `${id} peaked at ${peak.toFixed(3)} on the ${phase}`,
        ).toBeLessThanOrEqual(1)
      }
    }
  })
})
