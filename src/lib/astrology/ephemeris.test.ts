import { describe, expect, it } from 'vitest'
import {
  angles,
  isRetrograde,
  julianDay,
  longitudeOf,
  moonLongitude,
  moonPhase,
  nextSignChange,
  planetLongitude,
  separation,
  siderealTime,
  sunLongitude,
} from './ephemeris'
import { aspectBetween, degreeInSign, signOf } from './signs'

/**
 * Checking the sky against the sky.
 *
 * An ephemeris is the rare piece of application code with an external ground
 * truth: the equinox happened at a published minute, the Moon was full at a
 * published minute, and Mercury has never in recorded history appeared more
 * than twenty-eight degrees from the Sun. So none of these tests assert what
 * the code currently returns — every one of them asserts something that was
 * true about the actual solar system before this file existed, which is the
 * only kind of test that can catch a sign error in a rotation matrix.
 */

const utc = (iso: string) => julianDay(new Date(iso))

describe('the Sun', () => {
  /**
   * The equinox is *defined* as the moment solar longitude is exactly zero, so
   * these are not approximations of an observation — they are the answer, and
   * the tolerance is really a statement about how much of the low-precision
   * theory's error is acceptable.
   */
  it('is at zero degrees at the March equinox', () => {
    expect(separation(sunLongitude(utc('2024-03-20T03:06:00Z')), 0)).toBeLessThan(0.02)
    expect(separation(sunLongitude(utc('2025-03-20T09:01:00Z')), 0)).toBeLessThan(0.02)
  })

  it('is at ninety degrees at the June solstice', () => {
    expect(separation(sunLongitude(utc('2024-06-20T20:51:00Z')), 90)).toBeLessThan(0.02)
  })

  it('moves about a degree a day, always forwards', () => {
    for (let day = 0; day < 365; day += 7) {
      const jd = utc('2025-01-01T00:00:00Z') + day
      const step = separation(sunLongitude(jd), sunLongitude(jd + 1))
      expect(step).toBeGreaterThan(0.95)
      expect(step).toBeLessThan(1.03)
    }
  })
})

describe('the Moon', () => {
  it('is opposite the Sun at a full moon', () => {
    // 25 January 2024, 17:54 UTC.
    const phase = moonPhase(utc('2024-01-25T17:54:00Z'))
    expect(separation(phase.angle, 180)).toBeLessThan(0.6)
    expect(phase.illumination).toBeGreaterThan(0.999)
    expect(phase.name).toBe('Full Moon')
  })

  it('is conjunct the Sun at a new moon', () => {
    // 11 January 2024, 11:57 UTC.
    const phase = moonPhase(utc('2024-01-11T11:57:00Z'))
    expect(Math.min(phase.angle, 360 - phase.angle)).toBeLessThan(0.6)
    expect(phase.illumination).toBeLessThan(0.0001)
  })

  /**
   * Averaged over a year rather than checked across one lap, and the reason is
   * physics rather than tolerance-fudging: the Moon's speed varies by about
   * ten per cent between perigee and apogee, so it is genuinely a degree or
   * two from where a uniform lap would put it after exactly one sidereal
   * month. What is constant is the *mean* motion, and that is what the mean
   * longitude term in the series is claiming to be right about.
   */
  it('averages the Moon’s known mean motion of 13.176 degrees a day', () => {
    /*
     * Twenty years, because a shorter span does not wash the periodic terms
     * out: the largest of them is over six degrees, and whatever it happens to
     * be at each end of the window is divided by however many days are in it.
     * Across seven thousand days that residual is a thousandth of a degree.
     */
    const start = utc('2010-01-01T00:00:00Z')
    const days = 7300
    let travelled = 0
    for (let day = 0; day < days; day += 1) {
      travelled += ((moonLongitude(start + day + 1) - moonLongitude(start + day) + 540) % 360) - 180
    }
    expect(travelled / days).toBeCloseTo(13.176, 2)
  })

  it('never goes backwards', () => {
    for (let step = 0; step < 120; step += 1) {
      const jd = utc('2026-01-01T00:00:00Z') + step * 0.25
      const moved = ((moonLongitude(jd + 0.25) - moonLongitude(jd) + 540) % 360) - 180
      expect(moved).toBeGreaterThan(0)
    }
  })
})

describe('the planets', () => {
  /**
   * The strongest available test of the whole heliocentric-to-geocentric
   * pipeline, and it needs no reference table at all.
   *
   * Mercury and Venus are inside the Earth's orbit, so from here they can
   * never appear far from the Sun — a maximum elongation of about 28° and 47°
   * respectively, fixed by the geometry of their orbits. Any error in the
   * Kepler solve, the rotation out of the orbital plane, or the subtraction of
   * the Earth's position would put them somewhere impossible within a year of
   * samples.
   */
  it('keeps the inner planets near the Sun, where geometry requires', () => {
    let mercury = 0
    let venus = 0

    for (let day = 0; day < 3650; day += 5) {
      const jd = utc('2020-01-01T00:00:00Z') + day
      const sun = sunLongitude(jd)
      mercury = Math.max(mercury, separation(planetLongitude('mercury', jd), sun))
      venus = Math.max(venus, separation(planetLongitude('venus', jd), sun))
    }

    expect(mercury).toBeGreaterThan(17)
    expect(mercury).toBeLessThan(29)
    expect(venus).toBeGreaterThan(44)
    expect(venus).toBeLessThan(48.5)
  })

  it('moves the outer planets slowly, as their periods demand', () => {
    const jd = utc('2026-03-01T00:00:00Z')
    // Degrees per day, at most, including the apparent motion from our own orbit.
    const limits: Record<string, number> = {
      jupiter: 0.25,
      saturn: 0.14,
      uranus: 0.07,
      neptune: 0.04,
      pluto: 0.04,
    }
    for (const [planet, limit] of Object.entries(limits)) {
      expect(separation(planetLongitude(planet, jd), planetLongitude(planet, jd + 1))).toBeLessThan(
        limit,
      )
    }
  })

  it('finds retrogrades, and only for the right bodies', () => {
    const jd = utc('2026-02-01T00:00:00Z')
    expect(isRetrograde('sun', jd)).toBe(false)
    expect(isRetrograde('moon', jd)).toBe(false)
    expect(isRetrograde('node', jd)).toBe(true)

    /*
     * Mercury retrogrades three or four times a year, for about three weeks
     * each time — roughly a fifth of all days. Sampling a whole year and
     * finding a share in that neighbourhood is a much stronger check than
     * asserting one date, and it cannot pass by accident.
     */
    let backwards = 0
    for (let day = 0; day < 365; day += 1) {
      if (isRetrograde('mercury', utc('2025-01-01T00:00:00Z') + day)) backwards += 1
    }
    expect(backwards / 365).toBeGreaterThan(0.13)
    expect(backwards / 365).toBeLessThan(0.28)
  })
})

describe('the horizon', () => {
  /**
   * Two positions where the answer is exact and can be stated without an
   * ephemeris at all. Standing on the equator with the equinox point
   * culminating, the point rising is the solstice point ninety degrees on;
   * with the solstice point culminating, it is the autumn equinox. Both fall
   * straight out of the geometry, and both are wrong the moment a sign is
   * flipped anywhere in the derivation.
   */
  it('puts known degrees on the horizon at the equator', () => {
    const jd = 2451545
    // Choose the meridian that places 0° Aries exactly on the Midheaven.
    const atAries = angles(jd, 0, -siderealTime(jd))
    expect(separation(atAries.midheaven, 0)).toBeLessThan(0.001)
    expect(separation(atAries.ascendant, 90)).toBeLessThan(0.001)

    const atCancer = angles(jd, 0, 90 - siderealTime(jd))
    expect(separation(atCancer.midheaven, 90)).toBeLessThan(0.001)
    expect(separation(atCancer.ascendant, 180)).toBeLessThan(0.001)
  })

  /**
   * The strongest test in the file.
   *
   * The Ascendant is the ecliptic degree on the eastern horizon, and at
   * sunrise the Sun is on the eastern horizon — so the moment the Ascendant
   * passes the Sun's longitude *is* sunrise, by definition. London's sunrise
   * on the June solstice is a published fact, near 03:43 UTC, and geometric
   * sunrise ignoring refraction and the Sun's own width lands a few minutes
   * after it. Nothing about that number came from this code.
   */
  it('crosses the Sun at sunrise, on the morning it should', () => {
    const midnight = utc('2026-06-21T00:00:00Z')
    let crossing: number | null = null

    for (let minute = 0; minute < 24 * 60; minute += 1) {
      const jd = midnight + minute / 1440
      if (separation(angles(jd, 51.5074, -0.1278).ascendant, sunLongitude(jd)) < 0.2) {
        crossing = minute / 60
        break
      }
    }

    expect(crossing).not.toBeNull()
    expect(crossing!).toBeGreaterThan(3.4)
    expect(crossing!).toBeLessThan(4.2)
  })

  it('moves the Ascendant right around the zodiac in a day', () => {
    const seen = new Set<string>()
    for (let hour = 0; hour < 24; hour += 1) {
      const { ascendant } = angles(2460000 + hour / 24, 51.5, -0.13)
      seen.add(signOf(ascendant).name)
    }
    // Every sign rises once a day from anywhere the horizon crosses them all.
    expect(seen.size).toBe(12)
  })

  it('depends on where you are standing', () => {
    const jd = utc('1994-07-14T15:30:00Z')
    const london = angles(jd, 51.5074, -0.1278).ascendant
    const sydney = angles(jd, -33.8688, 151.2093).ascendant
    expect(separation(london, sydney)).toBeGreaterThan(20)
  })
})

describe('signs and aspects', () => {
  it('divides the circle into twelve', () => {
    expect(signOf(0).name).toBe('Aries')
    expect(signOf(29.99).name).toBe('Aries')
    expect(signOf(30).name).toBe('Taurus')
    expect(signOf(210).name).toBe('Scorpio')
    expect(signOf(359.9).name).toBe('Pisces')
    expect(signOf(-1).name).toBe('Pisces')
    expect(degreeInSign(218.5)).toBeCloseTo(8.5, 6)
  })

  it('finds aspects at the angle they are named for, and across zero', () => {
    expect(aspectBetween(0, 0)?.kind.id).toBe('conjunction')
    expect(aspectBetween(10, 190)?.kind.id).toBe('opposition')
    expect(aspectBetween(10, 130)?.kind.id).toBe('trine')
    expect(aspectBetween(350, 80)?.kind.id).toBe('square')
    // 355 and 55 are sixty degrees apart the short way round.
    expect(aspectBetween(355, 55)?.kind.id).toBe('sextile')
    expect(aspectBetween(0, 45)).toBeNull()
  })

  it('reports how far from exact, symmetrically', () => {
    const forward = aspectBetween(0, 122)
    const backward = aspectBetween(122, 0)
    expect(forward?.orb).toBeCloseTo(2, 6)
    expect(backward?.orb).toBeCloseTo(2, 6)
  })
})

describe('sign changes', () => {
  it('finds the moment the Moon crosses, and it is a real crossing', () => {
    const jd = utc('2026-04-02T00:00:00Z')
    const change = nextSignChange('moon', jd, 3)
    expect(change).not.toBeNull()

    const before = signOf(longitudeOf('moon', change! - 0.002))
    const after = signOf(longitudeOf('moon', change! + 0.002))
    expect(before.name).not.toBe(after.name)
    // And it is within the two and a half days the Moon takes to cross a sign.
    expect(change! - jd).toBeLessThanOrEqual(3)
  })

  it('says nothing rather than guessing for the slow ones', () => {
    // Pluto spends over a decade in a sign; nothing happens in three days.
    expect(nextSignChange('pluto', utc('2026-06-01T00:00:00Z'), 3)).toBeNull()
  })
})
