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
 * So this file wraps the reading and adds the four things a daily practice can
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
import { aspectBetween, BODY_PROFILES, ELEMENT_LABEL, pointName, type Element } from './signs'
import { ASPECT_LORE, BODY_LORE, ELEMENT_CARE, phaseLore, SIGN_LORE } from './lore'
import { ELEMENT_CLAUSE, readToday, type DailyReading } from './reading'
import { longitudeOfPoint } from './chart'
import type { Point } from './signs'

/* ── Small shared helpers ────────────────────────────────────── */

/** Local noon on the calendar day `at` falls in. */
export function noonOf(at: Date): Date {
  const noon = new Date(at)
  noon.setHours(12, 0, 0, 0)
  return noon
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
  dials: Dial[]
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
        ? `The Moon crosses into ${reading.ingress.sign.name} at ${reading.ingress.at.toLocaleTimeString(
            undefined,
            { hour: 'numeric', minute: '2-digit' },
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

  const easeOffFrom = all.find((transit) => transit.kind.temper === 'charged')

  return {
    reading,
    sky,
    overview,
    areas: areasOf(natal, sky, all),
    hours: hoursOf(natal, day),
    power: powerWindowOf(natal, day),
    dials: dialsOf(sky, all),
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
    shareText: shareTextOf(reading, sky),
  }
}

/** The reading as plain text, for the copy button. */
function shareTextOf(reading: DailyReading, sky: Chart): string {
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
    `“${reading.affirmation}”`,
  ].join('\n')
}
