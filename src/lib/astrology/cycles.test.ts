import { describe, expect, it } from 'vitest'
import { buildChart, momentChart } from './chart'
import {
  chaptersOf,
  cyclesOf,
  ingressesAhead,
  retrogradesNow,
  solarReturnOf,
  weekAhead,
} from './cycles'
import { julianDay, longitudeOf, moonPhase, separation } from './ephemeris'
import { everyString, PROSE_FAULTS } from './prose'

/**
 * The longer clocks, checked against the arithmetic rather than against
 * themselves.
 *
 * Every date this module produces is a claim about the sky that can be
 * verified by asking the ephemeris where things actually are at that instant —
 * a new moon has to be a new moon to within a few arcminutes, a solar return
 * has to put the Sun back on the natal degree, and a Saturn return has to be
 * a Saturn return. Those are the assertions below, because "the function
 * returned a Date" is not a test of anything.
 */

const LISBON = { latitude: 38.7223, longitude: -9.1393 }
const NOW = new Date('2026-04-02T09:00:00Z')

function natal() {
  return buildChart(new Date('1994-07-14T13:30:00Z'), LISBON, true)
}

describe('the month', () => {
  it('finds a new moon that is actually a new moon', () => {
    const { newMoon } = cyclesOf(natal(), LISBON, NOW)
    const angle = moonPhase(julianDay(newMoon.at)).angle

    expect(newMoon.at.getTime()).toBeGreaterThan(NOW.getTime())
    expect(newMoon.at.getTime() - NOW.getTime()).toBeLessThan(30 * 86_400_000)
    // Elongation from the Sun, wrapped either side of zero.
    expect(Math.min(angle, 360 - angle)).toBeLessThan(0.05)
  })

  it('finds a full moon that is actually full', () => {
    const { fullMoon } = cyclesOf(natal(), LISBON, NOW)
    const phase = moonPhase(julianDay(fullMoon.at))

    expect(Math.abs(phase.angle - 180)).toBeLessThan(0.05)
    expect(phase.illumination).toBeGreaterThan(0.9999)
  })

  it('says which sign and house a lunation lands in', () => {
    const { newMoon, fullMoon } = cyclesOf(natal(), LISBON, NOW)
    for (const lunation of [newMoon, fullMoon]) {
      expect(lunation.sign.name).toBe(
        // The sign of the Moon at that instant, computed independently.
        [
          'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
          'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
        ][Math.floor(longitudeOf('moon', julianDay(lunation.at)) / 30)],
      )
      expect(lunation.house).toBeGreaterThanOrEqual(1)
      expect(lunation.house).toBeLessThanOrEqual(12)
    }
  })
})

describe('the week', () => {
  it('starts today and runs seven days, with exactly one easiest', () => {
    const week = weekAhead(natal(), LISBON, NOW)

    expect(week).toHaveLength(7)
    expect(week[0].at.toDateString()).toBe(NOW.toDateString())
    expect(week.filter((day) => day.best)).toHaveLength(1)

    for (let index = 1; index < week.length; index += 1) {
      const gap = week[index].at.getTime() - week[index - 1].at.getTime()
      // One day apart, give or take an hour for a clock change.
      expect(Math.abs(gap - 86_400_000)).toBeLessThan(2 * 3_600_000)
    }
  })

  it('marks the days the Moon changes sign', () => {
    const week = weekAhead(natal(), LISBON, NOW)
    for (let index = 1; index < week.length; index += 1) {
      expect(week[index].turns).toBe(
        week[index].moonSign.name !== week[index - 1].moonSign.name,
      )
    }
  })
})

describe('the season', () => {
  it('gives every retrograde a date it turns round again', () => {
    const sky = momentChart(LISBON, NOW)
    for (const entry of retrogradesNow(sky)) {
      expect(entry.direct).not.toBeNull()
      expect(entry.direct!.getTime()).toBeGreaterThan(NOW.getTime())
    }
  })

  it('puts the next ingresses in order, in the future, and in the right sign', () => {
    const sky = momentChart(LISBON, NOW)
    const ingresses = ingressesAhead(sky)

    for (const ingress of ingresses) {
      expect(ingress.at.getTime()).toBeGreaterThan(NOW.getTime())
      // Just after the crossing, the body is at the start of the named sign.
      const after = longitudeOf(ingress.body, julianDay(ingress.at) + 0.05)
      expect(Math.floor(after / 30)).toBe(
        [
          'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
          'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
        ].indexOf(ingress.sign.name),
      )
    }

    for (let index = 1; index < ingresses.length; index += 1) {
      expect(ingresses[index].at.getTime()).toBeGreaterThanOrEqual(
        ingresses[index - 1].at.getTime(),
      )
    }
  })
})

describe('the chapters', () => {
  it('finds the Saturn return of somebody who has just had one', () => {
    // Born 1994, so the first Saturn return falls in the mid-2020s.
    const chapters = chaptersOf(natal(), momentChart(LISBON, NOW))
    const saturn = chapters.find((chapter) => chapter.id === 'saturn-return')

    expect(saturn).toBeDefined()
    expect(saturn!.status).toBe('past')
    expect(saturn!.when).toMatch(/202[3-6]/)
  })

  it('puts what is happening now before what is merely coming', () => {
    for (const birth of ['1994-07-14T13:30:00Z', '2001-09-20T18:00:00Z']) {
      const chapters = chaptersOf(
        buildChart(new Date(birth), LISBON, true),
        momentChart(LISBON, NOW),
      )
      const rank = { now: 0, past: 1, coming: 2 }
      for (let index = 1; index < chapters.length; index += 1) {
        expect(rank[chapters[index].status]).toBeGreaterThanOrEqual(
          rank[chapters[index - 1].status],
        )
      }
    }
  })

  it('lands the solar return on the natal degree of the Sun', () => {
    const chart = natal()
    const solar = solarReturnOf(chart, momentChart(LISBON, NOW), NOW)
    const sun = longitudeOf('sun', julianDay(solar.at))
    const natalSun = chart.placements.find((entry) => entry.body === 'sun')!.longitude

    expect(separation(sun, natalSun)).toBeLessThan(0.02)
    // A birthday in July, asked in April.
    expect(solar.at.getMonth()).toBe(6)
    expect(solar.daysAway).toBeGreaterThan(90)
    expect(solar.age).toBe(32)
  })
})

describe('all of it', () => {
  it('writes English', () => {
    for (const birth of [
      '1957-03-02T06:15:00Z',
      '1984-12-19T11:05:00Z',
      '1994-07-14T13:30:00Z',
      '2015-10-27T09:10:00Z',
    ]) {
      const cycles = cyclesOf(buildChart(new Date(birth), LISBON, true), LISBON, NOW)
      for (const text of everyString(cycles)) {
        for (const fault of PROSE_FAULTS) {
          expect(fault.pattern.test(text), `${fault.name}: “${text}”`).toBe(false)
        }
      }
    }
  })
})
