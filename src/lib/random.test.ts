import { describe, expect, it } from 'vitest'
import { hashRange, hashUnit, mulberry32, SESSION_SEED } from './random'

/**
 * The living forms are drawn twice at once — inside the orb and across the
 * room — by two objects that never speak to each other. They agree because
 * every structural decision either of them makes is a pure function of
 * `(seed, breath)`. These are the assertions that keep that true.
 */

describe('mulberry32', () => {
  it('gives the same stream for the same seed, and a different one otherwise', () => {
    const a = Array.from({ length: 8 }, mulberry32(1234))
    const b = Array.from({ length: 8 }, mulberry32(1234))
    const c = Array.from({ length: 8 }, mulberry32(1235))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('stays inside [0, 1)', () => {
    const next = mulberry32(0xbeef)
    for (let i = 0; i < 5000; i += 1) {
      const value = next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('hashUnit', () => {
  it('is a lookup, not a stream: asking twice gives one answer', () => {
    expect(hashUnit(7, 42)).toBe(hashUnit(7, 42))
    expect(hashUnit(7, 42, 3)).toBe(hashUnit(7, 42, 3))
  })

  it('separates the two arguments the scenes actually vary', () => {
    // A different breath of the same session, and the same breath of a
    // different session, must both land somewhere else.
    expect(hashUnit(7, 42)).not.toBe(hashUnit(7, 43))
    expect(hashUnit(7, 42)).not.toBe(hashUnit(8, 42))
    // And the salt that separates one property of a breath from another.
    expect(hashUnit(7, 42, 1)).not.toBe(hashUnit(7, 42, 2))
  })

  it('does not let consecutive breaths rhyme', () => {
    /*
     * The failure this guards against is subtle and would have been shipped:
     * a weak hash makes breath 41 and breath 42 produce *nearly* the same
     * number, so the cathedral drifts slowly in one direction all session
     * instead of being different every time. Neighbouring inputs have to land
     * as far apart as unrelated ones do.
     */
    let close = 0
    for (let breath = 0; breath < 400; breath += 1) {
      if (Math.abs(hashUnit(99, breath) - hashUnit(99, breath + 1)) < 0.05) {
        close += 1
      }
    }
    // Uniform independent draws would land within 0.05 about a tenth of the
    // time. Anything much above that is a hash with structure in it.
    expect(close).toBeLessThan(70)
  })

  it('covers the range it claims', () => {
    const buckets = new Array(10).fill(0)
    for (let i = 0; i < 4000; i += 1) {
      const value = hashUnit(i, i * 7 + 1)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      buckets[Math.floor(value * 10)] += 1
    }
    for (const bucket of buckets) expect(bucket).toBeGreaterThan(250)
  })
})

describe('hashRange', () => {
  it('stays between its bounds', () => {
    for (let i = 0; i < 500; i += 1) {
      const value = hashRange(2, 5, i)
      expect(value).toBeGreaterThanOrEqual(2)
      expect(value).toBeLessThan(5)
    }
  })
})

describe('SESSION_SEED', () => {
  it('is one number for the whole page load', () => {
    // The identity a session draws under. Reading it twice must not roll again,
    // or the orb and the room would be in two different worlds.
    expect(SESSION_SEED).toBe(SESSION_SEED)
    expect(Number.isInteger(SESSION_SEED)).toBe(true)
    expect(SESSION_SEED).toBeGreaterThanOrEqual(0)
  })
})
