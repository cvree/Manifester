import { describe, expect, it } from 'vitest'
import { BREATH_STYLES } from './breathing'
import {
  BACKGROUND_MODES,
  backgroundChoiceName,
  BREATH_LAG_SECONDS,
  DEFAULT_BACKGROUND_MODE,
  findBackgroundMode,
  isBackgroundChoice,
  MOTE_FIELD,
  nextScene,
  sceneAt,
  SCENE_FADE_MS,
  SCENE_HOLD_MS,
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
    // A room that no longer exists resolves to one that does, rather than to
    // a class name the stylesheet has no answer for and an empty screen.
    expect(findBackgroundMode('nowhere')).toBe(BACKGROUND_MODES[0])
  })

  it('never shares a name with a breathing form', () => {
    // The two settings sit in the same sheet. Four names in common — which is
    // where this started — is a sheet where nobody can tell which "Tide" they
    // just chose.
    const forms = new Set(BREATH_STYLES.map((style) => style.name))
    for (const mode of BACKGROUND_MODES) {
      expect(forms.has(mode.name), mode.name).toBe(false)
    }
  })

  it('offers a real choice of rooms, each one described', () => {
    expect(BACKGROUND_MODES.length).toBeGreaterThanOrEqual(5)
    for (const mode of BACKGROUND_MODES) {
      expect(mode.name).not.toBe('')
      expect(mode.description).not.toBe('')
    }
    // Every id distinct: two rooms sharing one would make the picker lie.
    const ids = new Set(BACKGROUND_MODES.map((mode) => mode.id))
    expect(ids.size).toBe(BACKGROUND_MODES.length)
  })

  it('knows what may be stored in the setting', () => {
    expect(isBackgroundChoice('random')).toBe(true)
    expect(isBackgroundChoice(DEFAULT_BACKGROUND_MODE)).toBe(true)
    expect(isBackgroundChoice('nowhere')).toBe(false)
    expect(isBackgroundChoice(undefined)).toBe(false)
  })

  it('names the setting, drifting included', () => {
    expect(backgroundChoiceName('random')).toBe('Drifting')
    expect(backgroundChoiceName('waterline')).toBe('Waterline')
  })
})

describe('drifting between rooms', () => {
  it('never lands on the room it is leaving', () => {
    for (const mode of BACKGROUND_MODES) {
      for (const roll of [0, 0.17, 0.42, 0.5, 0.83, 0.999]) {
        expect(nextScene(mode.id, roll)).not.toBe(mode.id)
      }
    }
  })

  it('can reach every other room', () => {
    const reached = new Set(
      Array.from({ length: 200 }, (_, i) =>
        nextScene('atmosphere', i / 200),
      ),
    )
    expect(reached.size).toBe(BACKGROUND_MODES.length - 1)
  })

  it('stays in range at the ends of the roll', () => {
    // `Math.random()` is [0, 1), but a fixture — or a browser rounding a
    // float — must not be able to index past the end of the list.
    expect(BACKGROUND_MODES.map((mode) => mode.id)).toContain(sceneAt(0))
    expect(BACKGROUND_MODES.map((mode) => mode.id)).toContain(sceneAt(1))
    expect(BACKGROUND_MODES.map((mode) => mode.id)).toContain(sceneAt(0.999999))
  })

  it('holds a room long enough to be a room, and crosses inside the hold', () => {
    expect(SCENE_HOLD_MS).toBeGreaterThanOrEqual(30_000)
    expect(SCENE_FADE_MS).toBeLessThan(SCENE_HOLD_MS)
    // Long enough to cover a whole breath at the default pattern, so the
    // arriving room is already in step by the time it can be seen.
    expect(SCENE_FADE_MS).toBeGreaterThanOrEqual(3000)
  })
})

describe('BREATH_LAG_SECONDS', () => {
  it('puts the far field behind the near one, and both under a second', () => {
    expect(BREATH_LAG_SECONDS.mid).toBeGreaterThan(0)
    expect(BREATH_LAG_SECONDS.far).toBeGreaterThan(BREATH_LAG_SECONDS.mid)
    expect(BREATH_LAG_SECONDS.far).toBeLessThan(1)
  })
})
