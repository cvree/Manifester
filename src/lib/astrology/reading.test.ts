import { describe, expect, it } from 'vitest'
import { buildChart, momentChart, transits } from './chart'
import { readToday, vitalsOf } from './reading'
import { nearestPlace, searchPlaces } from './places'
import { zoneOffsetMinutes, zonedToInstant } from './zone'

/**
 * The reading, and the two things it must never get wrong.
 *
 * It has to be **stable within a day** — somebody who reads it at breakfast
 * and shows a friend at lunch must be shown the same thing — and it has to be
 * **different on a different day**, or the whole feature is a decoration. Those
 * two pull against each other, and everything about how the day key and the
 * hash are built exists to satisfy both.
 */

const LISBON = { latitude: 38.7223, longitude: -9.1393 }

/**
 * A real chart to read against: 14 July 1994, half past three, Lisbon — which
 * is 13:30 UTC, because Portugal was on Central European Time that year. See
 * the time zone test at the bottom of this file.
 */
function natal() {
  return buildChart(new Date('1994-07-14T13:30:00Z'), LISBON, true)
}

describe('a daily reading', () => {
  it('says the same thing all day', () => {
    const chart = natal()
    const morning = readToday(chart, LISBON, new Date('2026-04-02T07:15:00Z'))
    const evening = readToday(chart, LISBON, new Date('2026-04-02T21:40:00Z'))

    expect(evening.affirmation).toBe(morning.affirmation)
    expect(evening.focus.id).toBe(morning.focus.id)
    expect(evening.day).toBe(morning.day)
  })

  it('says something different across a fortnight', () => {
    const chart = natal()
    const headlines = new Set<string>()
    const moons = new Set<string>()

    for (let day = 0; day < 14; day += 1) {
      const at = new Date(Date.UTC(2026, 3, 2 + day, 9, 0))
      const reading = readToday(chart, LISBON, at)
      headlines.add(reading.headline)
      moons.add(reading.moonSentence)
    }

    // The Moon changes sign every two and a half days, so a fortnight cannot
    // produce one description — this is the property that makes checking back
    // on Thursday worth doing.
    expect(moons.size).toBeGreaterThanOrEqual(10)
    expect(headlines.size).toBeGreaterThan(2)
  })

  it('reads differently for two different people on the same day', () => {
    const at = new Date('2026-04-02T09:00:00Z')
    const one = readToday(natal(), LISBON, at)
    const other = readToday(
      buildChart(new Date('1979-11-03T02:10:00Z'), LISBON, true),
      LISBON,
      at,
    )
    // Same sky, different charts — so the contacts to them cannot match.
    expect(other.headline).not.toBe(one.headline)
  })

  it('always lands on an intent and a line the app can actually use', () => {
    for (let day = 0; day < 30; day += 1) {
      const reading = readToday(
        natal(),
        LISBON,
        new Date(Date.UTC(2026, 0, 1 + day, 8, 0)),
      )
      expect(reading.focus.lines).toContain(reading.affirmation)
      expect(reading.affirmation.length).toBeGreaterThan(10)
      expect(reading.weather).not.toContain('undefined')
      expect(reading.headline).not.toContain('undefined')
      for (const highlight of reading.highlights) {
        expect(highlight.body).not.toContain('undefined')
        expect(highlight.title).not.toContain('undefined')
      }
    }
  })

  it('never shows the same transiting body twice', () => {
    for (let day = 0; day < 20; day += 1) {
      const reading = readToday(
        natal(),
        LISBON,
        new Date(Date.UTC(2026, 5, 1 + day, 8, 0)),
      )
      const bodies = reading.highlights.map((entry) => entry.transit.from)
      expect(new Set(bodies).size).toBe(bodies.length)
      expect(bodies.length).toBeLessThanOrEqual(3)
    }
  })

  it('ranks a slow planet above a passing Moon', () => {
    const chart = natal()
    const sky = momentChart(LISBON, new Date('2026-04-02T09:00:00Z'))
    const found = transits(chart, sky)

    const slowest = found.findIndex((transit) =>
      ['saturn', 'uranus', 'neptune', 'pluto'].includes(transit.from),
    )
    const moon = found.findIndex((transit) => transit.from === 'moon')

    // Only meaningful when both are present, which is most days.
    if (slowest >= 0 && moon >= 0) expect(slowest).toBeLessThan(moon)
  })
})

describe('an unknown birth time', () => {
  it('leaves the rising sign out rather than inventing one', () => {
    const blurred = buildChart(new Date('1994-07-14T11:00:00Z'), LISBON, false)
    expect(blurred.ascendant).toBeNull()
    expect(blurred.placements.every((entry) => entry.house === null)).toBe(true)

    const rising = vitalsOf(blurred).find((vital) => vital.label === 'Rising')
    expect(rising?.value).toBe('Unknown')
    expect(rising?.detail).toMatch(/birth time/)

    // And says so about the Moon, which can genuinely be in either of two signs.
    const moon = vitalsOf(blurred).find((vital) => vital.label === 'Moon')
    expect(moon?.detail).toMatch(/Approximate/)
  })

  it('still produces a full reading', () => {
    const blurred = buildChart(new Date('1994-07-14T11:00:00Z'), LISBON, false)
    const reading = readToday(blurred, LISBON, new Date('2026-04-02T09:00:00Z'))
    expect(reading.affirmation).toBeTruthy()
    expect(reading.weather).toBeTruthy()
    // Nothing may claim a contact to an angle that does not exist.
    expect(
      reading.highlights.every(
        (entry) => entry.transit.to !== 'ascendant' && entry.transit.to !== 'midheaven',
      ),
    ).toBe(true)
  })
})

describe('places and their clocks', () => {
  it('finds cities by name and by country', () => {
    expect(searchPlaces('lisb')[0].name).toBe('Lisbon')
    // A prefix match outranks a substring one.
    expect(searchPlaces('san')[0].name).toMatch(/^San/)
    expect(searchPlaces('japan').some((place) => place.country === 'Japan')).toBe(true)
    expect(searchPlaces('x')).toHaveLength(0)
  })

  it('folds accents, so a plain keyboard finds everywhere', () => {
    expect(searchPlaces('sao paulo')[0].name).toBe('Sao Paulo')
  })

  it('finds the nearest listed city to a coordinate', () => {
    expect(nearestPlace(51.4, -0.2).name).toBe('London')
    expect(nearestPlace(-33.9, 151.1).name).toBe('Sydney')
  })

  /**
   * The whole reason birth *place* is asked for rather than just an offset,
   * and the best possible demonstration of it.
   *
   * Portugal spent 1992 to 1996 on **Central European Time** rather than its
   * usual Western European Time — so a Lisbon birth recorded as half past
   * three on a July afternoon in 1994 happened at 13:30 UTC, two hours earlier
   * than the clock said, and one hour earlier than anybody reasoning from
   * "Portugal is on GMT, plus an hour in summer" would conclude.
   *
   * Nobody remembers that. The zone database does, which is why the conversion
   * asks it rather than doing arithmetic. An hour of error is fifteen degrees
   * of Ascendant — half a sign — for every summer birthday in the country in
   * those five years.
   */
  it('applies the time zone rules that were actually in force', () => {
    const summer = zonedToInstant(
      { year: 1994, month: 7, day: 14, hour: 15, minute: 30 },
      'Europe/Lisbon',
    )
    expect(summer.toISOString()).toBe('1994-07-14T13:30:00.000Z')

    const winter = zonedToInstant(
      { year: 1994, month: 1, day: 14, hour: 15, minute: 30 },
      'Europe/Lisbon',
    )
    expect(winter.toISOString()).toBe('1994-01-14T14:30:00.000Z')

    // And by 2026 the country is back on Western European Time.
    expect(
      zonedToInstant(
        { year: 2026, month: 1, day: 14, hour: 15, minute: 30 },
        'Europe/Lisbon',
      ).toISOString(),
    ).toBe('2026-01-14T15:30:00.000Z')
  })

  it('handles half-hour zones and the far side of the date line', () => {
    expect(
      zonedToInstant(
        { year: 1988, month: 3, day: 2, hour: 6, minute: 0 },
        'Asia/Kolkata',
      ).toISOString(),
    ).toBe('1988-03-02T00:30:00.000Z')

    expect(
      zonedToInstant(
        { year: 2001, month: 12, day: 25, hour: 9, minute: 0 },
        'Pacific/Auckland',
      ).toISOString(),
    ).toBe('2001-12-24T20:00:00.000Z')
  })

  it('reports a midnight birth on the right day', () => {
    // `hour: '2-digit'` reports midnight as 24 in some engines, which without
    // care moves the whole chart a day.
    expect(
      zonedToInstant(
        { year: 1990, month: 6, day: 10, hour: 0, minute: 0 },
        'America/New_York',
      ).toISOString(),
    ).toBe('1990-06-10T04:00:00.000Z')
  })

  it('measures an offset the way the zone database does', () => {
    expect(zoneOffsetMinutes('UTC', new Date('2026-01-01T00:00:00Z'))).toBe(0)
    expect(zoneOffsetMinutes('Asia/Kolkata', new Date('2026-01-01T00:00:00Z'))).toBe(330)
    expect(zoneOffsetMinutes('America/New_York', new Date('2026-07-01T00:00:00Z'))).toBe(-240)
    expect(zoneOffsetMinutes('America/New_York', new Date('2026-01-01T00:00:00Z'))).toBe(-300)
  })
})
