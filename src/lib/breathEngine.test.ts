/**
 * The breath, written down before it happens.
 *
 * The bug this file exists to keep fixed is a specific one: switch to another
 * browser tab and the breathing guide's voice used to stop, change, or lurch,
 * because it was driven from the player's animation loop and a hidden tab does
 * not run animation frames.
 *
 * The fix is that phases are laid onto the audio clock several breaths ahead,
 * so the audio thread has everything it needs whether or not this page is being
 * rendered. That claim is only worth anything if a phase scheduled for six
 * seconds' time actually *sounds* like that phase when it gets there — and the
 * thing that would silently break it is a ramp that starts from the wrong
 * value, because the value it should start from does not exist yet.
 *
 * So the important test here renders a whole cycle that was scheduled in one
 * go, at time zero, with nothing touching the graph afterwards, and measures
 * that the in-breath rises and the out-breath falls. That is exactly the
 * situation of a tab nobody is looking at.
 */

import { describe, expect, it } from 'vitest'
import { OfflineAudioContext } from 'node-web-audio-api'
import { BreathVoicePlayer } from './breathAudio'
import { placeAfter, placeAt } from './breathEngine'
import type { BreathPattern } from './breathing'
import { beat, resetHeartbeat, scheduleAt } from './heartbeat'

const RATE = 16_000

const CALM: BreathPattern = { inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 }
const BOX: BreathPattern = { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 }

/** Root-mean-square between two moments, in seconds. */
function rms(samples: Float32Array, from: number, to: number): number {
  const slice = samples.subarray(
    Math.max(0, Math.floor(from * RATE)),
    Math.min(samples.length, Math.floor(to * RATE)),
  )
  let sum = 0
  for (const sample of slice) sum += sample * sample
  return slice.length > 0 ? Math.sqrt(sum / slice.length) : 0
}

/**
 * Render a run of phases that were **all scheduled up front**, at time zero,
 * with no further contact with the graph.
 *
 * This is the whole point. `renderBreath` in `breathAudio.test.ts` hands each
 * phase over at the moment it begins, which is what a visible tab does. Nothing
 * hands anything over here, because in the case that matters nothing is running
 * to do the handing.
 */
async function renderScheduledAhead(
  voice: 'ocean' | 'breath' | 'drone',
  phases: Array<{ phase: 'inhale' | 'holdIn' | 'exhale' | 'holdOut'; seconds: number }>,
): Promise<Float32Array> {
  const total = phases.reduce((sum, item) => sum + item.seconds, 0)
  const ctx = new OfflineAudioContext(1, Math.ceil(total * RATE), RATE)
  const player = new BreathVoicePlayer(
    ctx as unknown as AudioContext,
    (ctx as unknown as AudioContext).destination,
  )

  player.setVoice(voice)
  player.setVolume(1)
  player.start()

  let at = 0
  for (const item of phases) {
    // A future `at`, every time — never "now". The first one has to be nudged
    // off zero because "at or before now" is what the interrupting call looks
    // like, and this test is specifically not that.
    player.phase(item.phase, item.seconds, Math.max(1e-4, at))
    at += item.seconds
  }

  const buffer = await ctx.startRendering()
  return Float32Array.from(buffer.getChannelData(0))
}

describe('scheduling the breath ahead of itself', () => {
  it('rises through an in-breath scheduled before it began', async () => {
    const samples = await renderScheduledAhead('ocean', [
      { phase: 'inhale', seconds: 4 },
      { phase: 'exhale', seconds: 6 },
    ])

    // The wave gathers across the in-breath.
    expect(rms(samples, 3, 4)).toBeGreaterThan(rms(samples, 0, 1) + 0.005)
  })

  it('falls through an out-breath scheduled six seconds early', async () => {
    const samples = await renderScheduledAhead('ocean', [
      { phase: 'inhale', seconds: 4 },
      { phase: 'exhale', seconds: 6 },
    ])

    /*
     * The regression this is really about.
     *
     * The out-breath was scheduled at time zero for a moment four seconds
     * later, so its ramp had to begin from the value the in-breath was *going*
     * to reach. Read off the param instead — which is what the code did before
     * the engine existed — and it begins from silence and ramps to silence, so
     * the second half of every breath in a hidden tab is simply missing.
     */
    expect(rms(samples, 4, 5)).toBeGreaterThan(rms(samples, 9, 10) + 0.005)
    expect(rms(samples, 4, 5)).toBeGreaterThan(0.01)
  })

  it('keeps a whole cycle in step across three phases scheduled at once', async () => {
    const samples = await renderScheduledAhead('ocean', [
      { phase: 'inhale', seconds: 3 },
      { phase: 'exhale', seconds: 4 },
      { phase: 'inhale', seconds: 3 },
    ])

    const firstPeak = rms(samples, 2.4, 3)
    const trough = rms(samples, 6.4, 7)
    const secondPeak = rms(samples, 9.4, 10)

    expect(firstPeak).toBeGreaterThan(trough)
    expect(secondPeak).toBeGreaterThan(trough)
    // The second breath is the same breath as the first, not a quieter echo of
    // it: a chain of scheduled ramps that leaks a little each time round is a
    // guide that fades away over half an hour.
    expect(secondPeak).toBeGreaterThan(firstPeak * 0.6)
  })

  it('holds still through a hold that nothing was awake to announce', async () => {
    const samples = await renderScheduledAhead('drone', [
      { phase: 'inhale', seconds: 4 },
      { phase: 'holdIn', seconds: 4 },
      { phase: 'exhale', seconds: 4 },
    ])

    // A drone holds its level through holdIn rather than falling silent.
    expect(rms(samples, 5, 7.5)).toBeGreaterThan(0.01)
  })
})

describe('placing phases on the clock', () => {
  it('finds the phase a moment falls in, and when it began', () => {
    expect(placeAt(CALM, 0)).toEqual({ phase: 'inhale', startsAt: 0, duration: 4 })
    expect(placeAt(CALM, 3.9)).toEqual({ phase: 'inhale', startsAt: 0, duration: 4 })
    expect(placeAt(CALM, 4)).toEqual({ phase: 'exhale', startsAt: 4, duration: 6 })
    expect(placeAt(CALM, 9.9)).toEqual({ phase: 'exhale', startsAt: 4, duration: 6 })
  })

  it('keeps counting in absolute time across cycles', () => {
    // Not folded back into one cycle: the schedule is written in the same
    // seconds the wall clock is, or a phase twenty minutes in would be placed
    // twenty minutes ago.
    expect(placeAt(CALM, 10)).toEqual({ phase: 'inhale', startsAt: 10, duration: 4 })
    expect(placeAt(CALM, 25)).toEqual({ phase: 'exhale', startsAt: 24, duration: 6 })
    expect(placeAt(CALM, 1204)).toEqual({
      phase: 'exhale',
      startsAt: 1204,
      duration: 6,
    })
  })

  it('skips phases a pattern sets to zero', () => {
    // Calm has no holds at all, so an in-breath is followed by an out-breath.
    expect(placeAfter(CALM, 4)).toEqual({ phase: 'exhale', startsAt: 4, duration: 6 })
    expect(placeAfter(CALM, 10)).toEqual({
      phase: 'inhale',
      startsAt: 10,
      duration: 4,
    })
  })

  it('walks all four phases of a box breath in order', () => {
    const order: string[] = []
    let endsAt = 0
    for (let i = 0; i < 5; i += 1) {
      const next = placeAfter(BOX, endsAt)
      if (!next) throw new Error('a valid pattern must always place')
      order.push(next.phase)
      endsAt = next.startsAt + next.duration
    }

    expect(order).toEqual(['inhale', 'holdIn', 'exhale', 'holdOut', 'inhale'])
    // Four phases of four seconds, and the fifth is the next cycle's first.
    expect(endsAt).toBe(20)
  })

  it('has no answer for a pattern with no time in it', () => {
    expect(placeAt({ inhale: 0, holdIn: 0, exhale: 0, holdOut: 0 }, 3)).toBeNull()
  })
})

describe('the heartbeat', () => {
  it('fires an overdue alarm without a timer', () => {
    resetHeartbeat()
    let fired = 0
    scheduleAt(Date.now() - 1, () => {
      fired += 1
    })

    // No `setTimeout` has run — under a test runner there is no window at all,
    // which is a fair model of a tab throttled to the point of uselessness.
    beat()
    expect(fired).toBe(1)

    // And exactly once, however often the drum is beaten afterwards.
    beat()
    beat()
    expect(fired).toBe(1)
    resetHeartbeat()
  })

  it('leaves an alarm that is not due yet alone', () => {
    resetHeartbeat()
    let fired = 0
    scheduleAt(Date.now() + 60_000, () => {
      fired += 1
    })
    beat()
    expect(fired).toBe(0)
    resetHeartbeat()
  })

  it('cancels an alarm that is no longer wanted', () => {
    resetHeartbeat()
    let fired = 0
    const cancel = scheduleAt(Date.now() - 1, () => {
      fired += 1
    })
    cancel()
    beat()
    expect(fired).toBe(0)
    resetHeartbeat()
  })
})
