/**
 * The void-of-course Moon: the one piece of classical timing that is worth
 * the arithmetic.
 *
 * ── What it actually is ─────────────────────────────────────────────────────
 *
 * The Moon spends about two and a half days in a sign, making contacts to the
 * other planets as it goes. At some point it makes its **last** one, and then
 * travels the rest of the sign touching nothing at all. That stretch is called
 * void of course, and it is the only prediction in traditional astrology that
 * is purely geometric: there is no interpretation in it, no ambiguity about
 * when it starts, and two astrologers with the same ephemeris get the same
 * minute.
 *
 * ── Why it is in here ───────────────────────────────────────────────────────
 *
 * Because it is the single most *practical* thing this feature can tell
 * somebody, and almost no app computes it — the ones that do put it behind a
 * subscription. The traditional advice is narrow and unusually testable: it is
 * a poor stretch for launching a thing you want to go somewhere, and a good
 * one for finishing, tidying, resting and everything that was already decided.
 * A person can check that against their own week.
 *
 * ── The honest edge ─────────────────────────────────────────────────────────
 *
 * The screen says what this is and does not dress it up as a warning. A void
 * Moon is not a bad hour, and nothing here will ever tell somebody not to do
 * something. It says: nothing further is being asked of you until the Moon
 * changes sign, which is genuinely useful information about a Tuesday.
 */

import type { Chart } from './chart'
import {
  fromJulianDay,
  longitudeOf,
  nextSignChange,
  separation,
  type Body,
} from './ephemeris'
import { signOf, type Sign } from './signs'

/**
 * What the Moon is measured against.
 *
 * The classical definition uses the seven visible bodies; modern software
 * generally includes the three outer planets, which makes voids shorter and,
 * on the evidence of anybody who has watched a Mercury station, no less real.
 * The modern set is used here, and the interface says which contacts ended it.
 */
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

/** The Ptolemaic five. A quincunx does not end a void and never has. */
const ANGLES = [0, 60, 90, 120, 180]

/** Ten minutes, in days. Fine enough that the Moon cannot skip an aspect. */
const STEP = 1 / 144

export interface VoidMoon {
  /** The last exact contact the Moon makes in this sign. */
  from: Date
  /** The sign change, which ends it. */
  to: Date
  /** The sign the Moon moves into. */
  into: Sign
  /** "its last contact — a trine to Venus" */
  after: string
  /** How long the stretch runs, in hours. */
  hours: number
}

/** The signed distance from an exact aspect, in degrees. */
function offsets(jd: number): number[] {
  const moon = longitudeOf('moon', jd)
  const found: number[] = []
  for (const body of TARGETS) {
    const gap = separation(moon, longitudeOf(body, jd))
    for (const angle of ANGLES) found.push(gap - angle)
  }
  return found
}

/** Which target and angle a crossing at index `slot` belongs to. */
function describe(slot: number): { body: Body; angle: number } {
  return {
    body: TARGETS[Math.floor(slot / ANGLES.length)],
    angle: ANGLES[slot % ANGLES.length],
  }
}

const ASPECT_WORD: Record<number, string> = {
  0: 'a conjunction with',
  60: 'a sextile to',
  90: 'a square to',
  120: 'a trine to',
  180: 'an opposition to',
}

const BODY_WORD: Record<Body, string> = {
  sun: 'the Sun',
  moon: 'the Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
  node: 'the north node',
}

/**
 * The current or next void stretch, found by walking backwards from the sign
 * change.
 *
 * Backwards, because the *last* exact contact before the ingress is what opens
 * the void — so the first crossing found on the way back is the answer, and
 * the search stops there. On an ordinary day that is a few dozen samples; the
 * worst case, a Moon that goes void the moment it enters a sign, is a couple
 * of hundred. Either is microseconds.
 *
 * Returns `null` when the sign change is further off than `within` days, or
 * when the stretch is too short to be worth a sentence.
 */
export function voidOfCourse(sky: Chart, within = 2.6): VoidMoon | null {
  const ingress = nextSignChange('moon', sky.julian, within)
  if (ingress == null) return null

  let later = offsets(ingress)

  for (let step = 1; step * STEP <= within; step += 1) {
    const at = ingress - step * STEP
    const earlier = offsets(at)

    /* The latest crossing inside this ten minutes, whichever slot it is in. */
    let best: { jd: number; slot: number } | null = null

    for (let slot = 0; slot < earlier.length; slot += 1) {
      const before = earlier[slot]
      const after = later[slot]
      if (before === 0) {
        if (!best || at > best.jd) best = { jd: at, slot }
        continue
      }
      if (before > 0 === after > 0) continue

      /* Bisect the ten minutes down to under a second. */
      let low = at
      let high = at + STEP
      for (let pass = 0; pass < 24; pass += 1) {
        const middle = (low + high) / 2
        const value = offsets(middle)[slot]
        if (value > 0 === before > 0) low = middle
        else high = middle
      }
      if (!best || high > best.jd) best = { jd: high, slot }
    }

    if (best) {
      const contact = describe(best.slot)
      const from = fromJulianDay(best.jd)
      const to = fromJulianDay(ingress)
      const hours = (to.getTime() - from.getTime()) / 3_600_000
      /* Under twenty minutes is a rounding error, not a stretch of a day. */
      if (hours < 1 / 3) return null
      return {
        from,
        to,
        into: signOf(longitudeOf('moon', ingress + 0.01)),
        after: `${ASPECT_WORD[contact.angle]} ${BODY_WORD[contact.body]}`,
        hours,
      }
    }

    later = earlier
  }

  return null
}

/**
 * The void as a sentence, or `null` when it does not touch the day being read.
 *
 * A void that runs from two in the morning until six is real and is not worth
 * a line on a screen somebody reads at breakfast, so the overlap is checked
 * against the waking day rather than the calendar one.
 */
export function voidToday(sky: Chart, day: Date): VoidMoon | null {
  const stretch = voidOfCourse(sky)
  if (!stretch) return null

  const wakes = new Date(day)
  wakes.setHours(6, 0, 0, 0)
  const sleeps = new Date(day)
  sleeps.setHours(23, 59, 0, 0)

  if (stretch.to <= wakes || stretch.from >= sleeps) return null
  return stretch
}

/**
 * The Moon's speed today, in degrees a day.
 *
 * Shown in the workings, because it is the number the whole day rests on: the
 * hours, the ingress and the void are all consequences of how fast the Moon is
 * moving, and it varies by two whole degrees a day between perigee and apogee.
 * Unwrapped across the 360° seam, or the answer once a month is −347.
 */
export function moonMotion(sky: Chart): number {
  const raw =
    longitudeOf('moon', sky.julian + 0.5) - longitudeOf('moon', sky.julian - 0.5)
  return raw < 0 ? raw + 360 : raw
}
