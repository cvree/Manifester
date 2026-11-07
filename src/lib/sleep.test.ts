import { describe, expect, it } from 'vitest'
import { fadeStartsAt, fadeWindowMs, sleepLevel } from './sleep'

const MIN = 60_000

describe('fadeWindowMs', () => {
  it('spends most of a short timer fading', () => {
    expect(fadeWindowMs(15 * MIN)).toBe(9 * MIN)
  })

  it('caps the fade on a long timer', () => {
    expect(fadeWindowMs(90 * MIN)).toBe(25 * MIN)
  })

  it('never fades for less than two minutes, or longer than the timer', () => {
    expect(fadeWindowMs(3 * MIN)).toBe(2 * MIN)
    expect(fadeWindowMs(1 * MIN)).toBe(1 * MIN)
  })

  it('treats nonsense as no fade', () => {
    expect(fadeWindowMs(0)).toBe(0)
    expect(fadeWindowMs(Number.NaN)).toBe(0)
  })
})

describe('sleepLevel', () => {
  const total = 60 * MIN
  const fade = fadeWindowMs(total)

  it('is full before the fade begins', () => {
    expect(sleepLevel(total, total)).toBe(1)
    expect(sleepLevel(fade + 1, total)).toBe(1)
  })

  it('is silent at the end', () => {
    expect(sleepLevel(0, total)).toBe(0)
    expect(sleepLevel(-5, total)).toBe(0)
  })

  it('is half way down half way through the fade', () => {
    expect(sleepLevel(fade / 2, total)).toBeCloseTo(0.5, 5)
  })

  it('only ever goes down as time runs out', () => {
    let previous = 1
    for (let remaining = fade; remaining >= 0; remaining -= 10_000) {
      const level = sleepLevel(remaining, total)
      expect(level).toBeLessThanOrEqual(previous + 1e-12)
      previous = level
    }
  })

  it('leaves and arrives without a corner', () => {
    // A one-second step at either end of the fade moves the level by a
    // vanishingly small amount: nothing anyone could hear as an event.
    expect(1 - sleepLevel(fade - 1000, total)).toBeLessThan(1e-5)
    expect(sleepLevel(1000, total)).toBeLessThan(1e-5)
  })
})

describe('fadeStartsAt', () => {
  it('is the fade window before the end', () => {
    expect(fadeStartsAt(1_000_000_000, 30 * MIN)).toBe(1_000_000_000 - 18 * MIN)
  })
})
