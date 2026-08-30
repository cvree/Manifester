/**
 * Time, at every scale a person actually lives at.
 *
 * ── Why a daily reading is not enough ───────────────────────────────────────
 *
 * Because almost nothing that matters happens in a day. The things people come
 * to astrology carrying — am I in the middle of something, is this stretch
 * going to end, why has this year been like this — are questions about *arcs*,
 * and a feature that can only answer "what is today like" quietly teaches
 * somebody that the whole thing is trivia.
 *
 * So this file computes the four longer clocks:
 *
 *  · **The month.** Where the Moon is in its cycle, and the exact instant of
 *    the next new and full Moon, with the sign and house each one lands in.
 *  · **The week.** Seven days ahead, each with its Moon sign, its phase and
 *    its own temper, so somebody can see on Monday that Thursday is the open
 *    one and put the difficult conversation there.
 *  · **The season.** Which planets are retrograde, when each one turns around
 *    again, and which sign the fast movers cross into next.
 *  · **The chapter.** Saturn returns, Jupiter returns, the nodal return, the
 *    Uranus opposition — the handful of genuinely once-or-twice-a-life transits
 *    that people recognise the moment they are named, because they are almost
 *    always already in the middle of one.
 *
 * ── Everything here is arithmetic ───────────────────────────────────────────
 *
 * Every date below is found by walking the same series the rest of the feature
 * uses and bisecting on a sign change or an exact angle. Nothing is looked up
 * and nothing is approximated from an average period, which is why the new
 * moon time is right to the minute and why the Saturn return window is this
 * person's rather than "around twenty-nine".
 */

import { momentChart, placementOf, type Chart, type Where } from './chart'
import {
  angleDelta,
  fromJulianDay,
  isRetrograde,
  julianDay,
  longitudeOf,
  moonPhase,
  nextSignChange,
  norm360,
  separation,
  type Body,
} from './ephemeris'
import { BODY_PROFILES, formatShort, signOf, type Sign } from './signs'
import { BODY_LORE, houseOf, ORDINALS, phaseLore, SIGN_LORE, type PhaseLore } from './lore'
import { readToday } from './reading'
import { noonOf } from './horoscope'

/* ── Where the Moon is in its month ──────────────────────────── */

export interface PhaseNow {
  name: string
  illumination: number
  /** 0–1 through the cycle, for the ring. */
  cycle: number
  waxing: boolean
  sign: Sign
  lore: PhaseLore
}

export function phaseNow(sky: Chart): PhaseNow {
  return {
    name: sky.phase.name,
    illumination: sky.phase.illumination,
    cycle: sky.phase.cycle,
    waxing: sky.phase.waxing,
    sign: placementOf(sky, 'moon').sign,
    lore: phaseLore(sky.phase.name),
  }
}

/* ── The next new and full Moon ──────────────────────────────── */

export interface Lunation {
  kind: 'new' | 'full'
  at: Date
  sign: Sign
  longitude: number
  /** Whole-sign house in the natal chart, when there is a birth time. */
  house: number | null
  /** What this one is for. */
  text: string
  /** A natal point it lands on, if it lands on one. */
  touching: string | null
}

/**
 * The instant of the next new or full Moon.
 *
 * The elongation of the Moon from the Sun climbs from 0° to 360° over roughly
 * 29.5 days, so a new Moon is a wrap of that angle and a full Moon is its
 * crossing of 180°. Both are found by stepping six hours at a time until the
 * crossing is bracketed and then halving forty times, which lands inside a
 * second — far finer than anything the text does with it, and free.
 */
function nextLunation(from: Date, kind: 'new' | 'full'): Date {
  const target = kind === 'new' ? 0 : 180
  const startJd = julianDay(from)

  /* Distance to the target angle, always measured forwards. */
  const gap = (jd: number) => norm360(moonPhase(jd).angle - target)

  let low = startJd
  let high = startJd
  const step = 0.25

  // Walk forward until the "distance to go" wraps — that wrap is the crossing.
  while (high < startJd + 32) {
    const next = high + step
    if (gap(next) < gap(high) && gap(high) > 180) {
      low = high
      high = next
      break
    }
    high = next
    low = high - step
  }

  for (let pass = 0; pass < 40; pass += 1) {
    const middle = (low + high) / 2
    if (gap(middle) > 180) low = middle
    else high = middle
  }

  return fromJulianDay(high)
}

/** The natal points a lunation is worth checking against. */
const LUNATION_TARGETS: { point: Body | 'ascendant' | 'midheaven'; label: string }[] = [
  { point: 'sun', label: 'Sun' },
  { point: 'moon', label: 'Moon' },
  { point: 'mercury', label: 'Mercury' },
  { point: 'venus', label: 'Venus' },
  { point: 'mars', label: 'Mars' },
  { point: 'ascendant', label: 'Ascendant' },
  { point: 'midheaven', label: 'Midheaven' },
]

function lunationOf(natal: Chart, from: Date, kind: 'new' | 'full'): Lunation {
  const at = nextLunation(from, kind)
  const longitude = longitudeOf('moon', julianDay(at))
  const sign = signOf(longitude)

  const ascendantSign = natal.ascendant != null ? Math.floor(natal.ascendant / 30) : null
  const house =
    ascendantSign == null
      ? null
      : ((Math.floor(longitude / 30) - ascendantSign + 12) % 12) + 1

  let touching: string | null = null
  for (const target of LUNATION_TARGETS) {
    const natalLongitude =
      target.point === 'ascendant'
        ? natal.ascendant
        : target.point === 'midheaven'
          ? natal.midheaven
          : placementOf(natal, target.point).longitude
    if (natalLongitude == null) continue
    if (separation(longitude, natalLongitude) <= 4) {
      touching = target.label
      break
    }
  }

  const signLore = SIGN_LORE[sign.name]
  const houseText =
    house != null
      ? ` It falls in your ${ORDINALS[house - 1]} house — ${houseOf(house).domain}.`
      : ''

  const text =
    kind === 'new'
      ? `A new moon in ${sign.name} at ${formatShort(longitude)}. New moons are the quietest, most private starting point in the month, and this one starts in ${sign.name}'s register: ${signLore.through}.${houseText}${
          touching ? ` It lands on your natal ${touching}, which makes this a personal one rather than a general one.` : ''
        }`
      : `A full moon in ${sign.name} at ${formatShort(longitude)}. Full moons show you what is already true; this one shows it in ${sign.name}'s terms — ${signLore.keyword.toLowerCase()}.${houseText}${
          touching ? ` It lands on your natal ${touching}, so expect this one to be felt rather than observed.` : ''
        }`

  return { kind, at, sign, longitude, house, text, touching }
}

/* ── The week ahead ──────────────────────────────────────────── */

export interface DayAhead {
  at: Date
  /** "Thu" */
  weekday: string
  /** "14" */
  dayNumber: string
  moonSign: Sign
  phaseName: string
  illumination: number
  /** 0–1 through the lunar month, for drawing the disc. */
  cycle: number
  /** The day's one-word temper, from the same ranking the reading uses. */
  word: string
  /** -1…1, for the shape of the strip. */
  score: number
  headline: string
  /** True on the easiest day of the seven. */
  best: boolean
  /** True where the Moon changes sign. */
  turns: boolean
}

const WORD_SCORE: Record<string, number> = {
  Open: 0.8,
  Mixed: 0.1,
  Quiet: 0.35,
  Charged: -0.5,
  Deep: -0.15,
}

/**
 * Seven days, each read the same way today is.
 *
 * This is the part that turns a horoscope into a planner. Somebody who can see
 * on Monday that Thursday is the open day and Friday is the charged one has
 * been given something genuinely useful to do with the information, and it
 * costs seven runs of a series that takes microseconds.
 */
export function weekAhead(natal: Chart, where: Where | null, from: Date): DayAhead[] {
  const days: DayAhead[] = []

  for (let offset = 0; offset < 7; offset += 1) {
    const at = noonOf(new Date(from.getTime() + offset * 86_400_000))
    const reading = readToday(natal, where, at)
    const sky = momentChart(where, at)
    const moon = placementOf(sky, 'moon')

    const yesterday = days.at(-1)

    days.push({
      at,
      weekday: at.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNumber: String(at.getDate()),
      moonSign: moon.sign,
      phaseName: sky.phase.name,
      illumination: sky.phase.illumination,
      cycle: sky.phase.cycle,
      word: reading.weatherWord,
      score: WORD_SCORE[reading.weatherWord] ?? 0,
      headline: reading.headline,
      best: false,
      turns: yesterday ? yesterday.moonSign.name !== moon.sign.name : false,
    })
  }

  let bestIndex = 0
  days.forEach((day, index) => {
    if (day.score > days[bestIndex].score) bestIndex = index
  })
  days[bestIndex].best = true

  return days
}

/* ── Retrogrades ─────────────────────────────────────────────── */

export interface RetrogradeNote {
  body: Body
  /** When it turns direct again, if that is inside the next half year. */
  direct: Date | null
  /** What this retrograde is asking for. */
  text: string
}

/** When a body that is retrograde now next turns direct. */
function nextDirect(body: Body, from: number): Date | null {
  let low = from
  for (let jd = from; jd < from + 220; jd += 1) {
    if (!isRetrograde(body, jd)) {
      let high = jd
      for (let pass = 0; pass < 24; pass += 1) {
        const middle = (low + high) / 2
        if (isRetrograde(body, middle)) low = middle
        else high = middle
      }
      return fromJulianDay(high)
    }
    low = jd
  }
  return null
}

const RETROGRADE_BODIES: Body[] = [
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
]

export function retrogradesNow(sky: Chart): RetrogradeNote[] {
  return RETROGRADE_BODIES.filter((body) => isRetrograde(body, sky.julian)).map((body) => ({
    body,
    direct: nextDirect(body, sky.julian),
    text: `${BODY_PROFILES[body].name} retrograde asks for ${
      BODY_LORE[body].retrograde ?? 'a second pass over ground already covered'
    }`,
  }))
}

/* ── What crosses into a new sign next ───────────────────────── */

export interface Ingress {
  body: Body
  at: Date
  sign: Sign
  text: string
}

const INGRESS_BODIES: Body[] = ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']

/**
 * The next sign change for each of the fast and middling bodies.
 *
 * The Sun's is the one everybody already half-knows — it is the start of the
 * next "season" and of the twelve birthdays that go with it — and the rest are
 * the actual texture of a month: Venus changing sign changes what a fortnight
 * finds pleasant, and Mars changing sign changes what it is willing to work at.
 */
export function ingressesAhead(sky: Chart, withinDays = 75): Ingress[] {
  const found: Ingress[] = []

  for (const body of INGRESS_BODIES) {
    const jd = nextSignChange(body, sky.julian, withinDays)
    if (jd == null) continue
    const sign = signOf(longitudeOf(body, jd + 0.05))
    found.push({
      body,
      at: fromJulianDay(jd),
      sign,
      text:
        body === 'sun'
          ? `The Sun enters ${sign.name} — the start of a new season, and a month that ${sign.quality}.`
          : `${BODY_PROFILES[body].name} enters ${sign.name}. From then on, your ${BODY_PROFILES[body].yours} ${SIGN_LORE[sign.name].through}.`,
    })
  }

  return found.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/* ── The long chapters ───────────────────────────────────────── */

export interface Chapter {
  id: string
  title: string
  /** "Now", "In 2029", "Passed in 2018". */
  when: string
  status: 'now' | 'coming' | 'past'
  /** How far into it, 0–1, when it is happening now. */
  progress: number | null
  /** When it is or was exact. Absent while it is happening. */
  at?: Date
  text: string
}

interface Milestone {
  id: string
  title: string
  body: Body
  /** Which natal point the transiting body is measured against. */
  against: Body
  angle: number
  /** How wide the "this is happening now" window is, in degrees. */
  orb: number
  text: string
}

/**
 * The half-dozen transits that are actually chapters of a life.
 *
 * These are the ones that people recognise on sight, and the reason is not
 * mystical: they happen at ages when a life genuinely changes shape, and being
 * told *you are in the middle of one, it lasts about this long, this is what it
 * asks for* is the single most useful sentence this feature can produce for
 * somebody having a hard year.
 *
 * Nothing here predicts an event. Every entry names a question that is being
 * asked, which is the honest description of what these are like from inside.
 */
const MILESTONES: Milestone[] = [
  {
    id: 'saturn-return',
    title: 'Saturn return',
    body: 'saturn',
    against: 'saturn',
    angle: 0,
    orb: 8,
    text: 'Saturn comes back to where it started roughly every twenty-nine years, and both times it asks the same question: is the structure you are living in one you actually chose. It is famously uncomfortable and famously worth it — what survives a Saturn return tends to be load-bearing for the next three decades.',
  },
  {
    id: 'saturn-opposition',
    title: 'Saturn opposition',
    body: 'saturn',
    against: 'saturn',
    angle: 180,
    orb: 7,
    text: 'The halfway point of a Saturn cycle, around fourteen and again around forty-four. It is where whatever you built in the last half-cycle gets looked at in full daylight: what is real stays, and what was only momentum stops being interesting.',
  },
  {
    id: 'jupiter-return',
    title: 'Jupiter return',
    body: 'jupiter',
    against: 'jupiter',
    angle: 0,
    orb: 6,
    text: 'Every twelve years Jupiter comes home, and the year around it is the most open one in the cycle — more room, more yes, more appetite. It rewards being asked for something. The one caution is scale: Jupiter years are also the ones where people take on slightly more than fits.',
  },
  {
    id: 'nodal-return',
    title: 'Nodal return',
    body: 'node',
    against: 'node',
    angle: 0,
    orb: 6,
    text: 'The Moon’s nodes come back around every eighteen and a half years — nineteen, thirty-seven, fifty-six. It is a quieter marker than the others and it usually reads, in hindsight, as the year the direction of a life changed without announcing itself.',
  },
  {
    id: 'uranus-opposition',
    title: 'Uranus opposition',
    body: 'uranus',
    against: 'uranus',
    angle: 180,
    orb: 6,
    text: 'Around forty to forty-two, Uranus reaches the far side of its circuit, and the part of you that will not be managed gets loud. It is the honest astrology of what people call a midlife crisis: the pressure is real, and it is asking to be spent on a deliberate change rather than an accidental one.',
  },
]

/**
 * The next instant the transiting body makes `angle` to a fixed longitude.
 *
 * Measured against the *target point* — the natal degree rotated by the aspect
 * angle — rather than against a separation. Separation is an absolute value, so
 * it never changes sign at a conjunction and a search built on it silently
 * finds nothing: the bug that had a July birthday reporting its solar return in
 * April. The signed difference to the target crosses zero exactly once per
 * pass, forwards or retrograde, and the crossing is the contact.
 */
function nextExact(
  body: Body,
  natalLongitude: number,
  angle: number,
  fromJd: number,
  withinYears: number,
): Date | null {
  const target = norm360(natalLongitude + angle)
  /* Where the body is relative to the target, −180…180. */
  const offset = (jd: number) => angleDelta(target, longitudeOf(body, jd))

  const step = body === 'sun' || body === 'mercury' || body === 'venus' ? 2 : 5
  let previous = offset(fromJd)
  const limit = fromJd + withinYears * 365.25

  for (let jd = fromJd + step; jd < limit; jd += step) {
    const current = offset(jd)

    /*
     * A sign change with both ends near zero is a crossing of the target. The
     * "near zero" test is what rejects the wrap at ±180, where the difference
     * also changes sign and means the opposite thing.
     */
    if (
      Math.sign(current) !== Math.sign(previous) &&
      Math.abs(current) < 45 &&
      Math.abs(previous) < 45
    ) {
      let low = jd - step
      let high = jd
      for (let pass = 0; pass < 30; pass += 1) {
        const middle = (low + high) / 2
        if (Math.sign(offset(middle)) === Math.sign(previous)) low = middle
        else high = middle
      }
      return fromJulianDay(high)
    }
    previous = current
  }
  return null
}

/** The most recent time the same contact was exact, looking backwards. */
function lastExact(
  body: Body,
  natalLongitude: number,
  angle: number,
  fromJd: number,
  withinYears: number,
): Date | null {
  const target = norm360(natalLongitude + angle)
  const offset = (jd: number) => angleDelta(target, longitudeOf(body, jd))

  const step = 5
  let previous = offset(fromJd)
  const limit = fromJd - withinYears * 365.25

  for (let jd = fromJd - step; jd > limit; jd -= step) {
    const current = offset(jd)
    if (
      Math.sign(current) !== Math.sign(previous) &&
      Math.abs(current) < 45 &&
      Math.abs(previous) < 45
    ) {
      let low = jd
      let high = jd + step
      for (let pass = 0; pass < 30; pass += 1) {
        const middle = (low + high) / 2
        if (Math.sign(offset(middle)) === Math.sign(current)) low = middle
        else high = middle
      }
      return fromJulianDay(high)
    }
    previous = current
  }
  return null
}

/** How long ago a chapter counts as recent enough to still be worth naming. */
const RECENT_YEARS = 2.5

export function chaptersOf(natal: Chart, sky: Chart): Chapter[] {
  const chapters: Chapter[] = []

  for (const milestone of MILESTONES) {
    const natalLongitude = placementOf(natal, milestone.against).longitude
    const current = separation(longitudeOf(milestone.body, sky.julian), natalLongitude)
    const distance = Math.abs(current - milestone.angle)

    if (distance <= milestone.orb) {
      chapters.push({
        id: milestone.id,
        title: milestone.title,
        when: 'Happening now',
        status: 'now',
        progress: 1 - distance / milestone.orb,
        text: `${milestone.text} You are inside this one now — ${distance.toFixed(1)}° from exact.`,
      })
      continue
    }

    /*
     * A chapter somebody came through eighteen months ago is still the most
     * explanatory thing in their chart — "that was your Saturn return" is
     * frequently the sentence that makes a hard couple of years make sense —
     * so the recent past is shown alongside what is coming.
     */
    const previous = lastExact(
      milestone.body,
      natalLongitude,
      milestone.angle,
      sky.julian,
      RECENT_YEARS,
    )

    if (previous) {
      chapters.push({
        id: milestone.id,
        title: milestone.title,
        when: `Passed ${previous.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })}`,
        status: 'past',
        progress: null,
        at: previous,
        text: `${milestone.text} You came through this one recently — if the last couple of years have needed explaining, this is a large part of the explanation.`,
      })
      continue
    }

    const next = nextExact(
      milestone.body,
      natalLongitude,
      milestone.angle,
      sky.julian,
      20,
    )

    if (next) {
      chapters.push({
        id: milestone.id,
        title: milestone.title,
        when: next.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        status: 'coming',
        progress: null,
        at: next,
        text: milestone.text,
      })
    }
  }

  /* Happening now first, then what has just passed, then what is coming. */
  const rank = { now: 0, past: 1, coming: 2 }
  return chapters.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0),
  )
}

/* ── The personal year ───────────────────────────────────────── */

export interface SolarReturn {
  at: Date
  daysAway: number
  /** The age they turn. */
  age: number
  text: string
}

/**
 * The solar return: the moment the Sun comes back to where it was at birth.
 *
 * Which is a birthday, computed properly — it lands within a day of the
 * calendar one and is occasionally the day before, because a year is not a
 * whole number of days. Worth showing for the countdown alone: a personal new
 * year is a genuinely good hook for a practice app, and it arrives with the
 * one number people are always quietly aware of anyway.
 */
export function solarReturnOf(natal: Chart, sky: Chart, at: Date): SolarReturn {
  const natalSun = placementOf(natal, 'sun').longitude
  const next = nextExact('sun', natalSun, 0, sky.julian, 2) ?? at
  const daysAway = Math.max(0, Math.round((next.getTime() - at.getTime()) / 86_400_000))

  const age = Math.round(
    (next.getTime() - natal.at.getTime()) / (365.2422 * 86_400_000),
  )

  return {
    at: next,
    daysAway,
    age,
    text:
      daysAway <= 3
        ? `Your solar return is right now — the Sun is back where it stood when you were born. Whatever you set down in this week tends to set the tone for the year.`
        : `In ${daysAway} days the Sun comes back to the exact degree it held when you were born, and you turn ${age}. It is the one new year that is actually yours.`,
  }
}

/* ── Everything, together ────────────────────────────────────── */

export interface Cycles {
  phase: PhaseNow
  newMoon: Lunation
  fullMoon: Lunation
  week: DayAhead[]
  retrogrades: RetrogradeNote[]
  ingresses: Ingress[]
  chapters: Chapter[]
  solar: SolarReturn
}

export function cyclesOf(
  natal: Chart,
  where: Where | null,
  at: Date = new Date(),
): Cycles {
  const day = noonOf(at)
  const sky = momentChart(where, day)

  return {
    phase: phaseNow(sky),
    newMoon: lunationOf(natal, at, 'new'),
    fullMoon: lunationOf(natal, at, 'full'),
    week: weekAhead(natal, where, at),
    retrogrades: retrogradesNow(sky),
    ingresses: ingressesAhead(sky),
    chapters: chaptersOf(natal, sky),
    solar: solarReturnOf(natal, sky, at),
  }
}
