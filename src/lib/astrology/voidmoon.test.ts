import { describe, expect, it } from 'vitest'
import { momentChart } from './chart'
import { longitudeOf, separation, type Body } from './ephemeris'
import { signOf } from './signs'
import { voidOfCourse, voidToday, moonMotion } from './voidmoon'

/**
 * The void Moon, checked as geometry rather than as prose.
 *
 * This is the one claim in the whole feature that is falsifiable to the
 * minute, which means it is also the one that can be tested properly: if the
 * Moon makes an exact aspect *inside* a stretch this file called void, the
 * stretch is wrong, and no amount of well-written copy around it helps. So the
 * test re-derives the aspects independently, by sampling.
 */

const LISBON = { latitude: 38.7223, longitude: -9.1393 }

const TARGETS: Body[] = [
  'sun',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
]
const ANGLES = [0, 60, 90, 120, 180]

/** Every offset from an exact aspect at one instant. */
function offsets(jd: number): number[] {
  const moon = longitudeOf('moon', jd)
  return TARGETS.flatMap((body) => {
    const gap = separation(moon, longitudeOf(body, jd))
    return ANGLES.map((angle) => gap - angle)
  })
}

function julian(at: Date): number {
  return at.getTime() / 86_400_000 + 2440587.5
}

describe('the void-of-course Moon', () => {
  it('finds a stretch that really has no contacts in it', () => {
    let found = 0

    for (let day = 0; day < 45; day += 1) {
      const at = new Date(Date.UTC(2026, 0, 5 + day, 12, 0))
      const stretch = voidOfCourse(momentChart(LISBON, at))
      if (!stretch) continue
      found += 1

      expect(stretch.from.getTime()).toBeLessThan(stretch.to.getTime())

      /*
       * Sampled every twelve minutes from just after the last contact to just
       * before the ingress. Nothing may cross zero in between — if anything
       * does, the Moon made an aspect inside a stretch we called empty.
       */
      const start = julian(stretch.from) + 1 / 288
      const end = julian(stretch.to) - 1 / 288
      let previous = offsets(start)
      for (let jd = start + 1 / 120; jd < end; jd += 1 / 120) {
        const current = offsets(jd)
        for (let slot = 0; slot < current.length; slot += 1) {
          expect(
            current[slot] > 0 === previous[slot] > 0,
            `an aspect went exact inside the void on ${stretch.from.toISOString()}`,
          ).toBe(true)
        }
        previous = current
      }
    }

    // Voids happen roughly every two and a half days, so a month and a half
    // has to contain a good few of them or the search is broken.
    expect(found).toBeGreaterThan(10)
  })

  it('ends exactly where the Moon changes sign', () => {
    for (let day = 0; day < 30; day += 1) {
      const at = new Date(Date.UTC(2026, 5, 1 + day, 12, 0))
      const stretch = voidOfCourse(momentChart(LISBON, at))
      if (!stretch) continue

      const before = signOf(longitudeOf('moon', julian(stretch.to) - 1 / 1440))
      const after = signOf(longitudeOf('moon', julian(stretch.to) + 1 / 1440))
      expect(before.name).not.toBe(after.name)
      expect(after.name).toBe(stretch.into.name)
      expect(stretch.hours).toBeGreaterThan(1 / 3)
    }
  })

  it('names the contact that closed the sign', () => {
    for (let day = 0; day < 20; day += 1) {
      const at = new Date(Date.UTC(2026, 8, 1 + day, 12, 0))
      const stretch = voidOfCourse(momentChart(LISBON, at))
      if (!stretch) continue
      expect(stretch.after).toMatch(
        /^(a conjunction with|a sextile to|a square to|a trine to|an opposition to) /,
      )
    }
  })

  it('only reports a stretch that touches the waking day', () => {
    for (let day = 0; day < 30; day += 1) {
      const at = new Date(Date.UTC(2026, 2, 1 + day, 12, 0))
      const noon = new Date(at)
      noon.setHours(12, 0, 0, 0)
      const stretch = voidToday(momentChart(LISBON, noon), noon)
      if (!stretch) continue

      const wakes = new Date(noon)
      wakes.setHours(6, 0, 0, 0)
      const sleeps = new Date(noon)
      sleeps.setHours(23, 59, 0, 0)
      expect(stretch.to.getTime()).toBeGreaterThan(wakes.getTime())
      expect(stretch.from.getTime()).toBeLessThan(sleeps.getTime())
    }
  })

  it('has the Moon moving forwards, at somewhere near its real speed', () => {
    for (let day = 0; day < 40; day += 1) {
      const speed = moonMotion(
        momentChart(LISBON, new Date(Date.UTC(2026, 1, 1 + day, 12, 0))),
      )
      // The Moon covers between about 11.8° and 15.4° a day, and never less.
      expect(speed).toBeGreaterThan(11)
      expect(speed).toBeLessThan(16)
    }
  })
})
