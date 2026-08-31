/**
 * The paragraph the day hands over to the player.
 *
 * ── Why a paragraph and not a line ──────────────────────────────────────────
 *
 * Every other line the app offers is five to twelve words, and that rule is
 * right for the library: a loop somebody picks off a shelf has to survive
 * being said forty times by somebody who did not write it. Today's reading is
 * a different object. It is written once, for one person, for one day, and it
 * is thrown away at midnight — so the thing it can do that a library line
 * cannot is *hold a whole day's worth of context*. A single sentence pulled
 * out of a nine-paragraph reading throws away the reading.
 *
 * So this is a passage: six or seven sentences, forty to sixty seconds a pass,
 * built out of the same arithmetic the rest of the screen is built out of.
 * Long enough that the second pass lands differently from the first, which is
 * the whole reason people listen to guided anything; short enough that it is
 * still a loop rather than a meditation track.
 *
 * ── The three rules still hold ──────────────────────────────────────────────
 *
 * The same three that govern `affirmations.ts`, because they are about the
 * ear rather than the length. Every sentence below has to survive repetition,
 * has to be sayable out loud without embarrassment, and has to be true on a
 * bad day. That last one is why nothing here promises an outcome: the sky
 * does not know what is going to happen and neither does this file.
 *
 * ── Why the fragments are whole sentences ───────────────────────────────────
 *
 * `lore.ts` is written in clauses, to be pasted mid-sentence into the reading.
 * None of it can be reused here, because a clause written for "…in Taurus, it
 * slows down" becomes "I slows down" the moment it is spoken in the first
 * person — which is exactly the failure `prose.ts` exists to catch. So the
 * first-person voice gets its own tables, and every entry is a complete
 * sentence that can be joined to any other with a single space.
 */

import type { FocusId } from '../affirmations'
import type { Chart, Transit } from './chart'
import { placementOf } from './chart'
import type { DailyReading } from './reading'
import { BODY_PROFILES, pointName, type AspectId } from './signs'
import type { Body } from './ephemeris'

/* ── What today is asking, in the first person ───────────────── */

/**
 * The transiting Moon's sign: the mood of the day, met rather than described.
 *
 * The Moon changes sign every two and a half days, so this is the fragment
 * that makes Tuesday's passage audibly different from Thursday's.
 */
const MOON_TODAY: Record<string, string> = {
  Aries: 'Today wants a start more than a plan, so I would rather begin badly than not begin.',
  Taurus: 'Today moves at the speed of comfort, and I am allowed to take the time it asks for.',
  Gemini: 'Today has a lot of moving parts, and I do not have to hold all of them at once.',
  Cancer: 'Today sits closer to the surface than most days, and I can let it.',
  Leo: 'Today goes better warm than careful, so I take up my own share of the room.',
  Virgo: 'Today improves in small pieces, and one thing actually finished counts.',
  Libra: 'Today keeps asking what would be fair, and I put myself inside the answer.',
  Scorpio: 'Today goes deep quickly, and I can look straight at whatever it turns up.',
  Sagittarius: 'Today wants more air than usual, and I give myself somewhere to move.',
  Capricorn: 'Today answers to steadiness, and steady is something I know how to be.',
  Aquarius: 'Today makes more sense from a step back, so I take the wider view of it.',
  Pisces: 'Today is soft at the edges, and I let some of it stay unfinished.',
}

/**
 * The natal Moon's sign: what actually settles this particular person.
 *
 * The same day lands differently on two people, and this is the sentence that
 * carries the difference — it is about them rather than about today, and it
 * is the same every time, which is why it is the anchor rather than the news.
 */
const MOON_STEADY: Record<string, string> = {
  Aries: 'What settles me is having something to push against, and permission to say it plainly.',
  Taurus: 'What settles me is not being hurried, and something ordinary and good to come back to.',
  Gemini: 'What settles me is saying a thing out loud until it starts to make sense.',
  Cancer: 'What settles me is somewhere safe to put a feeling down.',
  Leo: 'What settles me is being properly seen by one person who means it.',
  Virgo: 'What settles me is one small thing put right with my own hands.',
  Libra: 'What settles me is company, and a room that is kind to be in.',
  Scorpio: 'What settles me is the truth of it, even when the truth is heavy.',
  Sagittarius: 'What settles me is knowing there is still somewhere left to go.',
  Capricorn: 'What settles me is knowing the ground under this is solid.',
  Aquarius: 'What settles me is room to think without being asked what I am thinking.',
  Pisces: 'What settles me is quiet, and nothing needing to be decided tonight.',
}

/**
 * The planet leading the day, said as something arriving rather than something
 * happening *to* somebody. Nothing here is a prediction; every one of them is
 * a description of an available mood.
 */
const BODY_MEETS: Record<Body, string> = {
  sun: 'Something today wants me at the middle of it, and I can stand there.',
  moon: 'My mood is loud today, and a mood is weather rather than evidence about my life.',
  mercury: 'Words arrive quickly today, and so do second thoughts, and I keep the useful ones.',
  venus: 'There is warmth available today, and I am allowed to take it.',
  mars: 'There is more push in me today than usual, and I would rather spend it than sit on it.',
  jupiter: 'There is more room in this than I have been using.',
  saturn: 'Something is asking me to be solid today, and solid gets built slowly.',
  uranus: 'Something today refuses the usual shape, and I can be interested rather than thrown.',
  neptune: 'The edges are soft today, and not everything needs deciding while they are.',
  pluto: 'Something in me is changing underneath all this, and it does not have to be finished today.',
  node: 'Today points somewhere unfamiliar, and unfamiliar is not the same as wrong.',
}

/**
 * How the contact feels, in three tempers.
 *
 * Two variants each, chosen by the day, because this is the sentence most
 * likely to repeat across a week — tempers change far more slowly than signs.
 */
const TEMPER_LINES: Record<Transit['kind']['temper'], string[]> = {
  flowing: [
    'What is open today is open, and I can use it without suspecting it.',
    'Some of today is genuinely easy, and easy is not the same as owed to somebody else.',
  ],
  charged: [
    'The friction in today is the part that moves something, and I do not have to be comfortable to be doing this right.',
    'Something is pushing back today, and I can meet it without pushing harder than it needs.',
  ],
  neutral: [
    'Today is mine to shape, and I take it in the order it comes.',
    'Nothing about today is fixed yet, and I get a say in what it turns into.',
  ],
}

/** When nothing in the sky is within reach of the chart at all. */
const UNCLAIMED = [
  'Nothing is asking anything of me today, and that is its own kind of permission.',
  'Today has no claim on it, so whatever I put in it is what it will be.',
]

/** The phase of the month, as a thing to do rather than a thing to know. */
const PHASE_SELF: Record<string, string> = {
  'New Moon':
    'The month is dark and new, so I start one small thing without needing anybody to see it.',
  'Waxing Crescent':
    'This is the fragile part of a new thing, and I keep going in the smallest way that still counts.',
  'First Quarter':
    'The first resistance is here, and resistance is the shape of the work rather than proof I was wrong.',
  'Waxing Gibbous':
    'It is nearly there, and I adjust rather than start it over.',
  'Full Moon':
    'Everything is lit at once, and I would rather see it clearly than pretend about it.',
  'Waning Gibbous':
    'The month is on its way down, and what I learned is worth saying out loud to somebody.',
  'Last Quarter':
    'This is the letting-go stretch of the month, and I put down what I am no longer using.',
  'Waning Crescent':
    'The month is nearly over, and resting is the work now.',
}

/**
 * The close, which returns to the intent the reading chose.
 *
 * Two apiece, and never the one the reading already opened with — the passage
 * begins on the library line for this intent, and finishing on the same
 * sentence would make a six-sentence paragraph sound like it ran out.
 */
const FOCUS_CLOSE: Record<FocusId, string[]> = {
  confidence: [
    'I trust myself to handle today as it actually arrives.',
    'I have handled harder days than this one with less than I have now.',
  ],
  calm: [
    'I am safe in this moment, and this moment is enough.',
    'My breath is slow, and the rest of me is following it.',
  ],
  motivation: [
    'I do the first small piece, and the first piece is the whole trick.',
    'Starting is allowed to be unimpressive.',
  ],
  discipline: [
    'I do the next small thing, and then the one after it.',
    'I keep the promise I made to myself, at the ordinary size I made it.',
  ],
  'self-worth': [
    'I am worth the same today as I am on my best day.',
    'I do not have to earn the right to take up room.',
  ],
  sleep: [
    'I am allowed to stop now, and the rest of it will keep until morning.',
    'Nothing left today needs me awake for it.',
  ],
  health: [
    'I look after this body the way I would look after somebody I love.',
    'I give my body what it is actually asking for today.',
  ],
  school: [
    'I learn things slowly, and slowly is how they stay learned.',
    'I understand more than I did last week, and that is the whole job.',
  ],
  career: [
    'I do good work, and I let it be seen.',
    'I am allowed to be proud of something I made.',
  ],
  relationships: [
    'I show up as myself, and that is enough to be met.',
    'I say the warm thing while there is still time to say it.',
  ],
  gratitude: [
    'There is something good in today, and I am going to notice it.',
    'I have more than I remember to count.',
  ],
  fitness: [
    'I move my body today, however small the moving is.',
    'I am building this one ordinary day at a time.',
  ],
  growth: [
    'I am allowed to be a beginner for as long as this takes.',
    'I am becoming somebody I would have liked to meet.',
  ],
  morning: [
    'I start this day gently, and gently still counts as starting.',
    'This day is new, and I get to decide how I walk into it.',
  ],
  night: [
    'The day is done, and I am allowed to set it down.',
    'I did what I could with today, and that is where it ends.',
  ],
  resilience: [
    'I have done hard things before, and I am still here.',
    'I bend today, and bending is not breaking.',
  ],
}

/* ── Assembly ────────────────────────────────────────────────── */

/** How an astrologer says an aspect out loud: "Mars square your Moon". */
const ASPECT_PREPOSITION: Record<AspectId, string> = {
  conjunction: 'on',
  opposition: 'opposite',
  trine: 'trine',
  square: 'square',
  sextile: 'sextile',
  quincunx: 'quincunx',
}

function hash(text: string): number {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return Math.abs(value)
}

/**
 * Roughly how long one pass takes to say out loud.
 *
 * The app speaks at rate 0.9 by default, which lands a little under two and a
 * half words a second across every voice it can use. The number is shown as an
 * "about", because it is one.
 */
export function sayingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(5, Math.round(words / 2.3))
}

export interface Passage {
  /** The whole paragraph, ready to be looped. */
  text: string
  /** The sentences it was built from, in the order they are said. */
  sentences: string[]
  /** About how long one pass takes, in seconds. */
  seconds: number
  /** What it was built out of, for the line under it. */
  why: string
}

/**
 * Today, written as something to say rather than something to read.
 *
 * Six or seven sentences, in this order and for this reason: the library line
 * first, because it is the one with a studio recording behind it and the one
 * somebody may already know; then the day, then the person, then what is
 * actually touching the chart, then the month; and last the intent again, so
 * the passage lands where it started and the loop closes on itself rather than
 * trailing off.
 */
export function passageOf(
  reading: DailyReading,
  sky: Chart,
  natal: Chart,
  leading: Transit | null,
): Passage {
  const seed = hash(`${reading.day}:${Math.round(placementOf(natal, 'sun').longitude)}`)

  const moonToday = placementOf(sky, 'moon').sign.name
  const moonNatal = placementOf(natal, 'moon').sign.name

  const temper = leading ? leading.kind.temper : null

  const closes = FOCUS_CLOSE[reading.focus.id]
  const first = closes[seed % closes.length]
  /* Never the sentence the passage already opened with. */
  const close = first === reading.affirmation ? closes[(seed + 1) % closes.length] : first

  const sentences = [
    reading.affirmation,
    MOON_TODAY[moonToday],
    leading ? BODY_MEETS[leading.from] : UNCLAIMED[seed % UNCLAIMED.length],
    temper ? TEMPER_LINES[temper][seed % TEMPER_LINES[temper].length] : null,
    MOON_STEADY[moonNatal],
    PHASE_SELF[sky.phase.name] ?? PHASE_SELF['New Moon'],
    close,
  ].filter((sentence): sentence is string => Boolean(sentence))

  const text = sentences.join(' ')

  /*
   * What it was built out of, named the way an astrologer would say it aloud.
   * The aspect words are used as prepositions — "Neptune opposite your
   * Ascendant" — because "Neptune opposition to your Ascendant" is how a
   * database talks. The intent is deliberately absent: the card above this
   * line already says which one the day chose, and repeating it two inches
   * lower is the reading agreeing with itself.
   */
  const parts = [
    `the Moon in ${moonToday}`,
    `your Moon in ${moonNatal}`,
    leading
      ? `${BODY_PROFILES[leading.from].name} ${ASPECT_PREPOSITION[leading.kind.id]} your ${pointName(leading.to)}`
      : 'a sky with no claim on your chart',
    `the ${sky.phase.name.toLowerCase()}`,
  ]

  return {
    text,
    sentences,
    seconds: sayingSeconds(text),
    why: `Built from ${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}.`,
  }
}
