/**
 * Today, read out of the sky and turned into something worth opening the app
 * for.
 *
 * ── The design problem ──────────────────────────────────────────────────────
 *
 * A daily horoscope has one job and almost never does it: be *different
 * tomorrow, in a way you can tell*. The generic ones fail because they are one
 * of twelve paragraphs written a month in advance; the personalised ones often
 * fail differently, by producing so much text that no two days can be
 * distinguished inside it.
 *
 * What is built here goes the other way. Everything below is derived from
 * positions that genuinely changed since yesterday, the strongest three
 * contacts are chosen by a ranking rather than by shuffling, and the whole
 * reading is short enough that the day it describes is legible in one screen.
 * The Moon changes sign every two and a half days and the reading changes
 * visibly when it does, which is the single most important property: somebody
 * who checks on Tuesday and again on Thursday must be able to see that the sky
 * moved.
 *
 * ── Why it ends in an affirmation ───────────────────────────────────────────
 *
 * Because this is not an astrology app and the reading is not the destination.
 * Every one of them lands on one of the intents the rest of Manifester is
 * built around and hands over a line to say — so the daily visit ends in a
 * session rather than in a paragraph, and the feature earns its place by
 * feeding the thing the app is actually for.
 *
 * ── What it will not do ─────────────────────────────────────────────────────
 *
 * Predict events, warn about days, or mention money, health outcomes or other
 * people's intentions. It describes the shape of a day and what is easy in it.
 * That is the honest edge of what this can be, and it is also, as it happens,
 * the part people find worth reading.
 */

import { FOCUS_AREAS, type Focus } from '../affirmations'
import {
  momentChart,
  moonIngress,
  placementOf,
  transits,
  type Chart,
  type Transit,
  type Where,
} from './chart'
import { isRetrograde, type Body } from './ephemeris'
import {
  BODY_PROFILES,
  ELEMENT_LABEL,
  formatShort,
  pointName,
  signOf,
  type Element,
  type Sign,
} from './signs'

export interface ReadTransit {
  transit: Transit
  /** "Venus △ your Moon" */
  title: string
  /** Two sentences: what is touching what, and what that is like. */
  body: string
}

export interface DailyReading {
  /** Local calendar day, so the reading is stable from waking to sleeping. */
  day: string
  natal: Chart
  sky: Chart

  /** One line, at the top, that is different on most days. */
  headline: string
  /** A word for the day's overall texture. See `temperOf`. */
  weatherWord: string
  /** The paragraph. Three or four sentences, never more. */
  weather: string

  moonSentence: string
  /** When the Moon changes sign next, if it is soon. */
  ingress: { at: Date; sign: Sign } | null

  highlights: ReadTransit[]
  retrogrades: Body[]

  /** What the app suggests strengthening, and one line to say. */
  focus: Focus
  affirmation: string
  /** Why that focus, in one clause. */
  focusReason: string
}

/* ── Small helpers ───────────────────────────────────────────── */

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "Saturn, Neptune and Pluto" — the way a person reads a list aloud. */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/** The local calendar day as `YYYY-MM-DD`. */
export function dayKey(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(
    at.getDate(),
  ).padStart(2, '0')}`
}

/**
 * A small deterministic hash.
 *
 * Used only to pick *between equally good options* — which of six lines for
 * today's intent, which of three phrasings — so that the reading is stable all
 * day, different tomorrow, and different for two people with the same transits
 * but different charts. Nothing that carries meaning is chosen this way.
 */
function hash(text: string): number {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return Math.abs(value)
}

/* ── The Moon ────────────────────────────────────────────────── */

function moonSentence(sky: Chart): string {
  const moon = placementOf(sky, 'moon')
  const percent = Math.round(sky.phase.illumination * 100)
  return `The Moon is in ${moon.sign.name}, ${sky.phase.name.toLowerCase()} at ${percent}% lit — ${moon.sign.mood}.`
}

/* ── Transits, written out ───────────────────────────────────── */

function writeTransit(transit: Transit): ReadTransit {
  const moving = BODY_PROFILES[transit.from]
  const target = pointName(transit.to)

  /*
   * The Ascendant and Midheaven are not "yours" in the way a planet is — "your
   * Ascendant" is fine, "your the rising degree" is not — so they keep their
   * own names and the personal points get the possessive.
   */
  const targetPhrase =
    transit.to === 'ascendant'
      ? 'your rising degree'
      : transit.to === 'midheaven'
        ? 'the top of your chart'
        : `your ${BODY_PROFILES[transit.to].yours}`

  const closeness =
    transit.orb < 1
      ? 'It is exact today.'
      : transit.applying
        ? 'It is still tightening.'
        : 'It is already easing off.'

  return {
    transit,
    title: `${moving.name} ${transit.kind.symbol} your ${target}`,
    body: `${moving.name} ${transit.kind.verb} ${targetPhrase}. ${capitalise(
      moving.brings,
    )} — ${transit.kind.texture}. ${closeness}`,
  }
}

/* ── The texture of the day ──────────────────────────────────── */

/**
 * One word for the whole day, from the balance of what is contacting the
 * chart.
 *
 * This is the part people check first and quote to each other, so it is
 * deliberately a *description* and never a rating. There is no good day and no
 * bad day here — there is a day with a lot of friction in it and a day with
 * very little, and those are different things to walk into, not better and
 * worse ones.
 */
function temperOf(highlights: Transit[]): { word: string; clause: string } {
  let flowing = 0
  let charged = 0
  let slow = 0

  for (const transit of highlights) {
    if (transit.kind.temper === 'flowing') flowing += transit.significance
    if (transit.kind.temper === 'charged') charged += transit.significance
    if (BODY_PROFILES[transit.from].weight >= 0.8) slow += transit.significance
  }

  if (highlights.length === 0) {
    return {
      word: 'Quiet',
      clause: 'nothing in the sky is leaning on your chart today',
    }
  }
  if (slow > 0.35) {
    return {
      word: 'Deep',
      clause: 'one of the slow planets is involved, so this is a season rather than a day',
    }
  }
  if (charged > flowing * 1.6) {
    return {
      word: 'Charged',
      clause: 'there is friction in it, and friction is what actually moves things',
    }
  }
  if (flowing > charged * 1.6) {
    return {
      word: 'Open',
      clause: 'most of what is here is easy, which is exactly why it is worth using',
    }
  }
  return {
    word: 'Mixed',
    clause: 'some of it opens and some of it pushes back, often within the same hour',
  }
}

/** Which element the sky is weighted towards today, for one more sentence. */
function dominantElement(sky: Chart): Element {
  const tally: Record<Element, number> = { fire: 0, earth: 0, air: 0, water: 0 }
  for (const placement of sky.placements) {
    if (placement.body === 'node') continue
    // The lights count double: they are what a day is actually lit by.
    tally[placement.sign.element] +=
      placement.body === 'sun' || placement.body === 'moon' ? 2 : 1
  }
  return (Object.keys(tally) as Element[]).reduce((best, element) =>
    tally[element] > tally[best] ? element : best,
  )
}

const ELEMENT_CLAUSE: Record<Element, string> = {
  fire: 'The sky is weighted towards fire, which favours starting over refining.',
  earth: 'The sky is weighted towards earth, which favours finishing over starting.',
  air: 'The sky is weighted towards air, which favours saying it out loud.',
  water: 'The sky is weighted towards water, which favours feeling it through.',
}

/* ── What to strengthen ──────────────────────────────────────── */

function chooseFocus(
  natal: Chart,
  sky: Chart,
  highlights: Transit[],
  day: string,
): { focus: Focus; reason: string } {
  const scores = new Map<string, number>()
  const reasons = new Map<string, string>()

  const add = (id: string, weight: number, reason: string) => {
    const next = (scores.get(id) ?? 0) + weight
    scores.set(id, next)
    if (!reasons.has(id)) reasons.set(id, reason)
  }

  // The Moon's sign is the day's mood, and it is the strongest single signal.
  const moon = placementOf(sky, 'moon')
  add(
    moon.sign.focus,
    3,
    `the Moon is in ${moon.sign.name}, and ${moon.sign.name} ${moon.sign.quality}`,
  )

  // The strongest contact, through the sign the transiting body is in.
  const leading = highlights[0]
  if (leading) {
    const through = placementOf(sky, leading.from).sign
    add(
      through.focus,
      2.2,
      `${BODY_PROFILES[leading.from].name} is moving through ${through.name} and touching ${
        leading.to === 'ascendant' || leading.to === 'midheaven'
          ? pointName(leading.to).toLowerCase()
          : `your ${BODY_PROFILES[leading.to].yours}`
      }`,
    )
  }

  // And the person themselves, so the same sky reads differently for two people.
  const natalSun = placementOf(natal, 'sun')
  add(
    natalSun.sign.focus,
    1.2,
    `your Sun is in ${natalSun.sign.name}, which ${natalSun.sign.quality}`,
  )

  const natalMoon = placementOf(natal, 'moon')
  add(natalMoon.sign.focus, 0.8, `your Moon is in ${natalMoon.sign.name}`)

  let bestId: string | null = null
  let best = -1
  for (const [id, score] of scores) {
    // Ties broken by the day and the chart together, so two people with the
    // same tie do not get the same answer.
    const jitter = (hash(`${day}:${id}:${Math.round(natalSun.longitude)}`) % 100) / 1000
    if (score + jitter > best) {
      best = score + jitter
      bestId = id
    }
  }

  const focus =
    FOCUS_AREAS.find((entry) => entry.id === bestId) ?? FOCUS_AREAS[0]
  return { focus, reason: reasons.get(focus.id) ?? 'the sky leans this way today' }
}

/* ── Putting it together ─────────────────────────────────────── */

/** How many contacts a reading will ever show. Three is a day; eight is a chart. */
const HIGHLIGHT_COUNT = 3

/**
 * The bodies that move enough to be about *today*.
 *
 * Everything from Jupiter outwards spends weeks or months inside an orb, so a
 * reading built only from those is a reading that does not change. These five
 * are what make a Tuesday different from a Thursday.
 */
const FAST: Body[] = ['moon', 'sun', 'mercury', 'venus', 'mars']

export function readToday(
  natal: Chart,
  where: Where | null,
  at: Date = new Date(),
): DailyReading {
  const sky = momentChart(where, at)
  const day = dayKey(at)

  const all = transits(natal, sky)

  /*
   * At most one contact per transiting body.
   *
   * Without this, a Moon halfway between two natal planets fills all three
   * slots with the Moon and the reading has one idea in it. Taking the
   * strongest contact from each of three different bodies is what makes the
   * three highlights three genuinely different things to notice.
   */
  const seen = new Set<Body>()
  const highlights: Transit[] = []
  for (const transit of all) {
    if (seen.has(transit.from)) continue
    seen.add(transit.from)
    highlights.push(transit)
    if (highlights.length >= HIGHLIGHT_COUNT) break
  }

  /*
   * One slot always belongs to something that moved today.
   *
   * Pluto can sit within a degree of an angle for a month, and the ranking is
   * right to put it first — it is genuinely the most significant thing in the
   * chart. But three slow planets fill all three cards and the reading then
   * says the same thing for weeks, which is the one failure a daily feature
   * cannot survive. So if nothing personal made the cut, the strongest fast
   * contact takes the last slot from the weakest slow one.
   */
  if (!highlights.some((transit) => FAST.includes(transit.from))) {
    const fastest = all.find((transit) => FAST.includes(transit.from))
    if (fastest) {
      if (highlights.length >= HIGHLIGHT_COUNT) highlights.pop()
      highlights.push(fastest)
    }
  }

  const temper = temperOf(highlights)
  const element = dominantElement(sky)
  const moon = placementOf(sky, 'moon')
  const { focus, reason } = chooseFocus(natal, sky, highlights, day)

  /*
   * Which of the intent's six lines to offer.
   *
   * Keyed on the day *and* the chart, so it is the same line all day, a
   * different one tomorrow, and not the same line as the person sitting next
   * to them who happens to have drawn the same intent.
   */
  const affirmation =
    focus.lines[
      hash(`${day}:${focus.id}:${Math.round(placementOf(natal, 'moon').longitude)}`) %
        focus.lines.length
    ]

  const retrogrades = (
    ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as Body[]
  ).filter((body) => isRetrograde(body, sky.julian))

  const leading = highlights[0]

  /*
   * The headline is the fastest significant thing, not the biggest one.
   *
   * These two are different and the distinction is the whole difference
   * between a feature people come back to and one they read once. A Neptune
   * square is the most important contact in the chart and it is *also* the
   * same sentence for six weeks; leading with it means somebody checks on
   * Monday, checks again on Friday, sees the same headline and stops checking.
   *
   * So the slow planets keep their card — where the orb underneath makes clear
   * it is a season — and the line at the top belongs to a body that has
   * actually moved since yesterday. When nothing personal is in orb at all,
   * the Moon's sign says it, which changes every two and a half days.
   */
  const spoken =
    highlights.find((transit) => FAST.includes(transit.from)) ?? leading

  const headline = spoken
    ? `${BODY_PROFILES[spoken.from].name} ${spoken.kind.verb} ${
        spoken.to === 'ascendant'
          ? 'your rising degree'
          : spoken.to === 'midheaven'
            ? 'the top of your chart'
            : `your ${pointName(spoken.to)}`
      }`
    : `The Moon is in ${moon.sign.name}, ${moon.sign.mood.split(';')[0]}`

  const weather = [
    `A ${temper.word.toLowerCase()} day: ${temper.clause}.`,
    leading
      ? `${capitalise(BODY_PROFILES[leading.from].brings)}, and it is arriving through ${formatShort(
          placementOf(sky, leading.from).longitude,
        )}.`
      : `Nothing is close enough to your chart to make a claim on the day, which is its own kind of permission.`,
    ELEMENT_CLAUSE[element],
    retrogrades.length > 0
      ? `${list(retrogrades.map((body) => BODY_PROFILES[body].name))} ${
          retrogrades.length === 1 ? 'is' : 'are'
        } retrograde — going back over ${
          retrogrades.length === 1 ? 'its' : 'their'
        } own ground rather than breaking new.`
      : `Nothing is retrograde: everything in the sky is moving forwards today.`,
  ].join(' ')

  return {
    day,
    natal,
    sky,
    headline,
    weatherWord: temper.word,
    weather,
    moonSentence: moonSentence(sky),
    ingress: moonIngress(sky),
    highlights: highlights.map(writeTransit),
    retrogrades,
    focus,
    affirmation,
    focusReason: reason,
  }
}

/* ── The chart at a glance ───────────────────────────────────── */

export interface Vital {
  label: string
  value: string
  detail?: string
}

/**
 * The three or four facts somebody actually wants to be able to recite.
 *
 * Sun, Moon and Rising, in that order, because that is the order people say
 * them in — and the Rising is deliberately absent rather than guessed when the
 * birth time is unknown, with a line explaining why. A blank with a reason is
 * worth more than a number that might be wrong by six signs.
 */
export function vitalsOf(chart: Chart): Vital[] {
  const sun = placementOf(chart, 'sun')
  const moon = placementOf(chart, 'moon')

  const vitals: Vital[] = [
    {
      label: 'Sun',
      value: sun.sign.name,
      detail: `${formatShort(sun.longitude)} · ${ELEMENT_LABEL[sun.sign.element]}`,
    },
    {
      label: 'Moon',
      value: moon.sign.name,
      detail: chart.precise
        ? `${formatShort(moon.longitude)} · ${ELEMENT_LABEL[moon.sign.element]}`
        : 'Approximate — a birth time would settle it',
    },
  ]

  if (chart.ascendant != null) {
    vitals.push({
      label: 'Rising',
      value: signOf(chart.ascendant).name,
      detail: formatShort(chart.ascendant),
    })
  } else {
    vitals.push({
      label: 'Rising',
      value: 'Unknown',
      detail: 'It moves a degree every four minutes, so it needs your birth time',
    })
  }

  return vitals
}
