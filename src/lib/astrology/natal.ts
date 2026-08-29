/**
 * The portrait: a birth chart read as a description of a person rather than as
 * a table of coordinates.
 *
 * ── What this is for ────────────────────────────────────────────────────────
 *
 * The daily reading answers "what is today like". This answers the question
 * people actually arrive with, which is "what am I like" — and it is the part
 * that gets read slowly, once, and then returned to. A daily horoscope earns a
 * visit; a portrait earns the setup.
 *
 * ── How it avoids being a fortune cookie ────────────────────────────────────
 *
 * Three ways, all of them structural rather than editorial.
 *
 * **It is assembled from what is actually in the chart.** Every sentence below
 * traces back to a real position — a sign, a house, an aspect within orb, a
 * count of planets in an element. Nothing is drawn from a hat, and two people
 * born a month apart get visibly different text because their charts are
 * visibly different.
 *
 * **It says the cost as well as the gift.** Every sign entry in `lore.ts` has
 * an `edge`, and the portrait always shows them together. A reading made only
 * of compliments is one nobody believes twice, and the recognition — *oh, that
 * is embarrassingly accurate* — only ever comes from the uncomfortable half.
 *
 * **It refuses to guess.** No birth time means no Ascendant and no houses, and
 * this file says so in the places where the missing thing would have gone
 * rather than quietly filling it with noon. The blur is named; the reader can
 * fix it in thirty seconds by adding their birth time, and watching the
 * portrait sharpen is a better argument for accuracy than any warning label.
 */

import {
  aspectBetween,
  BODY_PROFILES,
  ELEMENT_LABEL,
  formatShort,
  MODALITY_LABEL,
  pointName,
  signOf,
  type AspectKind,
  type Element,
  type Modality,
  type Point,
  type Sign,
} from './signs'
import {
  ASPECT_LORE,
  BODY_LORE,
  ELEMENT_CARE,
  houseOf,
  MODALITY_NOTE,
  ORDINALS,
  SIGN_LORE,
  type House,
  type SignLore,
} from './lore'
import { longitudeOfPoint, placementOf, type Chart, type Placement } from './chart'
import type { Body } from './ephemeris'

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/* ── The big three ───────────────────────────────────────────── */

export interface TrioEntry {
  key: 'sun' | 'moon' | 'rising'
  label: string
  /** "Leo", or "Unknown" when there is no birth time. */
  sign: string
  symbol: string
  /** "18° Leo · Fire", under the name. */
  detail: string
  /** What this one *is*, in one line. */
  role: string
  /** Two or three sentences about this placement in particular. */
  body: string
  lore: SignLore | null
}

/**
 * Sun, Moon and Rising, written out.
 *
 * In that order because that is the order people say them in, and with a line
 * of their own each because the single most common thing anybody wants from a
 * chart is to be told what their three mean — and the second most common is to
 * be told why they are not the same thing.
 */
function trioOf(chart: Chart): TrioEntry[] {
  const sun = placementOf(chart, 'sun')
  const moon = placementOf(chart, 'moon')
  const sunLore = SIGN_LORE[sun.sign.name]
  const moonLore = SIGN_LORE[moon.sign.name]

  const entries: TrioEntry[] = [
    {
      key: 'sun',
      label: 'Sun',
      sign: sun.sign.name,
      symbol: sun.sign.symbol,
      detail: `${formatShort(sun.longitude)} · ${ELEMENT_LABEL[sun.sign.element]}`,
      role: 'Who you are when nobody is managing you',
      body: `Your Sun is in ${sun.sign.name}, so at the centre you ${sunLore.you}. Spent well, that shows up as ${sunLore.gifts}. The cost of the same trait is ${sunLore.edge}.`,
      lore: sunLore,
    },
    {
      key: 'moon',
      label: 'Moon',
      sign: moon.sign.name,
      symbol: moon.sign.symbol,
      detail: chart.precise
        ? `${formatShort(moon.longitude)} · ${ELEMENT_LABEL[moon.sign.element]}`
        : 'Approximate — a birth time would settle it',
      role: 'What you need in order to feel safe',
      body: `Your Moon is in ${moon.sign.name}: privately, underneath everything, you ${moonLore.you}. What you need in order to feel like yourself is ${moonLore.needs}. The tell that you are running on empty is ${moonLore.edge.split('.')[0].toLowerCase()}.${
        chart.precise
          ? ''
          : ' Without a birth time this one is the least certain thing here — the Moon moves far enough in a day to change sign about once every four births.'
      }`,
      lore: moonLore,
    },
  ]

  if (chart.ascendant != null) {
    const rising = signOf(chart.ascendant)
    const risingLore = SIGN_LORE[rising.name]
    entries.push({
      key: 'rising',
      label: 'Rising',
      sign: rising.name,
      symbol: rising.symbol,
      detail: `${formatShort(chart.ascendant)} · ${ELEMENT_LABEL[rising.element]}`,
      role: 'How you arrive, and what people meet first',
      body: `${rising.name} is rising, so you come into a room as somebody who ${rising.quality}. That is not a mask — it is the part of you closest to the surface, and it is why people who have just met you describe someone your close friends would not recognise. It gives you ${risingLore.gifts}.`,
      lore: risingLore,
    })
  } else {
    entries.push({
      key: 'rising',
      label: 'Rising',
      sign: 'Unknown',
      symbol: '·',
      detail: 'Needs your birth time',
      role: 'How you arrive, and what people meet first',
      body: 'The rising sign moves a degree every four minutes, which means an hour of uncertainty is fifteen degrees and a guess is very often a whole sign wrong. Rather than invent one, this is left blank — add a birth time and it appears, along with all twelve houses.',
      lore: null,
    })
  }

  return entries
}

/* ── Balance ─────────────────────────────────────────────────── */

export interface Balance {
  elements: Record<Element, number>
  modalities: Record<Modality, number>
  lead: Element
  /** The element with nothing or almost nothing in it, if there is one. */
  missing: Element | null
  leadModality: Modality
  /** Two or three sentences about the mix. */
  note: string
}

/** Only the ten bodies count; the Node is a direction rather than a part of somebody. */
const COUNTED: Body[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
]

/**
 * Which elements a chart is actually made of.
 *
 * The lights count double and the Ascendant counts once when it is known,
 * which is the ordinary weighting — a chart with the Sun and Moon in water is
 * a water chart whatever the outer planets are doing, because those are the
 * two you experience from the inside.
 */
function balanceOf(chart: Chart): Balance {
  const elements: Record<Element, number> = { fire: 0, earth: 0, air: 0, water: 0 }
  const modalities: Record<Modality, number> = { cardinal: 0, fixed: 0, mutable: 0 }

  for (const placement of chart.placements) {
    if (!COUNTED.includes(placement.body)) continue
    const weight = placement.body === 'sun' || placement.body === 'moon' ? 2 : 1
    elements[placement.sign.element] += weight
    modalities[placement.sign.modality] += weight
  }

  if (chart.ascendant != null) {
    const rising = signOf(chart.ascendant)
    elements[rising.element] += 1
    modalities[rising.modality] += 1
  }

  const lead = (Object.keys(elements) as Element[]).reduce((best, element) =>
    elements[element] > elements[best] ? element : best,
  )
  const least = (Object.keys(elements) as Element[]).reduce((worst, element) =>
    elements[element] < elements[worst] ? element : worst,
  )
  const leadModality = (Object.keys(modalities) as Modality[]).reduce((best, modality) =>
    modalities[modality] > modalities[best] ? modality : best,
  )

  const missing = elements[least] <= 1 ? least : null

  const note = [
    `This chart leans ${ELEMENT_LABEL[lead].toLowerCase()}. ${ELEMENT_CARE[lead].weather}`,
    missing
      ? `There is very little ${ELEMENT_LABEL[missing].toLowerCase()} in it, which usually means ${ELEMENT_CARE[missing].lack} — not a deficiency to be fixed, but a thing you will have to supply on purpose rather than get for free.`
      : `All four elements are represented, which tends to read as versatility from the outside and as a certain difficulty settling from the inside.`,
    MODALITY_NOTE[leadModality],
  ].join(' ')

  return { elements, modalities, lead, missing, leadModality, note }
}

/* ── The loudest planet ──────────────────────────────────────── */

export interface Dominant {
  body: Body
  /** Why this one won, in a clause. */
  why: string
  /** What having it loud is like. */
  note: string
}

/**
 * The planet that runs the place.
 *
 * Scored rather than declared, from the four things that traditionally make a
 * planet loud in a chart: ruling one of the big three, sitting on an angle,
 * being in its own sign, and being closely tied to the personal points. It is
 * the single most quoted line any chart service produces and it deserves an
 * actual calculation behind it.
 */
function dominantOf(chart: Chart): Dominant {
  const scores = new Map<Body, number>()
  const reasons = new Map<Body, string>()

  const add = (body: Body, weight: number, reason: string) => {
    scores.set(body, (scores.get(body) ?? 0) + weight)
    if (!reasons.has(body)) reasons.set(body, reason)
  }

  const sun = placementOf(chart, 'sun')
  const moon = placementOf(chart, 'moon')

  add(sun.sign.ruler, 2, `it rules your Sun sign, ${sun.sign.name}`)
  add(moon.sign.ruler, 1.6, `it rules your Moon sign, ${moon.sign.name}`)

  if (chart.ascendant != null) {
    const rising = signOf(chart.ascendant)
    add(rising.ruler, 2.4, `it rules your rising sign, ${rising.name}`)
  }

  for (const placement of chart.placements) {
    if (!COUNTED.includes(placement.body)) continue

    // In its own sign: a planet at home is a planet you hear from.
    if (placement.sign.ruler === placement.body) {
      add(placement.body, 1.4, `it sits in its own sign, ${placement.sign.name}`)
    }

    // On an angle: the first, fourth, seventh and tenth are the loud houses.
    if (placement.house != null && [1, 4, 7, 10].includes(placement.house)) {
      add(
        placement.body,
        placement.house === 1 || placement.house === 10 ? 1.8 : 1.2,
        `it sits on an angle of your chart, in the ${ORDINALS[placement.house - 1]} house`,
      )
    }

    // Tied closely to the Sun or Moon.
    for (const light of ['sun', 'moon'] as const) {
      if (placement.body === light) continue
      const aspect = aspectBetween(
        placement.longitude,
        placementOf(chart, light).longitude,
      )
      if (aspect && aspect.orb < 4) {
        add(
          placement.body,
          0.9 * aspect.exactness,
          `it is tightly aspected to your ${BODY_PROFILES[light].name}`,
        )
      }
    }
  }

  let best: Body = 'sun'
  let bestScore = -1
  for (const [body, score] of scores) {
    if (score > bestScore) {
      bestScore = score
      best = body
    }
  }

  return {
    body: best,
    why: reasons.get(best) ?? 'it is the strongest voice in the chart',
    note: BODY_LORE[best].about,
  }
}

/* ── Where the weight sits ───────────────────────────────────── */

export interface Emphasis {
  house: House
  count: number
  bodies: Body[]
  note: string
}

/** Three or more bodies in one house is a genuine emphasis and worth saying. */
function emphasisOf(chart: Chart): Emphasis | null {
  const byHouse = new Map<number, Body[]>()
  for (const placement of chart.placements) {
    if (placement.house == null || !COUNTED.includes(placement.body)) continue
    byHouse.set(placement.house, [...(byHouse.get(placement.house) ?? []), placement.body])
  }

  let best: { house: number; bodies: Body[] } | null = null
  for (const [house, bodies] of byHouse) {
    if (bodies.length < 3) continue
    if (!best || bodies.length > best.bodies.length) best = { house, bodies }
  }
  if (!best) return null

  const house = houseOf(best.house)
  return {
    house,
    count: best.bodies.length,
    bodies: best.bodies,
    note: `${best.bodies.length} of your planets are stacked in the ${ORDINALS[best.house - 1]} house. ${house.about} A pile-up like that means this area of life is never quiet for you — it is where a disproportionate amount of your attention, talent and trouble ends up, whether or not you chose it.`,
  }
}

/* ── Every placement, written out ────────────────────────────── */

export interface PlacementNote {
  body: Body
  /** "Mars in Cancer · fifth house" */
  title: string
  sign: Sign
  house: House | null
  retrograde: boolean
  /** The full-length interpretation. Two or three sentences. */
  text: string
  /** The one question this placement asks. */
  question: string
}

function placementNote(placement: Placement): PlacementNote {
  const profile = BODY_PROFILES[placement.body]
  const lore = BODY_LORE[placement.body]
  const signLore = SIGN_LORE[placement.sign.name]
  const house = placement.house != null ? houseOf(placement.house) : null

  const sentences = [
    `${lore.about}`,
    `In ${placement.sign.name} it ${signLore.through}, so your ${profile.yours} works the way ${placement.sign.name} does: ${signLore.keyword.toLowerCase()}, and ${placement.sign.mood.split(';')[0]}.`,
  ]

  if (house) {
    sentences.push(
      `It lands in your ${ORDINALS[house.number - 1]} house, the part of life about ${house.domain}, which is where this shows up most visibly.`,
    )
  }

  if (placement.retrograde && lore.retrograde) {
    sentences.push(
      `It was retrograde when you were born, which is common and is not a fault: it tends to mean this part of you works inward first and arrives in public later than other people expect.`,
    )
  }

  return {
    body: placement.body,
    title: `${profile.name} in ${placement.sign.name}${
      house ? ` · ${ORDINALS[house.number - 1]} house` : ''
    }`,
    sign: placement.sign,
    house,
    retrograde: placement.retrograde,
    text: sentences.join(' '),
    question: lore.question,
  }
}

/* ── The chart talking to itself ─────────────────────────────── */

export interface NatalAspect {
  a: Point
  b: Point
  kind: AspectKind
  orb: number
  significance: number
  /** "Moon □ Saturn" */
  title: string
  /** What this pairing is like to live with. */
  body: string
  /** How to work with it. */
  use: string
}

const ASPECT_POINTS: Point[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'ascendant',
  'midheaven',
]

/**
 * The aspects a chart makes to itself, strongest first.
 *
 * These are the sentences people recognise themselves in hardest — "your Moon
 * squares your Saturn" is, for the person it belongs to, an uncomfortably
 * specific description of a lifelong argument. The orb is kept tighter than
 * for transits: a natal aspect is permanent, so a loose one that would be
 * worth mentioning for an afternoon is just noise across a life.
 */
export function natalAspects(chart: Chart, limit = 8): NatalAspect[] {
  const found: NatalAspect[] = []

  for (let i = 0; i < ASPECT_POINTS.length; i += 1) {
    for (let j = i + 1; j < ASPECT_POINTS.length; j += 1) {
      const a = ASPECT_POINTS[i]
      const b = ASPECT_POINTS[j]
      const first = longitudeOfPoint(chart, a)
      const second = longitudeOfPoint(chart, b)
      if (first == null || second == null) continue

      const aspect = aspectBetween(first, second)
      if (!aspect) continue
      // Tighter than a transit orb, for the reason in the comment above.
      if (aspect.orb > aspect.kind.orb * 0.72) continue

      const personal = (point: Point) =>
        point === 'sun' ||
        point === 'moon' ||
        point === 'ascendant' ||
        point === 'midheaven'

      const significance =
        aspect.exactness *
        aspect.kind.weight *
        (personal(a) || personal(b) ? 1 : 0.75)

      const nameA = pointName(a)
      const nameB = pointName(b)
      /*
       * "Your appetite for more and your what you are building in public" is
       * the sentence this avoids. The two angles are already noun phrases and
       * take no possessive; the planets do.
       */
      const about = (point: Point) =>
        point === 'ascendant'
          ? 'the way you arrive'
          : point === 'midheaven'
            ? 'what you are building in public'
            : `your ${BODY_PROFILES[point].yours}`

      found.push({
        a,
        b,
        kind: aspect.kind,
        orb: aspect.orb,
        significance,
        title: `${nameA} ${aspect.kind.symbol} ${nameB}`,
        body: `${capitalise(about(a))} and ${about(b)} are in ${aspect.kind.name} — ${aspect.kind.texture}.`,
        use: ASPECT_LORE[aspect.kind.id].use,
      })
    }
  }

  return found.sort((x, y) => y.significance - x.significance).slice(0, limit)
}

/* ── The whole portrait ──────────────────────────────────────── */

export interface Portrait {
  trio: TrioEntry[]
  /** The paragraph that ties the three together. */
  opening: string
  balance: Balance
  dominant: Dominant
  emphasis: Emphasis | null
  gifts: string[]
  edges: string[]
  /** How this person actually rests. */
  recharge: string
  /** What healing looks like for them, specifically. */
  heals: string
  placements: PlacementNote[]
  aspects: NatalAspect[]
  /** True when there is no birth time, so every screen can say so once. */
  blurred: boolean
}

export function portraitOf(chart: Chart): Portrait {
  const sun = placementOf(chart, 'sun')
  const moon = placementOf(chart, 'moon')
  const rising = chart.ascendant != null ? signOf(chart.ascendant) : null

  const balance = balanceOf(chart)
  const dominant = dominantOf(chart)

  const sunLore = SIGN_LORE[sun.sign.name]
  const moonLore = SIGN_LORE[moon.sign.name]
  const risingLore = rising ? SIGN_LORE[rising.name] : null

  /*
   * The opening paragraph is the one thing here that has to work on a person
   * who will read nothing else, so it does the one job a chart summary can
   * honestly do: name the three-way tension between what somebody is at the
   * centre, what they need underneath, and how they come across — because the
   * gap between those three is what makes a person hard to explain, and being
   * told the shape of your own is the most useful thing in the whole feature.
   */
  const opening = [
    `You are a ${sun.sign.name} with a ${moon.sign.name} Moon${
      rising ? ` and ${rising.name} rising` : ''
    }.`,
    `At the centre you ${sunLore.you}; underneath, what you need is ${moonLore.needs}.`,
    rising
      ? `And the version of you that arrives first ${rising.quality} — which is why the impression people form in ten minutes so rarely matches the one they form in ten months.`
      : `Without a birth time the third piece — how you come across on arrival — is missing, and it is the one that explains most of the mismatch between how people read you and how you feel.`,
    sun.sign.element === moon.sign.element
      ? `Your Sun and Moon are both ${ELEMENT_LABEL[sun.sign.element].toLowerCase()}, which makes you unusually of a piece: what you want and what you need point the same way, and when that direction is blocked there is no second system to fall back on.`
      : `Your Sun is ${ELEMENT_LABEL[sun.sign.element].toLowerCase()} and your Moon is ${ELEMENT_LABEL[moon.sign.element].toLowerCase()} — two different currencies. Days that satisfy one can leave the other completely unpaid, and knowing which one is hungry is most of the skill of looking after yourself.`,
  ].join(' ')

  const gifts = [
    `${sun.sign.name} Sun: ${sunLore.gifts}.`,
    `${moon.sign.name} Moon: you offer other people ${moonLore.needs} — usually before they have asked.`,
    risingLore ? `${rising!.name} rising: ${risingLore.gifts}.` : null,
    `${ELEMENT_LABEL[balance.lead]}-led: ${ELEMENT_CARE[balance.lead].weather.split('. ')[1] ?? ELEMENT_CARE[balance.lead].weather}`,
  ].filter((line): line is string => line != null)

  const edges = [
    `${sun.sign.name} Sun: ${sunLore.edge}.`,
    `${moon.sign.name} Moon: ${moonLore.edge}.`,
    balance.missing
      ? `Light on ${ELEMENT_LABEL[balance.missing].toLowerCase()}: ${ELEMENT_CARE[balance.missing].lack}. You will have to arrange it deliberately, because it does not arrive on its own.`
      : `${MODALITY_LABEL[balance.leadModality]}-heavy: ${MODALITY_NOTE[balance.leadModality].split(': ')[1]}`,
  ]

  const recharge = `Rest, for you, is ${ELEMENT_LABEL[moon.sign.element].toLowerCase()}-shaped. ${moonLore.care} ${moonLore.ritual}`

  const heals = `Your Moon heals ${BODY_LORE.moon.heals} For a ${moon.sign.name} Moon that means ${moonLore.needs}. The fastest physical way in: ${ELEMENT_CARE[moon.sign.element].sensory}`

  const placements = chart.placements
    .filter((placement) => placement.body !== 'node')
    .map(placementNote)

  return {
    trio: trioOf(chart),
    opening,
    balance,
    dominant,
    emphasis: emphasisOf(chart),
    gifts,
    edges,
    recharge,
    heals,
    placements,
    aspects: natalAspects(chart),
    blurred: !chart.precise,
  }
}
