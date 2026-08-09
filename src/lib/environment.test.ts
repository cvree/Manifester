import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_MODES,
  BREATH_LAG_SECONDS,
  DEFAULT_BACKGROUND_MODE,
  findBackgroundMode,
  MOTE_FIELD,
} from './environment'

/**
 * The environment is a *place*, and the one thing a place must never do is
 * rearrange itself because some unrelated piece of UI state changed. These are
 * the assertions that keep it one.
 */

describe('MOTE_FIELD', () => {
  it('is a sparse field rather than a particle system', () => {
    expect(MOTE_FIELD.length).toBeGreaterThanOrEqual(15)
    expect(MOTE_FIELD.length).toBeLessThanOrEqual(30)
  })

  it('is the same field every time it is read', () => {
    const snapshot = JSON.stringify(MOTE_FIELD)
    expect(JSON.stringify(MOTE_FIELD)).toBe(snapshot)
    // And the values themselves are fixed, not merely stable within a run.
    expect(MOTE_FIELD[0].angle).toBeCloseTo(MOTE_FIELD[0].angle, 12)
  })

  it('keeps every point inside the field it is placed in', () => {
    for (const mote of MOTE_FIELD) {
      expect(mote.angle).toBeGreaterThanOrEqual(0)
      expect(mote.angle).toBeLessThan(360)
      expect(mote.distance).toBeGreaterThan(0)
      expect(mote.distance).toBeLessThanOrEqual(1)
      expect(mote.depth).toBeGreaterThanOrEqual(0)
      expect(mote.depth).toBeLessThanOrEqual(1)
      expect(mote.size).toBeGreaterThan(0)
      // Negative, so every twinkle starts already underway rather than in step.
      expect(mote.delay).toBeLessThanOrEqual(0)
      expect(mote.period).toBeGreaterThan(0)
    }
  })

  it('is stratified, so no two points can land on top of each other', () => {
    const sorted = [...MOTE_FIELD].sort((a, b) => a.angle - b.angle)
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].angle - sorted[i - 1].angle).toBeGreaterThan(1)
    }
  })

  it('is mostly distant, so the field reads as having depth', () => {
    const near = MOTE_FIELD.filter((mote) => mote.depth > 0.5).length
    expect(near).toBeLessThan(MOTE_FIELD.length / 2)
  })
})

describe('modes', () => {
  it('resolves the default, and falls back rather than returning nothing', () => {
    expect(findBackgroundMode(DEFAULT_BACKGROUND_MODE).id).toBe('atmosphere')
    expect(findBackgroundMode('tide')).toBe(BACKGROUND_MODES[0])
  })
})

describe('BREATH_LAG_SECONDS', () => {
  it('puts the far field behind the near one, and both under a second', () => {
    expect(BREATH_LAG_SECONDS.mid).toBeGreaterThan(0)
    expect(BREATH_LAG_SECONDS.far).toBeGreaterThan(BREATH_LAG_SECONDS.mid)
    expect(BREATH_LAG_SECONDS.far).toBeLessThan(1)
  })
})
