import { describe, expect, it } from 'vitest'
import {
  breathStateAt,
  cycleSeconds,
  easeInOutSlope,
  expansionAt,
  formatBreathRate,
  type BreathPattern,
} from './breathing'

/**
 * The breath is the one clock in the app that everything visual answers to, so
 * the properties asserted here are the ones the whole environment is built on
 * rather than a sample of outputs: that the curve comes to a genuine stop at
 * its turns, that sampling it in the past is the same curve and not a delay
 * line, and that a negative time wraps rather than falling off the front.
 */

const BOX: BreathPattern = { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 }
const CALM: BreathPattern = { inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 }

describe('easeInOutSlope', () => {
  it('is zero at both ends of a phase and one in the middle', () => {
    expect(easeInOutSlope(0)).toBe(0)
    expect(easeInOutSlope(0.5)).toBe(1)
    expect(easeInOutSlope(1)).toBe(0)
  })

  it('clamps rather than going negative outside the phase', () => {
    expect(easeInOutSlope(-0.4)).toBe(0)
    expect(easeInOutSlope(1.9)).toBe(0)
  })
})

describe('breathStateAt · motion', () => {
  it('is exactly zero through a hold', () => {
    for (const at of [4.01, 5, 6.5, 7.99]) {
      expect(breathStateAt(BOX, at).motion).toBe(0)
    }
  })

  it('comes to a stop at the top and bottom of the breath', () => {
    // A hair either side of the turn into the hold, and of the turn back.
    expect(breathStateAt(BOX, 3.98).motion).toBeLessThan(0.02)
    expect(breathStateAt(BOX, 8.02).motion).toBeLessThan(0.02)
    expect(breathStateAt(CALM, 0.02).motion).toBeLessThan(0.02)
  })

  it('is full in the middle of an in- and an out-breath', () => {
    expect(breathStateAt(CALM, 2).motion).toBeCloseTo(1, 6)
    expect(breathStateAt(CALM, 7).motion).toBeCloseTo(1, 6)
  })

  /*
   * The property the room's stillness actually rests on: motion is the slope
   * of expansion, so wherever motion is near zero the expansion must barely be
   * changing. Asserted numerically rather than trusting the algebra.
   */
  it('tracks how fast expansion is actually changing', () => {
    const step = 0.001
    for (let at = 0; at < cycleSeconds(BOX); at += 0.05) {
      const slope =
        Math.abs(expansionAt(BOX, at + step) - expansionAt(BOX, at - step)) /
        (2 * step)
      const { motion } = breathStateAt(BOX, at)
      // Peak slope on a 4-second phase is 2/4 = 0.5 per second.
      expect(motion * 0.5).toBeCloseTo(slope, 2)
    }
  })
})

describe('expansionAt', () => {
  it('agrees with the full state at the same moment', () => {
    for (let at = 0; at < 30; at += 0.37) {
      expect(expansionAt(CALM, at)).toBeCloseTo(breathStateAt(CALM, at).expansion, 10)
    }
  })

  it('wraps backwards, so the room can be sampled before the breath began', () => {
    const total = cycleSeconds(CALM)
    // Half a second before zero is half a second before the end of a cycle.
    expect(expansionAt(CALM, -0.5)).toBeCloseTo(expansionAt(CALM, total - 0.5), 10)
    expect(expansionAt(CALM, -0.5)).toBeGreaterThanOrEqual(0)
    expect(expansionAt(CALM, -0.5)).toBeLessThanOrEqual(1)
  })

  /*
   * The whole breath-wave effect: a lagged sample is behind the live one on the
   * way up and ahead of it on the way down, which is what makes an in-breath
   * appear to travel outward and what leaves an echo behind a full one. If this
   * ever stopped holding, the far field would simply be a copy of the near one.
   */
  it('lags the live value on the way in and leads it on the way out', () => {
    const lag = 0.6
    // Mid-inhale.
    expect(expansionAt(CALM, 2 - lag)).toBeLessThan(expansionAt(CALM, 2))
    // Mid-exhale.
    expect(expansionAt(CALM, 7 - lag)).toBeGreaterThan(expansionAt(CALM, 7))
  })

  it('returns zero for a pattern with no time in it', () => {
    expect(expansionAt({ inhale: 0, holdIn: 0, exhale: 0, holdOut: 0 }, 3)).toBe(0)
  })
})

/*
 * The number the player shows inside the orb. It is the one fact about a
 * pattern people ask for out loud — "how slow am I breathing?" — and it has to
 * read like an answer rather than like a measurement.
 */
describe('formatBreathRate', () => {
  it('says a whole number without a decimal point', () => {
    // 6 in, 4 out: ten seconds a breath, six breaths a minute.
    expect(formatBreathRate({ inhale: 6, holdIn: 0, exhale: 4, holdOut: 0 })).toBe('6')
  })

  it('keeps one decimal place where there is one worth keeping', () => {
    // The default: 4 in, 6 out — sixteen seconds, 3.75 breaths a minute.
    expect(formatBreathRate({ inhale: 6, holdIn: 0, exhale: 10, holdOut: 0 })).toBe('3.8')
  })

  it('counts the holds, which are part of the breath', () => {
    // Box breathing is four fours — sixteen seconds a breath, not eight.
    // Counting only the moving phases would claim 7.5 breaths a minute, which
    // is nearly double what the person following it is actually doing.
    expect(formatBreathRate({ inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 })).toBe('3.8')
  })

  it('has nothing to say about a pattern with no time in it', () => {
    expect(formatBreathRate({ inhale: 0, holdIn: 0, exhale: 0, holdOut: 0 })).toBeNull()
  })
})
