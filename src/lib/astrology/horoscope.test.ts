import { describe, expect, it } from 'vitest'
import { buildChart } from './chart'
import { horoscopeOf, noonOf } from './horoscope'
import { everyString, PROSE_FAULTS } from './prose'

/**
 * The daily horoscope, and the three promises it makes by being called daily.
 *
 * It must say the **same thing all day** — somebody who reads it at breakfast
 * and shows a friend at lunch has to be shown the same reading. It must say
 * something **different tomorrow**, or the feature is a decoration. And it must
 * never produce a sentence that gives away that it was assembled rather than
 * written, which is what the prose guards are for.
 */

const LISBON = { latitude: 38.7223, longitude: -9.1393 }

function natal() {
  return buildChart(new Date('1994-07-14T13:30:00Z'), LISBON, true)
}

describe('the daily horoscope', () => {
  it('says the same thing from waking to sleeping', () => {
    const chart = natal()
    const morning = horoscopeOf(chart, LISBON, new Date('2026-04-02T07:15:00Z'))
    const evening = horoscopeOf(chart, LISBON, new Date('2026-04-02T21:40:00Z'))

    expect(evening.overview).toEqual(morning.overview)
    expect(evening.dials).toEqual(morning.dials)
    expect(evening.skyLine).toBe(morning.skyLine)
    expect(evening.doThis).toBe(morning.doThis)
    // The hours are Date objects for the same local stretches.
    expect(evening.hours.map((band) => band.note)).toEqual(
      morning.hours.map((band) => band.note),
    )
  })

  it('is visibly different across a fortnight', () => {
    const chart = natal()
    const openings = new Set<string>()
    const lines = new Set<string>()

    for (let day = 0; day < 14; day += 1) {
      const horoscope = horoscopeOf(
        chart,
        LISBON,
        new Date(Date.UTC(2026, 3, 2 + day, 9, 0)),
      )
      openings.add(horoscope.overview[0])
      lines.add(horoscope.skyLine)
    }

    // The Moon changes sign every two and a half days, so a fortnight cannot
    // produce one opening paragraph.
    expect(openings.size).toBeGreaterThanOrEqual(6)
    expect(lines.size).toBeGreaterThan(1)
  })

  it('keeps the dials honest — never a zero, never a hundred', () => {
    for (let day = 0; day < 40; day += 1) {
      const horoscope = horoscopeOf(
        natal(),
        LISBON,
        new Date(Date.UTC(2026, 0, 3 + day, 9, 0)),
      )
      for (const dial of horoscope.dials) {
        expect(Number.isInteger(dial.value)).toBe(true)
        expect(dial.value).toBeGreaterThanOrEqual(12)
        expect(dial.value).toBeLessThanOrEqual(92)
      }
    }
  })

  it('never prints the same hour twice in a row', () => {
    /*
     * The Moon can hold one aspect all day, and the naive version of this
     * screen then prints an identical sentence six times — which reads as a
     * bug even though the astrology is right.
     */
    for (let day = 0; day < 20; day += 1) {
      const horoscope = horoscopeOf(
        natal(),
        LISBON,
        new Date(Date.UTC(2026, 5, 1 + day, 9, 0)),
      )
      expect(horoscope.hours).toHaveLength(6)
      for (let index = 1; index < horoscope.hours.length; index += 1) {
        expect(horoscope.hours[index].note).not.toBe(horoscope.hours[index - 1].note)
      }
    }
  })

  it('puts the power window inside the day it belongs to', () => {
    for (let day = 0; day < 20; day += 1) {
      const at = new Date(Date.UTC(2026, 8, 1 + day, 9, 0))
      const horoscope = horoscopeOf(natal(), LISBON, at)
      if (!horoscope.power) continue
      expect(horoscope.power.from.getTime()).toBeLessThan(
        horoscope.power.to.getTime(),
      )
      expect(horoscope.power.from.toDateString()).toBe(noonOf(at).toDateString())
    }
  })

  it('writes English, for every chart and every day it is asked about', () => {
    const charts = [
      buildChart(new Date('1994-07-14T13:30:00Z'), LISBON, true),
      buildChart(new Date('1966-02-11T04:00:00Z'), LISBON, true),
      buildChart(new Date('2001-09-20T18:00:00Z'), null, false),
    ]

    for (const chart of charts) {
      for (let day = 0; day < 30; day += 1) {
        const horoscope = horoscopeOf(
          chart,
          LISBON,
          new Date(Date.UTC(2026, 2, 1 + day, 9, 0)),
        )
        for (const text of everyString(horoscope)) {
          for (const fault of PROSE_FAULTS) {
            expect(
              fault.pattern.test(text),
              `${fault.name}: “${text}”`,
            ).toBe(false)
          }
        }
      }
    }
  })

  it('hands the share sheet something worth pasting', () => {
    const horoscope = horoscopeOf(natal(), LISBON, new Date('2026-04-02T09:00:00Z'))
    expect(horoscope.shareText).toContain(horoscope.reading.affirmation)
    expect(horoscope.shareText).toContain(horoscope.reading.headline)
    expect(horoscope.shareText.split('\n').length).toBeGreaterThan(5)
  })
})
