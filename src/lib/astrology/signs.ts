/**
 * The vocabulary: twelve signs, eleven bodies, six aspects.
 *
 * Everything the readings say is assembled out of the fragments in this file,
 * and the register they are written in is a deliberate choice that took as
 * long to settle as the arithmetic next door.
 *
 * Astrology writing has two failure modes. It flatters — *your natural
 * magnetism draws opportunity to you* — which is pleasant once and worthless
 * twice, because it could be said to anyone about any day. Or it predicts —
 * *avoid signing contracts on Thursday* — which is a claim about the world
 * this app has no business making to somebody who came here to breathe.
 *
 * What is written here does neither. Every fragment describes a *quality of
 * attention*: what a day is shaped like, what is easy in it, what is worth
 * noticing. That is a thing a person can check against their own experience
 * and find true or not, it is genuinely different from one week to the next
 * because the sky is, and it lands somewhere useful in an app whose actual
 * purpose is helping somebody choose what to say to themselves this morning.
 *
 * The other rule: never a bad day. Saturn square your Moon is a real transit
 * with a real texture and it is not a punishment; it is a day when things ask
 * to be taken seriously. Anything that reads as a warning has been rewritten.
 */

import type { Body } from './ephemeris'
import type { FocusId } from '../affirmations'

/* ── Signs ───────────────────────────────────────────────────── */

export type Element = 'fire' | 'earth' | 'air' | 'water'
export type Modality = 'cardinal' | 'fixed' | 'mutable'

export interface Sign {
  name: string
  symbol: string
  element: Element
  modality: Modality
  ruler: Body
  /** One clause, used after "a day that…" or "you meet the world…". */
  quality: string
  /** What this sign is like when the Moon is passing through it. */
  mood: string
  /** Which of the app's own intents this sign leans towards. */
  focus: FocusId
}

export const SIGNS: Sign[] = [
  {
    name: 'Aries',
    symbol: '♈',
    element: 'fire',
    modality: 'cardinal',
    ruler: 'mars',
    quality: 'wants to start something rather than think about it',
    mood: 'quick and impatient, better spent moving than deciding',
    focus: 'motivation',
  },
  {
    name: 'Taurus',
    symbol: '♉',
    element: 'earth',
    modality: 'fixed',
    ruler: 'venus',
    quality: 'moves at the speed of comfort and will not be hurried',
    mood: 'slow, physical and unbothered — a good day to eat well and go outside',
    focus: 'health',
  },
  {
    name: 'Gemini',
    symbol: '♊',
    element: 'air',
    modality: 'mutable',
    ruler: 'mercury',
    quality: 'is curious about six things and committed to none of them',
    mood: 'talkative and scattered; write things down before they leave',
    focus: 'school',
  },
  {
    name: 'Cancer',
    symbol: '♋',
    element: 'water',
    modality: 'cardinal',
    ruler: 'moon',
    quality: 'is felt before it is understood',
    mood: 'tender and inward, and asking for somewhere soft to land',
    focus: 'self-worth',
  },
  {
    name: 'Leo',
    symbol: '♌',
    element: 'fire',
    modality: 'fixed',
    ruler: 'sun',
    quality: 'is happiest when it is warm, generous and slightly theatrical',
    mood: 'bright and wanting to be seen — let it be seen',
    focus: 'confidence',
  },
  {
    name: 'Virgo',
    symbol: '♍',
    element: 'earth',
    modality: 'mutable',
    ruler: 'mercury',
    quality: 'improves things by paying attention to the small ones',
    mood: 'precise and useful; the day tidies itself if you let it',
    focus: 'discipline',
  },
  {
    name: 'Libra',
    symbol: '♎',
    element: 'air',
    modality: 'cardinal',
    ruler: 'venus',
    quality: 'is looking for the fair version of the answer',
    mood: 'sociable and even-handed, and reluctant to choose',
    focus: 'relationships',
  },
  {
    name: 'Scorpio',
    symbol: '♏',
    element: 'water',
    modality: 'fixed',
    ruler: 'pluto',
    quality: 'goes all the way in or not at all',
    mood: 'deep and private; feelings arrive at full strength',
    focus: 'resilience',
  },
  {
    name: 'Sagittarius',
    symbol: '♐',
    element: 'fire',
    modality: 'mutable',
    ruler: 'jupiter',
    quality: 'wants the bigger version of whatever this is',
    mood: 'restless and hopeful, and bored by detail',
    focus: 'growth',
  },
  {
    name: 'Capricorn',
    symbol: '♑',
    element: 'earth',
    modality: 'cardinal',
    ruler: 'saturn',
    quality: 'is willing to do the boring part because it works',
    mood: 'serious and capable; long jobs feel possible',
    focus: 'career',
  },
  {
    name: 'Aquarius',
    symbol: '♒',
    element: 'air',
    modality: 'fixed',
    ruler: 'uranus',
    quality: 'would rather be honest than agreeable',
    mood: 'clear-headed and a little detached — good for perspective',
    focus: 'growth',
  },
  {
    name: 'Pisces',
    symbol: '♓',
    element: 'water',
    modality: 'mutable',
    ruler: 'neptune',
    quality: 'dissolves the edges between things',
    mood: 'dreamy and permeable; rest counts as progress',
    focus: 'sleep',
  },
]

export const ELEMENT_LABEL: Record<Element, string> = {
  fire: 'Fire',
  earth: 'Earth',
  air: 'Air',
  water: 'Water',
}

export const MODALITY_LABEL: Record<Modality, string> = {
  cardinal: 'Cardinal',
  fixed: 'Fixed',
  mutable: 'Mutable',
}

/** Which sign a longitude falls in. */
export function signOf(longitude: number): Sign {
  return SIGNS[Math.floor(((longitude % 360) + 360) % 360 / 30)]
}

/** The degree within the sign, 0–29. */
export function degreeInSign(longitude: number): number {
  return (((longitude % 360) + 360) % 360) % 30
}

/** "18° 42′ Scorpio", the way a chart prints it. */
export function formatPosition(longitude: number): string {
  const degrees = degreeInSign(longitude)
  const whole = Math.floor(degrees)
  const minutes = Math.round((degrees - whole) * 60)
  const carried = minutes === 60
  return `${carried ? whole + 1 : whole}° ${String(carried ? 0 : minutes).padStart(2, '0')}′ ${signOf(longitude).name}`
}

/** "18° Scorpio", for a sentence rather than a table. */
export function formatShort(longitude: number): string {
  return `${Math.floor(degreeInSign(longitude))}° ${signOf(longitude).name}`
}

/* ── Bodies ──────────────────────────────────────────────────── */

export interface BodyProfile {
  name: string
  symbol: string
  /** What this planet governs, as the subject of a sentence. */
  domain: string
  /** Completes "a day when …" for a transiting planet. */
  brings: string
  /** Completes "your … " for a natal point being contacted. */
  yours: string
  /**
   * How much a contact from this body matters, 0–1.
   *
   * The slow planets outrank the fast ones, because a Saturn transit is a
   * season and a Moon transit is an afternoon — and a reading that led with
   * the Moon every single day would have nothing to say about the difference
   * between this week and last.
   */
  weight: number
}

export const BODY_PROFILES: Record<Body, BodyProfile> = {
  sun: {
    name: 'Sun',
    symbol: '☉',
    domain: 'who you are when nobody is managing you',
    brings: 'the day has a centre and you are it',
    yours: 'sense of yourself',
    weight: 0.7,
  },
  moon: {
    name: 'Moon',
    symbol: '☽',
    domain: 'what you need in order to feel safe',
    brings: 'the mood moves quickly and means it while it lasts',
    yours: 'inner weather',
    weight: 0.35,
  },
  mercury: {
    name: 'Mercury',
    symbol: '☿',
    domain: 'how you think and how you say it',
    brings: 'words come easily and the thinking is quick',
    yours: 'way of thinking',
    weight: 0.5,
  },
  venus: {
    name: 'Venus',
    symbol: '♀',
    domain: 'what you love and how you want to be treated',
    brings: 'warmth is available and worth accepting',
    yours: 'sense of what is worth wanting',
    weight: 0.55,
  },
  mars: {
    name: 'Mars',
    symbol: '♂',
    domain: 'what you do about it',
    brings: 'there is energy here, and it would like a job',
    yours: 'drive',
    weight: 0.6,
  },
  jupiter: {
    name: 'Jupiter',
    symbol: '♃',
    domain: 'where you are allowed to want more',
    brings: 'the room is bigger than it was yesterday',
    yours: 'appetite for more',
    weight: 0.8,
  },
  saturn: {
    name: 'Saturn',
    symbol: '♄',
    domain: 'what you are building and what it costs',
    brings: 'things ask to be taken seriously, and reward it',
    yours: 'sense of what is solid',
    weight: 0.9,
  },
  uranus: {
    name: 'Uranus',
    symbol: '♅',
    domain: 'the part of you that will not be managed',
    brings: 'the usual answer is not the interesting one today',
    yours: 'need for room',
    weight: 0.85,
  },
  neptune: {
    name: 'Neptune',
    symbol: '♆',
    domain: 'what you imagine, and what you would rather not see',
    brings: 'edges are soft and imagination is louder than logic',
    yours: 'imagination',
    weight: 0.85,
  },
  pluto: {
    name: 'Pluto',
    symbol: '♇',
    domain: 'what changes whether you agree to it or not',
    brings: 'whatever is actually going on is closer to the surface',
    yours: 'capacity to change',
    weight: 0.95,
  },
  node: {
    name: 'North Node',
    symbol: '☊',
    domain: 'the direction that is unfamiliar and correct',
    brings: 'the unfamiliar option is the one worth looking at',
    yours: 'direction of travel',
    weight: 0.6,
  },
}

/** The four points a chart has that are not bodies. */
export type Point = Body | 'ascendant' | 'midheaven'

export const POINT_LABEL: Record<string, string> = {
  ascendant: 'Ascendant',
  midheaven: 'Midheaven',
}

export function pointName(point: Point): string {
  if (point === 'ascendant' || point === 'midheaven') return POINT_LABEL[point]
  return BODY_PROFILES[point].name
}

export function pointSymbol(point: Point): string {
  if (point === 'ascendant') return 'AC'
  if (point === 'midheaven') return 'MC'
  return BODY_PROFILES[point].symbol
}

/* ── Aspects ─────────────────────────────────────────────────── */

export type AspectId =
  | 'conjunction'
  | 'sextile'
  | 'square'
  | 'trine'
  | 'opposition'
  | 'quincunx'

export interface AspectKind {
  id: AspectId
  name: string
  symbol: string
  angle: number
  /** How far from exact it may be and still count. */
  orb: number
  /** Easy, demanding, or neither. Drives the tone of the sentence. */
  temper: 'flowing' | 'charged' | 'neutral'
  /** Completes "… your Moon": the verb phrase of the contact. */
  verb: string
  /** One clause about what this kind of contact feels like. */
  texture: string
  /** Weight in the ranking. Squares and oppositions are felt; sextiles less so. */
  weight: number
}

export const ASPECTS: AspectKind[] = [
  {
    id: 'conjunction',
    name: 'conjunction',
    symbol: '☌',
    angle: 0,
    orb: 8,
    temper: 'neutral',
    verb: 'sits right on top of',
    texture: 'the two are the same thing today; whatever it is, it is loud',
    weight: 1,
  },
  {
    id: 'opposition',
    name: 'opposition',
    symbol: '☍',
    angle: 180,
    orb: 7,
    temper: 'charged',
    verb: 'faces',
    texture: 'two true things are pulling opposite ways and both get a say',
    weight: 0.95,
  },
  {
    id: 'trine',
    name: 'trine',
    symbol: '△',
    angle: 120,
    orb: 6,
    temper: 'flowing',
    verb: 'flows into',
    texture: 'this one is easy — easy enough to waste if you do not use it',
    weight: 0.8,
  },
  {
    id: 'square',
    name: 'square',
    symbol: '□',
    angle: 90,
    orb: 6,
    temper: 'charged',
    verb: 'leans on',
    texture: 'friction, of the useful kind: something has to actually move',
    weight: 0.9,
  },
  {
    id: 'sextile',
    name: 'sextile',
    symbol: '⚹',
    angle: 60,
    orb: 4,
    temper: 'flowing',
    verb: 'opens a door for',
    texture: 'an opportunity that will not insist — you have to take it up',
    weight: 0.6,
  },
  {
    id: 'quincunx',
    name: 'quincunx',
    symbol: '⚻',
    angle: 150,
    orb: 3,
    temper: 'neutral',
    verb: 'sits awkwardly beside',
    texture: 'two things that do not quite fit, and adjusting beats forcing',
    weight: 0.45,
  },
]

/** The aspect between two longitudes, if there is one inside orb. */
export function aspectBetween(
  a: number,
  b: number,
): { kind: AspectKind; orb: number; exactness: number } | null {
  const around = (((b - a) % 360) + 360) % 360
  const gap = around > 180 ? 360 - around : around

  for (const kind of ASPECTS) {
    const orb = Math.abs(gap - kind.angle)
    if (orb <= kind.orb) {
      return { kind, orb, exactness: 1 - orb / kind.orb }
    }
  }
  return null
}
