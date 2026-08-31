/**
 * The daily horoscope, at full length.
 *
 * ── What this adds to `reading.ts` ──────────────────────────────────────────
 *
 * `reading.ts` produces the spine of a day: a headline, a word for its
 * texture, three contacts and a line to say. That is the right size for a
 * glance and it is not the right size for the thing people actually open every
 * morning — a horoscope somebody looks forward to has *shape*: it tells you
 * what kind of day this is, where in it the good hours are, what each part of
 * a life is being asked for, and what to do about any of it.
 *
 * So this file wraps the reading and adds the things a daily practice can
 * genuinely use:
 *
 *  1. **An overview in paragraphs**, not clauses — the shape of the day, the
 *     contact that leads it, and what has changed since yesterday.
 *  2. **Four areas of a life** — body, heart, mind and spirit — each answered
 *     from the planets that actually govern them, so the day says something
 *     different to somebody whose Venus is being touched than to somebody
 *     whose Mars is.
 *  3. **The hours**, which is the part nobody else does honestly. The Moon
 *     moves half a degree an hour and its contacts to a natal chart are
 *     computable to the minute, so "the open stretch is between two and four"
 *     is a real statement rather than a mood. It is also the single most
 *     *useful* thing astrology can offer a person planning a day.
 *  4. **Four dials** — energy, heart, mind, calm — which exist because a
 *     number is scannable and because people like them, and which are
 *     labelled, in the interface, as weather rather than fortune. They are
 *     derived from the same transits as everything else; nothing is random.
 *  5. **A passage to say**, in `passage.ts` — six or seven sentences built
 *     from the same day, because the reading is a doorway into a session and
 *     one sentence pulled out of nine paragraphs throws the reading away.
 *  6. **The void-of-course stretch**, in `voidmoon.ts` — the one classical
 *     claim in the whole feature that is falsifiable to the minute, and the
 *     most practical thing astrology has ever offered a person with a diary.
 *  7. **Tomorrow in a line, and the arithmetic in a panel.** The first gives
 *     the reading a horizon; the second means none of it has to be taken on
 *     faith, which is an unusual thing for a horoscope to be able to say.
 *
 * ── Stability ──────────────────────────────────────────────────────────────
 *
 * Everything here is computed for **local noon**, not for the instant it is
 * asked. The Moon travels thirteen degrees a day, so a reading computed at the
 * moment of asking changes under somebody between breakfast and lunch — which
 * reads, correctly, as an app that cannot make its mind up. Noon is the middle
 * of the waking day and it makes the whole reading the same from waking to
 * sleeping, which is the promise a *daily* horoscope makes by being called
 * one. The live positions elsewhere in the feature stay live.
 */

import {
  momentChart,
  placementOf,
  transits,
  type Chart,
  type Transit,
  type Where,
} from './chart'
import { longitudeOf, type Body } from './ephemeris'
import {
  aspectBetween,
  BODY_PROFILES,
  ELEMENT_LABEL,
  formatShort,
  pointName,
  type Element,
} from './signs'
import { ASPECT_LORE, BODY_LORE, ELEMENT_CARE, phaseLore, SIGN_LORE } from './lore'
import { ELEMENT_CLAUSE, readToday, type DailyReading } from './reading'
import { longitudeOfPoint } from './chart'
import type { Point } from './signs'
import { passageOf, type Passage } from './passage'
import { moonMotion, voidToday, type VoidMoon } from './voidmoon'

/* ── Small shared helpers ────────────────────────────────────── */

/** Local noon on the calendar day `at` falls in. */
export function noonOf(at: Date): Date {
  const noon = new Date(at)
  noon.setHours(12, 0, 0, 0)
  return noon
}

/**
 * A time, with the day attached when the day is not this one.
 *
 * "The Moon crosses into Taurus at 8:03" is a true sentence about tomorrow
 * morning roughly half the time it is printed, because the Moon takes two and
 * a half days to cross a sign and the search that finds the crossing does not
 * stop at midnight. Saying "at 8:03 tomorrow" costs four words and is the
 * difference between a timing feature and a plausible-looking one.
 */
export function whenPhrase(at: Date, day: Date): string {
  const clock = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const days = Math.round(
    (new Date(at).setHours(0, 0, 0, 0) - new Date(day).setHours(0, 0, 0, 0)) / 86_400_000,
  )
  if (days === 0) return clock
  if (days === 1) return `${clock} tomorrow`
  if (days === -1) return `${clock} yesterday`
  return `${clock} on ${at.toLocaleDateString(undefined, { weekday: 'long' })}`
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function hash(text: string): number {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return Math.abs(value)
}

/** Sum the significance of every contact from one of `bodies`. */
function weightOf(list: Transit[], bodies: Body[]): number {
  return list
    .filter((transit) => bodies.includes(transit.from))
    .reduce((total, transit) => total + transit.significance, 0)
}

function temperWeight(list: Transit[], temper: 'flowing' | 'charged'): number {
  return list
    .filter((transit) => transit.kind.temper === temper)
    .reduce((total, transit) => total + transit.significance, 0)
}

/** How much of the sky sits in each element, lights counted double. */
function elementWeights(sky: Chart): Record<Element, number> {
  const tally: Record<Element, number> = { fire: 0, earth: 0, air: 0, water: 0 }
  for (const placement of sky.placements) {
    if (placement.body === 'node') continue
    tally[placement.sign.element] +=
      placement.body === 'sun' || placement.body === 'moon' ? 2 : 1
  }
  return tally
}

/* ── The dials ───────────────────────────────────────────────── */

export interface Dial {
  key: 'energy' | 'heart' | 'mind' | 'calm'
  label: string
  /** 0–100, and never 0 or 100 — see the comment below. */
  value: number
  /** One clause under the number, explaining where it came from. */
  caption: string
}

/**
 * Four numbers, honestly derived and honestly bounded.
 *
 * Every dial is a weighted sum of contacts that are genuinely in the sky
 * today, and none of them can reach either end of its range. That second part
 * is deliberate: a 0 would say the day is a write-off and a 100 would promise
 * something no arrangement of planets can deliver, and both are the kind of
 * claim this app has no business making. What a dial says is *there is more of
 * this available today than usual*, which is a description of weather, and the
 * interface says so underneath in those words.
 */
function dialsOf(sky: Chart, all: Transit[]): Dial[] {
  const elements = elementWeights(sky)
  const total = Object.values(elements).reduce((sum, value) => sum + value, 0) || 1
  const share = (element: Element) => elements[element] / total

  const flowing = temperWeight(all, 'flowing')
  const charged = temperWeight(all, 'charged')

  const drive = weightOf(all, ['mars', 'sun', 'jupiter'])
  const warmth = weightOf(all, ['venus', 'moon'])
  const thinking = weightOf(all, ['mercury', 'uranus'])

  const phase = sky.phase
  // The waxing half of the month genuinely correlates with people reporting
  // more available energy; the waning half with less. Small, and real enough
  // to be worth two points either way rather than twenty.
  const lunarLift = (phase.waxing ? 1 : -1) * (phase.illumination * 6)

  const moonSign = placementOf(sky, 'moon').sign

  /*
   * Every contribution is passed through `tanh` before it is added.
   *
   * Without it a day with four contacts in it pegs three dials at the top
   * and the calm dial at the bottom, which is both untrue and — worse — the
   * same picture as the next busy day. Saturation keeps the ordinary range
   * somewhere around 35 to 80, so that a genuinely unusual day still has
   * somewhere to go.
   */
  const soften = (value: number) => Math.tanh(value)

  return [
    {
      key: 'energy',
      label: 'Energy',
      value: Math.round(
        clamp(
          46 + soften(drive) * 24 + (share('fire') - 0.25) * 70 + lunarLift,
          12,
          92,
        ),
      ),
      caption:
        drive > 0.25
          ? `${capitalise(
              BODY_PROFILES[
                all.find((transit) => ['mars', 'sun', 'jupiter'].includes(transit.from))!
                  .from
              ].name,
            )} is in contact with your chart, and the sky is ${Math.round(share('fire') * 100)}% fire.`
          : `Nothing is driving hard at your chart today; the level is whatever you bring to it.`,
    },
    {
      key: 'heart',
      label: 'Heart',
      value: Math.round(
        clamp(
          47 + soften(warmth) * 24 + (share('water') - 0.25) * 62 + soften(flowing) * 8,
          12,
          92,
        ),
      ),
      caption:
        warmth > 0.2
          ? `Venus or the Moon is touching your chart, which is what makes a day feel met rather than managed.`
          : `A steady day for the heart — nothing is pulling at it either way.`,
    },
    {
      key: 'mind',
      label: 'Mind',
      value: Math.round(
        clamp(
          47 + soften(thinking) * 24 + (share('air') - 0.25) * 62 + (share('earth') - 0.25) * 12,
          12,
          92,
        ),
      ),
      caption:
        thinking > 0.2
          ? `Mercury is in contact with your chart: words arrive faster than usual, and so do second thoughts.`
          : `An ordinary day for thinking. Write things down and it will hold.`,
    },
    {
      key: 'calm',
      label: 'Calm',
      value: Math.round(
        clamp(
          58 +
            soften(flowing) * 16 -
            soften(charged) * 30 +
            (share('earth') - 0.25) * 44 -
            (share('fire') - 0.25) * 22,
          12,
          92,
        ),
      ),
      caption:
        charged > flowing
          ? `There is friction in the sky today, and the Moon in ${moonSign.name} is ${moonSign.mood.split(';')[0]}.`
          : `Little friction from the sky today — the quiet is genuinely available.`,
    },
  ]
}

/* ── The four areas of a life ────────────────────────────────── */

export interface AreaRead {
  key: 'body' | 'heart' | 'mind' | 'spirit'
  label: string
  /** Two or three sentences. */
  text: string
  /** One thing to actually do, short enough to do today. */
  action: string
}

/**
 * Body, heart, mind and spirit — the four the day is answered in.
 *
 * The split is not decorative. Each area is governed by particular bodies, so
 * a day when Mars is on somebody's Ascendant genuinely reads differently in
 * *body* than a day when Venus is on their Moon does, and a reader who checks
 * their own experience against it can find it right or wrong. That falsifiable
 * quality is the whole difference between a horoscope somebody keeps opening
 * and one they stop believing in week three.
 */
function areasOf(natal: Chart, sky: Chart, all: Transit[]): AreaRead[] {
  const moon = placementOf(sky, 'moon')
  const moonLore = SIGN_LORE[moon.sign.name]
  const natalMoon = placementOf(natal, 'moon')
  const element = moon.sign.element
  const care = ELEMENT_CARE[element]

  const strongest = (bodies: Body[]): Transit | null =>
    all.find((transit) => bodies.includes(transit.from)) ?? null

  const bodyTransit = strongest(['mars', 'sun', 'saturn'])
  const heartTransit = strongest(['venus', 'moon', 'neptune'])
  const mindTransit = strongest(['mercury', 'uranus', 'jupiter'])
  const spiritTransit = strongest(['jupiter', 'neptune', 'pluto', 'saturn'])

  const contact = (transit: Transit | null): string =>
    transit
      ? `${BODY_PROFILES[transit.from].name} ${transit.kind.verb} your ${pointName(
          transit.to,
        )}, so ${BODY_PROFILES[transit.from].brings}.`
      : ''

  return [
    {
      key: 'body',
      label: 'Body',
      text: [
        `The Moon is in ${moon.sign.name}, which traditionally has your attention on ${moonLore.body}.`,
        contact(bodyTransit),
        care.weather,
      ]
        .filter(Boolean)
        .join(' '),
      action: moonLore.care,
    },
    {
      key: 'heart',
      label: 'Heart',
      text: [
        `Your Moon is in ${natalMoon.sign.name}, so what actually settles you is ${SIGN_LORE[natalMoon.sign.name].needs}.`,
        contact(heartTransit),
        heartTransit
          ? ASPECT_LORE[heartTransit.kind.id].use
          : `Nothing is pulling at the heart today, which makes it a good one to give somebody else’s a look.`,
      ]
        .filter(Boolean)
        .join(' '),
      action: SIGN_LORE[natalMoon.sign.name].ritual,
    },
    {
      key: 'mind',
      label: 'Mind',
      text: [
        mindTransit
          ? contact(mindTransit)
          : `Nothing quick is touching your chart, so the thinking today is whatever you point it at.`,
        `The sky is weighted towards ${ELEMENT_LABEL[
          (Object.keys(elementWeights(sky)) as Element[]).reduce((best, current) =>
            elementWeights(sky)[current] > elementWeights(sky)[best] ? current : best,
          )
        ].toLowerCase()}.`,
        `Thinking clears ${BODY_LORE.mercury.heals}`,
      ]
        .filter(Boolean)
        .join(' '),
      action: 'Write down the four things circling, and pick one to actually finish.',
    },
    {
      key: 'spirit',
      label: 'Spirit',
      text: [
        `${capitalise(sky.phase.name)}, ${Math.round(sky.phase.illumination * 100)}% lit. ${phaseLore(sky.phase.name).is}`,
        contact(spiritTransit),
      ]
        .filter(Boolean)
        .join(' '),
      action: phaseLore(sky.phase.name).doThis,
    },
  ]
}

/* ── The hours ───────────────────────────────────────────────── */

export interface HourBand {
  /** "Early", "Midday", "Evening". */
  label: string
  from: Date
  to: Date
  /** -1 to 1: how charged or how open the stretch is. */
  score: number
  quality: 'open' | 'bright' | 'charged' | 'quiet' | 'soft'
  /** One line about what this stretch is good for. */
  note: string
}

/**
 * What each kind of stretch is actually good for.
 *
 * The hours are the most practical thing in the feature and they are only
 * practical if they end in a verb. "Moon square your Sun" is a fact; "harder
 * for sitting still, easier for getting something unstuck" is a plan.
 */
const BAND_USE: Record<HourBand['quality'], string> = {
  open: 'the easiest stretch of the day. Ask for the thing here.',
  bright: 'good for company, decisions and being understood.',
  charged: 'harder for sitting still, easier for shifting something stuck.',
  soft: 'mixed. Fine for ordinary work, less good for a difficult conversation.',
  quiet: 'an unclaimed stretch. Whatever you put in it is what it will be.',
}

/**
 * Where in its arc the contact is.
 *
 * The Moon can hold one aspect across four of these stretches, and without
 * this the strip prints the identical sentence four times and reads as broken
 * software. It is also the more useful fact: a trine that is still closing is
 * a stretch to wait through, and one that is separating is a stretch to use
 * now.
 */
const TREND: Record<'coming' | 'exact' | 'going', string> = {
  coming: 'still closing in',
  exact: 'exact around here',
  going: 'separating',
}

/**
 * What a repeated stretch says instead of repeating the advice.
 *
 * With the orb in front of it, which is the one thing that is genuinely
 * different between two stretches holding the same aspect: the Moon closes
 * about a degree and a half across three hours, so the number moves even when
 * nothing else does.
 */
const TREND_TAIL: Record<'coming' | 'exact' | 'going', string> = {
  coming: 'off and closing',
  exact: 'from exact — this is the peak of it',
  going: 'past exact and separating',
}

/**
 * A run of empty stretches, said a different way each time.
 *
 * Four identical "nothing from the Moon here" lines is the same failure as
 * four identical aspect lines: correct, and unreadable. Indexed by how many
 * quiet stretches have already gone past, so a quiet day still moves.
 */
const QUIET_AGAIN = [
  'Still nothing from the Moon — yours to shape.',
  'Also quiet. Nothing is asking anything of you in this stretch.',
  'Nothing here either. A day with room in it.',
  'Quiet again — spend it however you like.',
  'Empty as well. Whatever you put in it is what it will be.',
]

const BANDS: { label: string; from: number; to: number }[] = [
  { label: 'Early', from: 5, to: 8 },
  { label: 'Morning', from: 8, to: 11 },
  { label: 'Midday', from: 11, to: 14 },
  { label: 'Afternoon', from: 14, to: 17 },
  { label: 'Evening', from: 17, to: 21 },
  { label: 'Night', from: 21, to: 24 },
]

/** The natal points the Moon's hour-by-hour contacts are measured against. */
const HOUR_TARGETS: Point[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'ascendant',
  'midheaven',
]

/**
 * The Moon's contacts, hour by hour, turned into a shape for the day.
 *
 * This is the only part of the whole feature that is *timing* rather than
 * description, and it is worth the arithmetic: the Moon crosses half a degree
 * an hour, so an aspect that is four degrees off at breakfast is exact by mid
 * afternoon — and saying which stretch of the day that lands in is both
 * checkable and, unusually for astrology, immediately practical.
 */
function hoursOf(natal: Chart, day: Date): HourBand[] {
  /*
   * The Moon can hold one aspect for four straight stretches, and the second
   * half of the sentence — what the stretch is good for — is then identical
   * four times over. So the advice is given once per run and the stretches
   * after it say only where in the arc they are, which is the part that is
   * actually different.
   */
  let previousQuality: HourBand['quality'] | null = null
  let quietRun = 0

  return BANDS.map((band) => {
    const from = new Date(day)
    from.setHours(band.from, 0, 0, 0)
    const to = new Date(day)
    to.setHours(band.to === 24 ? 23 : band.to, band.to === 24 ? 59 : 0, 0, 0)

    const middle = new Date((from.getTime() + to.getTime()) / 2)
    const julian = middle.getTime() / 86_400_000 + 2440587.5
    const moon = longitudeOf('moon', julian)

    /* An hour later, to tell a contact that is closing from one that has gone. */
    const later = longitudeOf('moon', julian + 1 / 24)

    let flowing = 0
    let charged = 0
    let closest: {
      name: string
      orb: number
      kind: string
      trend: 'coming' | 'exact' | 'going'
    } | null = null

    for (const target of HOUR_TARGETS) {
      const natalLongitude = longitudeOfPoint(natal, target)
      if (natalLongitude == null) continue
      const aspect = aspectBetween(moon, natalLongitude)
      if (!aspect) continue

      const weight = aspect.exactness * aspect.kind.weight
      if (aspect.kind.temper === 'flowing') flowing += weight
      if (aspect.kind.temper === 'charged') charged += weight
      if (aspect.kind.temper === 'neutral') flowing += weight * 0.5

      if (!closest || aspect.orb < closest.orb) {
        const after = aspectBetween(later, natalLongitude)
        closest = {
          name: pointName(target),
          orb: aspect.orb,
          kind: aspect.kind.name,
          trend:
            aspect.orb < 0.8
              ? 'exact'
              : after && after.orb < aspect.orb
                ? 'coming'
                : 'going',
        }
      }
    }

    const score = clamp(flowing - charged, -1, 1)
    const busy = flowing + charged

    const quality: HourBand['quality'] =
      busy < 0.25
        ? 'quiet'
        : score > 0.4
          ? 'open'
          : score > 0.1
            ? 'bright'
            : score < -0.25
              ? 'charged'
              : 'soft'

    const repeat = quality === previousQuality
    previousQuality = quality

    const note =
      closest && busy >= 0.25
        ? repeat
          ? `Moon ${closest.kind} your ${closest.name} — ${closest.orb.toFixed(1)}° ${
              TREND_TAIL[closest.trend]
            }.`
          : `Moon ${closest.kind} your ${closest.name}, ${TREND[closest.trend]} — ${
              BAND_USE[quality]
            }`
        : repeat
          ? QUIET_AGAIN[quietRun++ % QUIET_AGAIN.length]
          : `Nothing from the Moon here — ${BAND_USE.quiet}`

    return { label: band.label, from, to, score, quality, note }
  })
}

export interface PowerWindow {
  from: Date
  to: Date
  /** "Moon trine your Venus" */
  what: string
  /** Why this stretch, in a sentence. */
  why: string
}

/**
 * The best forty minutes in the day, to the minute.
 *
 * Found by walking the day in ten-minute steps and watching the orb of the
 * strongest lunar contact close and open again. The exact minute is not the
 * point — nobody should schedule surgery around it — but "between about ten
 * past two and three o'clock" is specific enough to be worth planning a
 * difficult conversation into, and specific enough that a person can check
 * afterwards whether it was any good. That is the standard everything in this
 * feature is held to.
 */
function powerWindowOf(natal: Chart, day: Date): PowerWindow | null {
  let best: { at: number; score: number; label: string } | null = null

  const start = new Date(day)
  start.setHours(6, 0, 0, 0)

  for (let minutes = 0; minutes <= 17 * 60; minutes += 10) {
    const at = start.getTime() + minutes * 60_000
    const julian = at / 86_400_000 + 2440587.5
    const moon = longitudeOf('moon', julian)

    for (const target of HOUR_TARGETS) {
      const natalLongitude = longitudeOfPoint(natal, target)
      if (natalLongitude == null) continue
      const aspect = aspectBetween(moon, natalLongitude)
      if (!aspect || aspect.kind.temper === 'charged') continue

      const score = aspect.exactness * aspect.kind.weight
      if (!best || score > best.score) {
        best = {
          at,
          score,
          label: `Moon ${aspect.kind.symbol} your ${pointName(target)}`,
        }
      }
    }
  }

  if (!best || best.score < 0.34) return null

  return {
    from: new Date(best.at - 25 * 60_000),
    to: new Date(best.at + 25 * 60_000),
    what: best.label,
    why: 'The easiest contact of the day is exact around here. If something needs saying, say it in this stretch.',
  }
}

/* ── A line written from the sky ─────────────────────────────── */

/**
 * The transit-written mantra.
 *
 * Separate from `reading.affirmation`, which is drawn from the app's own
 * library and therefore already has a studio voice recorded for it. This one
 * is written from what is actually overhead — shorter, stranger, and different
 * every day — and it exists because the single most-quoted thing any horoscope
 * produces is its one memorable sentence.
 *
 * Held to the same three rules as every other line in the app: survives
 * repetition, sayable out loud without embarrassment, true on a bad day.
 */
const SKY_LINES: Record<string, string[]> = {
  flowing: [
    'What is open today is open because I am ready for it.',
    'I can take the easy road without suspecting it.',
    'I let today be simpler than I expected.',
    'Good things are allowed to be uncomplicated.',
  ],
  charged: [
    'Friction means something is moving, and I can move with it.',
    'I do not have to be comfortable to be doing this right.',
    'I meet what pushes back without pushing harder.',
    'The hard part of today is the part that changes something.',
  ],
  deep: [
    'I am in a long season, and I am allowed to go slowly through it.',
    'What is changing in me does not need to be finished today.',
    'I can hold something big without solving it this week.',
    'Slow is still moving.',
  ],
  quiet: [
    'An unclaimed day is mine to spend as I choose.',
    'Nothing is asking anything of me right now, and that is rest.',
    'I do not need a reason to have a good day.',
    'Today can simply be a day.',
  ],
  mixed: [
    'Two true things can share a day.',
    'I can be steady in the middle of a mixed hour.',
    'I take what opens and let the rest wait.',
    'Not every part of today has to agree.',
  ],
}

function skyLineFor(reading: DailyReading, day: string, seed: number): string {
  const key = reading.weatherWord.toLowerCase()
  const lines = SKY_LINES[key] ?? SKY_LINES.mixed
  return lines[hash(`${day}:${key}:${seed}`) % lines.length]
}

/* ── The whole thing ─────────────────────────────────────────── */

/** Where tomorrow differs from today, in two sentences. */
export interface Tomorrow {
  /** The word for tomorrow's texture. */
  word: string
  /** The sign the Moon is in at noon tomorrow. */
  moonSign: string
  /** True when the Moon changes sign between the two readings. */
  turns: boolean
  /** The two sentences themselves. */
  line: string
}

/** One row of the arithmetic, for the people who want to check it. */
export interface Working {
  label: string
  value: string
}

export interface Horoscope {
  /** The spine: headline, weather, highlights, focus and affirmation. */
  reading: DailyReading
  /** The chart the whole reading is computed from — local noon today. */
  sky: Chart
  /** Two or three paragraphs. */
  overview: string[]
  areas: AreaRead[]
  hours: HourBand[]
  power: PowerWindow | null
  /** The stretch with no lunar contacts left in it, when today has one. */
  quiet: VoidMoon | null
  dials: Dial[]
  /** The paragraph this day hands to the player. */
  passage: Passage
  /** What changes overnight. */
  tomorrow: Tomorrow
  /** The numbers underneath all of it. */
  workings: Working[]
  /** One thing that goes well today. */
  doThis: string
  /** One thing to stop pushing at. */
  easeOff: string
  /** The question to sit with. */
  ask: string
  /** A line written from today's sky rather than from the app's library. */
  skyLine: string
  /** The whole reading as plain text, for copying and sharing. */
  shareText: string
}

/* ── Tomorrow ────────────────────────────────────────────────── */

/**
 * The one line that gives the reading a horizon.
 *
 * A daily horoscope that only ever describes today has no reason to be opened
 * tomorrow, which is a strange property for a daily thing to have. One
 * sentence about what changes overnight does two jobs at once: it makes today
 * legible by contrast — "slower than today" says more about today than another
 * adjective would — and it leaves somebody with a reason to come back.
 *
 * It is deliberately two sentences and never more. The whole reading exists
 * for tomorrow as well, and printing it a day early would only teach people
 * that the morning visit is optional.
 */
function tomorrowOf(natal: Chart, where: Where | null, day: Date): Tomorrow {
  const next = new Date(day)
  next.setDate(next.getDate() + 1)

  const reading = readToday(natal, where, noonOf(next))
  const moon = placementOf(reading.sky, 'moon')
  const today = placementOf(momentChart(where, day), 'moon').sign.name
  const turns = moon.sign.name !== today

  /*
   * The mood, to its first break.
   *
   * Half of them are written as "clause; second clause" and half as "clause —
   * second clause", and either second half is a whole sentence's worth of
   * advice about a day that has not happened yet. One line about tomorrow
   * takes the first half and stops.
   */
  const mood = moon.sign.mood.split(/[;—]/)[0].trim()

  const shape = turns
    ? `Tomorrow the Moon moves on into ${moon.sign.name} and the mood turns with it: ${mood}.`
    : `Tomorrow the Moon is still in ${moon.sign.name}, so the shape of the day holds.`

  const lead = `${reading.headline}, and it reads as a ${reading.weatherWord.toLowerCase()} day.`

  return {
    word: reading.weatherWord,
    moonSign: moon.sign.name,
    turns,
    line: `${shape} ${lead}`,
  }
}

/* ── The arithmetic, shown ───────────────────────────────────── */

/**
 * The numbers the whole reading is standing on.
 *
 * Every horoscope on the internet asks to be taken on faith, and this one does
 * not have to: the positions are computed on the device from orbital elements
 * and can be checked against any ephemeris in the world in about ninety
 * seconds. Putting them on the screen is the difference between *trust me* and
 * *here is the working*, and it costs one folded-away panel.
 */
function workingsOf(
  natal: Chart,
  sky: Chart,
  where: Where | null,
  all: Transit[],
  day: Date,
): Working[] {
  const moon = placementOf(sky, 'moon')
  const sun = placementOf(sky, 'sun')
  const speed = moonMotion(sky)

  const rows: Working[] = [
    {
      label: 'Computed for',
      value: `Local noon, ${day.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`,
    },
    {
      label: 'Moon',
      value: `${formatShort(moon.longitude)}, travelling ${speed.toFixed(2)}° a day`,
    },
    { label: 'Sun', value: formatShort(sun.longitude) },
    {
      label: 'Phase',
      value: `${sky.phase.name}, ${(sky.phase.illumination * 100).toFixed(1)}% lit and ${
        sky.phase.waxing ? 'waxing' : 'waning'
      }`,
    },
    {
      label: 'Your chart',
      value: natal.precise
        ? `${formatShort(placementOf(natal, 'sun').longitude)} Sun, houses from a known birth time`
        : `${formatShort(placementOf(natal, 'sun').longitude)} Sun, no birth time — the Moon is approximate and there are no houses`,
    },
    {
      label: 'Contacts in orb',
      value: `${all.length} between the sky and your chart; the three strongest are shown above`,
    },
  ]

  if (where) {
    rows.push({
      label: 'Read from',
      value: `${Math.abs(where.latitude).toFixed(2)}° ${
        where.latitude >= 0 ? 'N' : 'S'
      }, ${Math.abs(where.longitude).toFixed(2)}° ${where.longitude >= 0 ? 'E' : 'W'}`,
    })
  }

  rows.push({
    label: 'Where the numbers come from',
    value:
      'Orbital elements evaluated on this device — no network, no account, nothing sent anywhere',
  })

  return rows
}

export function horoscopeOf(
  natal: Chart,
  where: Where | null,
  at: Date = new Date(),
): Horoscope {
  const day = noonOf(at)
  const sky = momentChart(where, day)
  const reading = readToday(natal, where, day)
  const all = transits(natal, sky)

  const leading = reading.highlights[0]?.transit ?? null
  const moon = placementOf(sky, 'moon')
  const moonLore = SIGN_LORE[moon.sign.name]
  const phase = phaseLore(sky.phase.name)

  const dominantElement = (Object.keys(elementWeights(sky)) as Element[]).reduce(
    (best, current) =>
      elementWeights(sky)[current] > elementWeights(sky)[best] ? current : best,
  )

  const overview = [
    /*
     * What kind of day this is.
     *
     * Assembled here rather than taken from `reading.weather`, because that
     * paragraph ends with the retrograde list and the third paragraph below
     * says the same thing at length — and a screen that tells you twice that
     * Mercury is retrograde reads as software rather than as a reading.
     */
    `${reading.weather.split('. ')[0]}. The Moon is in ${moon.sign.name} — ${moon.sign.mood}. ${ELEMENT_CLAUSE[dominantElement]}`,

    /* The contact that leads it, and what to do with it. */
    leading
      ? `${capitalise(BODY_PROFILES[leading.from].name)} ${leading.kind.verb} your ${pointName(
          leading.to,
        )} today. ${capitalise(BODY_PROFILES[leading.from].brings)} — ${leading.kind.texture}. ${
          ASPECT_LORE[leading.kind.id].use
        }`
      : `Nothing in the sky is within reach of your chart today, which is genuinely uncommon and worth using. Days with no claim on them are the ones where you find out what you would do with your own time.`,

    /* What has changed since yesterday. */
    [
      `${sky.phase.name}, ${Math.round(sky.phase.illumination * 100)}% lit. ${phase.is}`,
      reading.ingress
        ? `The Moon crosses into ${reading.ingress.sign.name} at ${whenPhrase(
            reading.ingress.at,
            day,
          )}, and the mood turns with it.`
        : `The Moon stays in ${moon.sign.name} all day, so the mood holds its shape.`,
      reading.retrogrades.length > 0
        ? `${reading.retrogrades
            .map((body) => BODY_PROFILES[body].name)
            .join(', ')} ${
            reading.retrogrades.length === 1 ? 'is' : 'are'
          } retrograde — and ${BODY_PROFILES[reading.retrogrades[0]].name} retrograde asks for ${
            BODY_LORE[reading.retrogrades[0]].retrograde ??
            'a second pass over ground you have already covered'
          }`
        : `Everything in the sky is moving forwards, which is rarer than it sounds.`,
    ].join(' '),
  ]

  const seed = Math.round(placementOf(natal, 'sun').longitude)

  const passage = passageOf(reading, sky, natal, leading)

  const easeOffFrom = all.find((transit) => transit.kind.temper === 'charged')

  return {
    reading,
    sky,
    overview,
    areas: areasOf(natal, sky, all),
    hours: hoursOf(natal, day),
    power: powerWindowOf(natal, day),
    quiet: voidToday(sky, day),
    dials: dialsOf(sky, all),
    passage,
    tomorrow: tomorrowOf(natal, where, day),
    workings: workingsOf(natal, sky, where, all, day),
    /*
     * Deliberately not `ASPECT_LORE[...].use` — the overview paragraph above
     * already ends on that sentence, and a card repeating the paragraph two
     * inches under it is the single easiest way to make a long reading feel
     * padded. The action comes from the planet instead.
     */
    doThis: leading ? BODY_LORE[leading.from].today : phase.doThis,
    easeOff: easeOffFrom
      ? `${BODY_PROFILES[easeOffFrom.from].name} is ${easeOffFrom.kind.name === 'square' ? 'leaning on' : 'pulling at'} your ${pointName(
          easeOffFrom.to,
        )} — ${lower(ASPECT_LORE[easeOffFrom.kind.id].cost.replace(/\.$/, ''))}. That is the one to stop forcing today.`
      : `Nothing needs forcing today. If something feels like it does, it is probably not today's job.`,
    ask: [moonLore.question, BODY_LORE[leading?.from ?? 'moon'].question, phase.question][
      hash(`${reading.day}:ask:${seed}`) % 3
    ],
    skyLine: skyLineFor(reading, reading.day, seed),
    shareText: shareTextOf(reading, sky, passage),
  }
}

/**
 * The reading as plain text, for the copy button.
 *
 * The passage goes in last and whole. It is the part somebody is most likely
 * to want somewhere else — pasted to a friend, kept in a notes app, read out
 * at the end of a hard week — and a share sheet that hands over four bullet
 * points about orbs while withholding the only paragraph written to be said
 * aloud has the priorities of this feature exactly backwards.
 */
function shareTextOf(reading: DailyReading, sky: Chart, passage: Passage): string {
  const moon = placementOf(sky, 'moon')
  return [
    `${new Date(`${reading.day}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })} — ${reading.weatherWord.toLowerCase()} day`,
    '',
    reading.headline,
    '',
    `Moon in ${moon.sign.name}, ${sky.phase.name.toLowerCase()}, ${Math.round(
      sky.phase.illumination * 100,
    )}% lit.`,
    '',
    ...reading.highlights.map((highlight) => `· ${highlight.title} — ${highlight.body}`),
    '',
    `Today, strengthen ${reading.focus.label.toLowerCase()}.`,
    `“${passage.text}”`,
  ].join('\n')
}
