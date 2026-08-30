/**
 * Two charts, side by side.
 *
 * ── Why this is here ────────────────────────────────────────────────────────
 *
 * Because it is the most fun anybody has with astrology, and because fun is
 * not a lesser reason. A practice app is opened on the good days by whatever
 * is delightful in it, and comparing your chart to your sister's is the single
 * most delightful thing this feature can do. It is also, unexpectedly, useful:
 * the honest version of synastry is a description of *where two people's needs
 * differ*, and being handed that in plain words is worth more than most advice
 * about communication.
 *
 * ── The rules, which matter more here than anywhere else ────────────────────
 *
 * This module describes **two charts**, never two people, and it says so on the
 * screen. It never rates a relationship, never scores anybody out of ten as a
 * partner, never says whether to stay or go, and never implies anything about
 * what somebody else feels or intends — that would be a claim about a third
 * party who did not consent to being read, which is a line this app does not
 * go near.
 *
 * What it does instead is name the contacts that exist between two charts and
 * what each one is like: where the warmth is, where the friction is, what each
 * person finds easy that the other finds hard. Every "watch" entry is written
 * as a difference to understand rather than as a fault to be corrected, and the
 * whole thing lands on one line the two of them could actually say.
 */

import { longitudeOfPoint, placementOf, type Chart } from './chart'
import {
  aspectBetween,
  BODY_PROFILES,
  ELEMENT_LABEL,
  pointName,
  type AspectKind,
  type Element,
  type Point,
} from './signs'
import { ASPECT_LORE, SIGN_LORE } from './lore'
import type { AspectId } from './signs'
import type { Body } from './ephemeris'

export interface BondContact {
  /** Their body. */
  from: Body
  /** Your point. */
  to: Point
  kind: AspectKind
  orb: number
  significance: number
  /** "Their Venus △ your Moon" */
  title: string
  /** What this contact is like between two people. */
  text: string
}

export interface BondScore {
  key: 'warmth' | 'spark' | 'mind' | 'depth' | 'ease'
  label: string
  /** 0–100, bounded away from both ends. */
  value: number
  caption: string
}

export interface Bond {
  name: string
  /** One line at the top. */
  headline: string
  /** Two or three sentences on the shape of it. */
  summary: string
  scores: BondScore[]
  contacts: BondContact[]
  /** What is genuinely easy between these two charts. */
  works: string[]
  /** Where the two charts want different things. Never a warning. */
  watch: string[]
  /** The elements, compared. */
  elements: string
  /** The two Moons, compared — the most practical paragraph here. */
  moons: string
  /** One line the two of them could say. */
  sharedLine: string
}

/* Their bodies, and the points in your chart worth measuring them against. */
const THEIRS: Body[] = [
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

const MINE: Point[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'ascendant',
  'midheaven',
]

/**
 * What each aspect means between two charts rather than inside one.
 *
 * The daily textures in `signs.ts` are written about a day — "whatever it is,
 * it is loud *today*" — and reused here they produce sentences about a
 * friendship that expire at midnight. These are the same six contacts
 * described as what they are between two people, which is a different and
 * longer-lived thing.
 */
const BETWEEN: Record<AspectId, string> = {
  conjunction:
    'these two parts of you sit in the same place, so you amplify each other here — for better and for louder',
  opposition:
    'you sit at opposite ends of one axis: each of you holds the half the other keeps losing',
  trine:
    'this part runs easily between you, and it will keep running whether or not either of you tends it',
  square:
    'this is where you rub — and also where you make each other move, which is the same sentence twice',
  sextile: 'an easy opening between you, on the condition that somebody takes it up',
  quincunx:
    'two things that never quite line up, and that go better with a small standing adjustment than with a solution',
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** Every contact between two charts, strongest first. */
function contactsBetween(mine: Chart, theirs: Chart): BondContact[] {
  const found: BondContact[] = []

  for (const body of THEIRS) {
    const theirPlacement = placementOf(theirs, body)

    for (const point of MINE) {
      const myLongitude = longitudeOfPoint(mine, point)
      if (myLongitude == null) continue

      const aspect = aspectBetween(theirPlacement.longitude, myLongitude)
      if (!aspect) continue

      const personal = (candidate: Point) =>
        candidate === 'sun' ||
        candidate === 'moon' ||
        candidate === 'venus' ||
        candidate === 'ascendant'

      const significance =
        aspect.exactness *
        aspect.kind.weight *
        (personal(point) ? 1 : 0.8) *
        (['sun', 'moon', 'venus', 'mars'].includes(body) ? 1 : 0.85)

      const mineName =
        point === 'ascendant'
          ? 'your rising degree'
          : point === 'midheaven'
            ? 'the top of your chart'
            : `your ${BODY_PROFILES[point].yours}`

      found.push({
        from: body,
        to: point,
        kind: aspect.kind,
        orb: aspect.orb,
        significance,
        title: `Their ${BODY_PROFILES[body].name} ${aspect.kind.symbol} your ${pointName(point)}`,
        text: `Their ${BODY_PROFILES[body].name} ${aspect.kind.verb} ${mineName} — ${
          BETWEEN[aspect.kind.id]
        }.`,
      })
    }
  }

  return found.sort((a, b) => b.significance - a.significance)
}

/** How much of a set of contacts falls between particular pairs of bodies. */
function weightOf(
  contacts: BondContact[],
  theirs: Body[],
  mine: Point[],
  flowingOnly = false,
): number {
  return contacts
    .filter(
      (contact) =>
        theirs.includes(contact.from) &&
        mine.includes(contact.to) &&
        (!flowingOnly || contact.kind.temper !== 'charged'),
    )
    .reduce((total, contact) => total + contact.significance, 0)
}

const ELEMENT_CHEMISTRY: Record<string, string> = {
  'fire-fire': 'Two fire suns: fast, warm and loud, with nobody in the room inclined to slow it down.',
  'fire-earth': 'Fire and earth: one of you wants to go now and the other wants it to hold up in six months. Both are right, and the argument is the useful part.',
  'fire-air': 'Fire and air: air gives fire something to burn and fire gives air somewhere to land. The easiest of the mixes, and the one most likely to forget to eat.',
  'fire-water': 'Fire and water: intensity from opposite directions — one of you moves first, the other feels first. It works when neither treats the other’s speed as a character flaw.',
  'earth-earth': 'Two earth suns: solid, practical and slow to change, which is either a life you can build on or a rut, depending entirely on what you do on purpose.',
  'earth-air': 'Earth and air: ideas meeting logistics. Air brings the plan and earth asks who is actually doing it, which is a partnership or a running joke.',
  'earth-water': 'Earth and water: the classic supportive mix — one holds the shape and the other fills it. Comfortable, and worth occasionally disturbing.',
  'air-air': 'Two air suns: talk, ideas and plenty of room, with the standing risk that everything gets discussed and nothing gets felt.',
  'air-water': 'Air and water: one of you explains the feeling and the other has it. Endlessly interesting, and the place where being misunderstood happens most.',
  'water-water': 'Two water suns: you will know what the other is feeling before it is mentioned, which is both the gift and the whole difficulty.',
}

function chemistry(a: Element, b: Element): string {
  return (
    ELEMENT_CHEMISTRY[`${a}-${b}`] ??
    ELEMENT_CHEMISTRY[`${b}-${a}`] ??
    'Two charts with plenty to talk about.'
  )
}

const SHARED_LINES: Record<BondScore['key'], string> = {
  warmth: 'We are allowed to be easy with each other.',
  spark: 'We bring something out in each other worth using well.',
  mind: 'We can say the true thing to each other.',
  depth: 'We can hold something heavy together.',
  ease: 'There is nothing here that needs forcing.',
}

export function bondBetween(mine: Chart, theirs: Chart, name: string): Bond {
  const contacts = contactsBetween(mine, theirs)

  const flowing = contacts
    .filter((contact) => contact.kind.temper === 'flowing')
    .reduce((total, contact) => total + contact.significance, 0)
  const charged = contacts
    .filter((contact) => contact.kind.temper === 'charged')
    .reduce((total, contact) => total + contact.significance, 0)

  const soften = (value: number) => Math.tanh(value)

  const scores: BondScore[] = [
    {
      key: 'warmth',
      label: 'Warmth',
      value: Math.round(
        clamp(
          38 + soften(weightOf(contacts, ['venus', 'moon', 'sun'], ['moon', 'venus', 'sun'])) * 48,
          14,
          94,
        ),
      ),
      caption: 'Venus and Moon contacts — the ordinary daily fondness of a thing.',
    },
    {
      key: 'spark',
      label: 'Spark',
      value: Math.round(
        clamp(
          36 +
            soften(weightOf(contacts, ['mars', 'sun', 'uranus'], ['sun', 'mars', 'venus', 'ascendant'])) *
              50,
          14,
          94,
        ),
      ),
      caption: 'Mars and Sun contacts — energy, attraction and the willingness to argue.',
    },
    {
      key: 'mind',
      label: 'Mind',
      value: Math.round(
        clamp(
          38 + soften(weightOf(contacts, ['mercury', 'jupiter', 'uranus'], ['mercury', 'sun', 'moon'])) * 48,
          14,
          94,
        ),
      ),
      caption: 'Mercury contacts — whether you follow each other without translating.',
    },
    {
      key: 'depth',
      label: 'Depth',
      value: Math.round(
        clamp(
          34 + soften(weightOf(contacts, ['saturn', 'pluto', 'neptune'], ['sun', 'moon', 'venus', 'ascendant'])) * 52,
          14,
          94,
        ),
      ),
      caption: 'Saturn and Pluto contacts — the weight a bond can carry, and what it costs.',
    },
    {
      key: 'ease',
      label: 'Ease',
      value: Math.round(clamp(50 + soften(flowing) * 34 - soften(charged) * 34, 14, 94)),
      caption: 'How much of what is here runs smoothly, and how much has friction in it.',
    },
  ]

  const strongest = [...scores].sort((a, b) => b.value - a.value)[0]

  const mySun = placementOf(mine, 'sun')
  const theirSun = placementOf(theirs, 'sun')
  const myMoon = placementOf(mine, 'moon')
  const theirMoon = placementOf(theirs, 'moon')

  const works = contacts
    .filter((contact) => contact.kind.temper !== 'charged')
    .slice(0, 3)
    .map((contact) => `${contact.title} — ${BETWEEN[contact.kind.id]}.`)

  const watch = contacts
    .filter((contact) => contact.kind.temper === 'charged')
    .slice(0, 2)
    .map(
      (contact, index) =>
        `${contact.title} — ${BETWEEN[contact.kind.id]}.${
          /*
           * The framing sentence once, under the first one. Repeating "this is
           * a difference rather than a fault" under every entry turns the one
           * line on this screen that actually needed saying into wallpaper.
           */
          index === 0
            ? ' Differences like these are in how the two of you are built; neither of you is doing them wrong.'
            : ` ${ASPECT_LORE[contact.kind.id].use}`
        }`,
    )

  const summary = [
    `${chemistry(mySun.sign.element, theirSun.sign.element)}`,
    contacts[0]
      ? `The strongest single contact between the two charts is ${
          contacts[0].title.charAt(0).toLowerCase() + contacts[0].title.slice(1)
        } — ${BETWEEN[contacts[0].kind.id]}.`
      : `There is very little contact between these two charts, which is its own kind of easy: you are unlikely to get tangled in each other's weather.`,
    `${strongest.label.toLowerCase() === 'ease' ? 'What stands out is how little friction there is' : `What stands out is the ${strongest.label.toLowerCase()}`}.`,
  ].join(' ')

  const moons =
    myMoon.sign.name === theirMoon.sign.name
      ? `You both have the Moon in ${myMoon.sign.name}, so you settle the same way: through ${SIGN_LORE[myMoon.sign.name].needs}. That is a rare comfort and it has exactly one blind spot — neither of you supplies what the other is short of, and you will both run out of the same thing in the same week.`
      : `Your Moon is in ${myMoon.sign.name} and ${name}'s is in ${theirMoon.sign.name}. You settle through ${SIGN_LORE[myMoon.sign.name].needs}; they settle through ${SIGN_LORE[theirMoon.sign.name].needs}. That difference is the most practical thing on this page — most of what goes wrong between two people who like each other is one of them offering the comfort they would have wanted themselves.`

  return {
    name,
    headline: contacts[0]
      ? `${contacts[0].title}`
      : `Two charts with plenty of room between them`,
    summary,
    scores,
    contacts: contacts.slice(0, 6),
    works:
      works.length > 0
        ? works
        : ['Nothing is tightly aspected between these charts — a rare, uncomplicated overlap.'],
    watch:
      watch.length > 0
        ? watch
        : ['Nothing here has friction in it, which is unusual and worth not taking for granted.'],
    elements: `${mySun.sign.name} Sun (${ELEMENT_LABEL[mySun.sign.element].toLowerCase()}) and ${theirSun.sign.name} Sun (${ELEMENT_LABEL[theirSun.sign.element].toLowerCase()}).`,
    moons,
    sharedLine: SHARED_LINES[strongest.key],
  }
}
