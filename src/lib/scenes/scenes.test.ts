import { describe, expect, it } from 'vitest'
import { breathStateAt, BREATH_STYLES, isLivingStyle } from '../breathing'
import {
  buildCathedral,
  dissolveFor,
  rarityFor as cathedralRarity,
  revealFor,
  worldFor as cathedralWorld,
} from './inkCathedral'
import { rarityFor as moonpoolRarity, worldFor as moonpoolWorld } from './moonpool'
import {
  approach,
  clamp,
  lerp,
  mixRgb,
  PALETTE,
  rgba,
  smoothstep,
  smootherstep,
  wander,
} from './types'

/**
 * The living forms have almost no state and a great deal of arithmetic, and
 * every property worth protecting is a property of that arithmetic:
 *
 *   - the same session builds the same world, twice, in two canvases that never
 *     speak to each other;
 *   - the exhale never rewinds the inhale;
 *   - the last fifth of an in-breath is where the reward is;
 *   - a rare moment stays rare.
 *
 * None of that needs a canvas, which is why none of these tests has one.
 */

/* ── Shaping ────────────────────────────────────────────────── */

describe('shaping', () => {
  it('clamps, mixes and eases inside their ranges', () => {
    expect(clamp(-3)).toBe(0)
    expect(clamp(9)).toBe(1)
    expect(clamp(5, 0, 10)).toBe(5)
    expect(lerp(2, 4, 0.5)).toBe(3)

    for (const shape of [smoothstep, smootherstep]) {
      expect(shape(0, 1, -1)).toBe(0)
      expect(shape(0, 1, 2)).toBe(1)
      expect(shape(0, 1, 0.5)).toBeCloseTo(0.5, 6)
      // Monotonic, or an easing curve would move something backwards.
      let previous = -1
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const value = shape(0, 1, t)
        expect(value).toBeGreaterThanOrEqual(previous)
        previous = value
      }
    }
  })

  it('does not divide by zero when an easing has no width', () => {
    expect(Number.isFinite(smoothstep(0.5, 0.5, 0.5))).toBe(true)
    expect(Number.isFinite(smootherstep(0.5, 0.5, 0.9))).toBe(true)
  })

  describe('approach', () => {
    it('closes on its target without ever passing it', () => {
      let value = 0
      for (let i = 0; i < 300; i += 1) value = approach(value, 1, 2.4, 1 / 60)
      expect(value).toBeGreaterThan(0.99)
      expect(value).toBeLessThanOrEqual(1)
    })

    it('lands in the same place whatever the frame rate', () => {
      // This is what makes the water's inertia the *same* inertia on a 60Hz
      // phone and a 120Hz one. A naive `value += (target - value) * k` does not
      // have this property, and the bug it causes — water that lags twice as
      // far on a fast screen — is invisible until someone reports it.
      let slow = 0
      for (let i = 0; i < 30; i += 1) slow = approach(slow, 1, 2.4, 1 / 30)
      let fast = 0
      for (let i = 0; i < 120; i += 1) fast = approach(fast, 1, 2.4, 1 / 120)
      expect(slow).toBeCloseTo(fast, 3)
    })

    it('lags: after a step it is somewhere in between, not there', () => {
      const after = approach(0, 1, 2.35, 1 / 60)
      expect(after).toBeGreaterThan(0)
      expect(after).toBeLessThan(0.2)
    })
  })

  it('wanders without settling into a period anyone could find', () => {
    // Two sines at an irrational ratio: sampled a full cycle of the first
    // apart, the second has not come back to where it was.
    const period = (Math.PI * 2) / 1
    expect(wander(0, 1, 1)).not.toBeCloseTo(wander(period, 1, 1), 2)
    for (let t = 0; t < 40; t += 0.37) {
      expect(Math.abs(wander(t, 1, 1))).toBeLessThanOrEqual(1.0001)
    }
  })
})

/* ── Colour ─────────────────────────────────────────────────── */

describe('colour', () => {
  it('stays inside the Manifester palette', () => {
    for (const colour of Object.values(PALETTE)) {
      for (const channel of colour) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(255)
      }
    }
  })

  it('clamps alpha rather than emitting an invalid colour', () => {
    expect(rgba(PALETTE.gold, -1)).toBe('rgba(231,203,148,0.0000)')
    expect(rgba(PALETTE.gold, 4)).toBe('rgba(231,203,148,1.0000)')
  })

  it('mixes to whole channels at both ends', () => {
    expect(mixRgb(PALETTE.pearl, PALETTE.gold, 0)).toEqual([...PALETTE.pearl])
    expect(mixRgb(PALETTE.pearl, PALETTE.gold, 1)).toEqual([...PALETTE.gold])
    for (const channel of mixRgb(PALETTE.pearl, PALETTE.night, 0.37)) {
      expect(Number.isInteger(channel)).toBe(true)
    }
  })
})

/* ── The forms are registered ───────────────────────────────── */

describe('the living forms', () => {
  it('are in the picker, and are the only two drawn rather than styled', () => {
    const living = BREATH_STYLES.filter((style) => isLivingStyle(style.id))
    expect(living.map((style) => style.id).sort()).toEqual(['cathedral', 'moonpool'])
    for (const style of living) {
      expect(style.name).not.toBe('')
      expect(style.description).not.toBe('')
    }
  })
})

/* ── An exhale is not a rewind ──────────────────────────────── */

describe('revealFor', () => {
  it('rises with the in-breath and holds through the top', () => {
    expect(revealFor('inhale', 0, 1)).toBe(0)
    expect(revealFor('inhale', 0.4, 0)).toBe(0.4)
    expect(revealFor('holdIn', 0.4, 0.4)).toBe(1)
  })

  it('never moves during an exhale, however far the breath has fallen', () => {
    // The whole point. If this ever returns something below `previous`, the
    // arches un-draw from the keystone down and the out-breath reads as a
    // video being scrubbed backwards.
    for (const expansion of [1, 0.8, 0.5, 0.2, 0]) {
      expect(revealFor('exhale', expansion, 1)).toBe(1)
      expect(revealFor('holdOut', expansion, 1)).toBe(1)
    }
  })

  it('never decreases across a whole breath except at a new in-breath', () => {
    const pattern = { inhale: 4, holdIn: 2, exhale: 6, holdOut: 1 }
    let reveal = 0
    let previous = 0
    let restarts = 0

    // Two cycles at 60Hz, read exactly as the scene reads them.
    for (let frame = 0; frame < 60 * 26; frame += 1) {
      const state = breathStateAt(pattern, frame / 60)
      reveal = revealFor(state.phase, state.expansion, reveal)
      if (reveal < previous - 1e-9) {
        // The only legitimate drop is the first frames of a new in-breath.
        expect(state.phase).toBe('inhale')
        expect(state.phaseProgress).toBeLessThan(0.2)
        restarts += 1
      }
      previous = reveal
    }

    // Exactly one restart per breath begun, and no others.
    expect(restarts).toBeGreaterThanOrEqual(1)
    expect(restarts).toBeLessThanOrEqual(3)
  })

  it('reaches the top of the reveal only at the top of the breath', () => {
    /*
     * The vault — the most spectacular thing in the room — is drawn from
     * `smootherstep(0.78, 0.995, reveal)`, so it is reachable only by finishing
     * the in-breath that was asked for. And there is nothing above it: the
     * curve tops out at the cadence, so breathing *harder* than the guide buys
     * exactly nothing, which is the point.
     */
    expect(revealFor('inhale', 0.7, 0)).toBeLessThan(0.78)
    expect(revealFor('inhale', 0.99, 0)).toBeGreaterThan(0.78)
    expect(revealFor('holdIn', 1, 1)).toBe(1)
  })
})

describe('dissolveFor', () => {
  it('is nothing at all on the way up', () => {
    for (const p of [0, 0.3, 0.7, 1]) {
      expect(dissolveFor('inhale', p)).toBe(0)
      expect(dissolveFor('holdIn', p)).toBe(0)
    }
  })

  it('runs ahead of the breath on the way down, and finishes', () => {
    expect(dissolveFor('exhale', 0)).toBe(0)
    // Ahead: at the halfway point of the out-breath, more than half gone.
    expect(dissolveFor('exhale', 0.5)).toBeGreaterThan(0.5)
    expect(dissolveFor('exhale', 1)).toBe(1)
    expect(dissolveFor('holdOut', 0.5)).toBe(1)
  })

  it('is monotonic through the exhale', () => {
    let previous = -1
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const value = dissolveFor('exhale', p)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

/* ── One world, two canvases ────────────────────────────────── */

describe('the cathedral', () => {
  it('is the same building in both canvases, built from nothing shared', () => {
    /*
     * The orb and the room are two `InkCathedral` objects that never exchange
     * a byte. They agree because the geometry is a pure function of the session
     * seed and the breath index — so this is the assertion the whole design
     * rests on, and the one that would fail silently and beautifully if anyone
     * reached for `Math.random()` inside the builder.
     */
    const world = cathedralWorld(0x1234abcd)
    for (const breath of [0, 1, 7, 42, 999]) {
      const orb = buildCathedral(0x1234abcd, breath, world)
      const room = buildCathedral(0x1234abcd, breath, world)
      expect(JSON.stringify(orb)).toBe(JSON.stringify(room))
    }
  })

  it('builds a different building every breath, in the same cathedral', () => {
    const world = cathedralWorld(0x5150)
    const shapes = new Set<string>()
    for (let breath = 0; breath < 40; breath += 1) {
      shapes.add(JSON.stringify(buildCathedral(0x5150, breath, world)))
    }
    // Never the same twice.
    expect(shapes.size).toBe(40)

    // And recognisably one place: the vault stays within a quarter of itself
    // across forty breaths, rather than the room resizing every four seconds.
    const vaults = Array.from({ length: 40 }, (_, breath) =>
      buildCathedral(0x5150, breath, world).vaultY,
    ).filter((_, i) => cathedralRarity(0x5150, i) !== 'twin')
    const min = Math.min(...vaults)
    const max = Math.max(...vaults)
    expect(max / min).toBeLessThan(1.3)
  })

  it('is a different cathedral in a different session', () => {
    const a = cathedralWorld(1)
    const b = cathedralWorld(2)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('is Gothic: every arch rises further than its bay is wide', () => {
    // Below 1 and the arcade reads as a row of croquet hoops rather than as a
    // nave — which is exactly what the first version of this drew.
    for (let seed = 0; seed < 200; seed += 1) {
      expect(cathedralWorld(seed).loft).toBeGreaterThan(1)
    }
  })

  it('keeps its proportions inside the box it is drawn in', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const world = cathedralWorld(seed)
      expect(world.bays).toBeGreaterThanOrEqual(3)
      expect(world.bays).toBeLessThanOrEqual(6)
      for (let breath = 0; breath < 12; breath += 1) {
        const built = buildCathedral(seed, breath, world)
        expect(built.strands.length).toBeGreaterThan(4)
        /*
         * The scene divides the height it has by this number, so it cannot put
         * the vault off screen whatever it comes out as — but the *proportions*
         * still have to be a cathedral's. Outside this band a tall roll is not
         * more dramatic, it is the same building drawn smaller.
         */
        expect(built.vaultY).toBeGreaterThan(1.4)
        expect(built.vaultY).toBeLessThanOrEqual(3.1)
        // And no arch may poke through the ceiling its own ribs rise to.
        for (const arch of built.arches) {
          expect(arch.apexY).toBeLessThan(built.vaultY)
        }
        for (const strand of built.strands) {
          expect(strand.points.length).toBeGreaterThan(1)
          expect(strand.release).toBeGreaterThanOrEqual(0)
          expect(strand.release).toBeLessThanOrEqual(1)
          expect(strand.minX).toBeLessThanOrEqual(strand.maxX)
        }
        for (const arch of built.arches) {
          // `t` is distance from the nearer spring, and both halves must reach
          // the keystone — otherwise an arch never visibly closes.
          const highest = Math.max(...arch.points.map((point) => point.t))
          expect(highest).toBeCloseTo(1, 6)
          expect(arch.points[0].t).toBeCloseTo(0, 6)
          expect(arch.points[arch.points.length - 1].t).toBeCloseTo(0, 6)
          expect(arch.apexY).toBeGreaterThan(0)
        }
      }
    }
  })

  it('keeps its rare moments rare', () => {
    const counts: Record<string, number> = {}
    const trials = 20_000
    for (let breath = 0; breath < trials; breath += 1) {
      const rarity = cathedralRarity(0x2b2b, breath)
      counts[rarity] = (counts[rarity] ?? 0) + 1
    }
    // About one breath in six brings something. Often enough to be worth
    // staying for; seldom enough that none of them becomes what the form does.
    const rare = trials - (counts.none ?? 0)
    expect(rare / trials).toBeGreaterThan(0.1)
    expect(rare / trials).toBeLessThan(0.25)
    // And all four are reachable, or one of them is dead code.
    for (const kind of ['rose', 'constellation', 'twin', 'lightfall']) {
      expect(counts[kind] ?? 0).toBeGreaterThan(trials * 0.02)
    }
  })
})

/* ── The sky is a place ─────────────────────────────────────── */

describe('the moonpool', () => {
  it('places the same sky every time it is asked', () => {
    expect(JSON.stringify(moonpoolWorld(77))).toBe(JSON.stringify(moonpoolWorld(77)))
    expect(JSON.stringify(moonpoolWorld(77))).not.toBe(
      JSON.stringify(moonpoolWorld(78)),
    )
  })

  it('leaves ocean around the opening at the very top of a breath', () => {
    // A Snell's window that fills the view is a light box, not a window: the
    // water around it is what you are in.
    for (let seed = 0; seed < 300; seed += 1) {
      expect(moonpoolWorld(seed).reach).toBeLessThan(0.8)
      expect(moonpoolWorld(seed).reach).toBeGreaterThan(0.4)
    }
  })

  it('builds a sky with depth rather than a ring of dots', () => {
    const { stars } = moonpoolWorld(0x9001)
    expect(stars.length).toBeGreaterThan(100)
    // Most of the sky is faint; the bright few are what make the rest read as
    // depth rather than as noise.
    const bright = stars.filter((star) => star.magnitude > 0.5).length
    expect(bright).toBeLessThan(stars.length / 2)
    for (const star of stars) {
      expect(star.dist).toBeGreaterThanOrEqual(0)
      expect(star.dist).toBeLessThanOrEqual(1.05)
      expect(star.size).toBeGreaterThan(0)
      expect(star.twinkle).toBeGreaterThan(0)
    }
    // Stratified around the circle, so no two stars land on top of each other.
    const angles = stars.map((star) => star.angle).sort((a, b) => a - b)
    for (let i = 1; i < angles.length; i += 1) {
      expect(angles[i]).toBeGreaterThan(angles[i - 1])
    }
  })

  it('keeps its rare moments extremely rare', () => {
    const counts: Record<string, number> = {}
    const trials = 40_000
    for (let breath = 0; breath < trials; breath += 1) {
      const rarity = moonpoolRarity(0x77aa, breath)
      counts[rarity] = (counts[rarity] ?? 0) + 1
    }
    const rare = trials - (counts.none ?? 0)
    // About one breath in twelve, and rarer than the cathedral's — a shooting
    // star that arrives on schedule is a feature rather than weather.
    expect(rare / trials).toBeGreaterThan(0.05)
    expect(rare / trials).toBeLessThan(0.14)
    for (const kind of ['shooting', 'glass', 'constellation', 'silver', 'moondrift']) {
      expect(counts[kind] ?? 0).toBeGreaterThan(trials * 0.008)
    }
  })

  it('rolls its rarities independently of the cathedral’s', () => {
    // Same seed, same breath, different salt: the two forms must not brighten
    // on the same breaths, or a session that switched form would feel rigged.
    let agree = 0
    for (let breath = 0; breath < 2000; breath += 1) {
      const a = cathedralRarity(5, breath) !== 'none'
      const b = moonpoolRarity(5, breath) !== 'none'
      if (a && b) agree += 1
    }
    // Independent draws at ~16% and ~9% coincide about 1.5% of the time.
    expect(agree / 2000).toBeLessThan(0.05)
  })
})
