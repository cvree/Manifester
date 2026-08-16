/**
 * The words Manifester brings to the table.
 *
 * Everything else in this app is a container for whatever somebody writes.
 * This file is the exception: it is the app's own opinion about what is worth
 * saying, organised by the thing a person actually came here for.
 *
 * Three rules held every line below to account, and they are worth stating
 * because breaking any of them makes a loop unlistenable rather than merely
 * unremarkable:
 *
 *  1. **It has to survive repetition.** A loop says the same sentence forty
 *     times. Anything clever is unbearable by the fourth pass, and anything
 *     long loses its shape by the tenth. Five to twelve words, one idea.
 *  2. **It has to be sayable out loud without embarrassment.** No cosmic
 *     claims, no manifesting-the-universe register, nothing somebody would be
 *     mortified to be overheard listening to.
 *  3. **It has to be true on a bad day.** "I am unstoppable" is a sentence
 *     that argues with the person hearing it. "I have done hard things
 *     before" is one they can agree with while still feeling terrible, which
 *     is the only kind that does any work.
 *
 * These are also the phrases `npm run speech` pre-generates, so a brand new
 * visitor with no model installed and no backend anywhere still hears them in
 * the studio voice. See `tts/knownPhrases.ts`.
 */

/** The sixteen things people come here for. */
export type FocusId =
  | 'confidence'
  | 'calm'
  | 'motivation'
  | 'discipline'
  | 'self-worth'
  | 'sleep'
  | 'health'
  | 'school'
  | 'career'
  | 'relationships'
  | 'gratitude'
  | 'fitness'
  | 'growth'
  | 'morning'
  | 'night'
  | 'resilience'

export interface Focus {
  id: FocusId
  /** What the tile says. One or two words. */
  label: string
  /** The line under it, in the chooser. Short enough to read at a glance. */
  blurb: string
  /** Which glyph the tile carries. See `components/Icons`. */
  glyph:
    | 'spark'
    | 'breath'
    | 'pulse'
    | 'mountain'
    | 'bloom'
    | 'moon'
    | 'leaf'
    | 'book'
    | 'compass'
    | 'heart'
    | 'seed'
    | 'flame'
    | 'growth'
    | 'sun'
    | 'star'
  /**
   * Which accent the welcome field takes while this intent is chosen.
   *
   * Four of them, all already in the palette, because the point is that the
   * room warms towards what somebody said they needed — not that every theme
   * gets a colour of its own. Sixteen hues would be a chart.
   */
  tone: 'rose' | 'sage' | 'gold' | 'twilight'
  /**
   * Shown on the opening chooser.
   *
   * The rest are one tap further in, behind "Something else". Sixteen tiles is
   * a form; the ten people actually arrive wanting is a decision, and the
   * difference decides whether somebody finishes the first minute.
   */
  featured?: boolean
  /** A default title for a loop started from this focus. */
  loopTitle: string
  lines: string[]
}

export const FOCUS_AREAS: Focus[] = [
  {
    id: 'confidence',
    label: 'Confidence',
    blurb: 'Walk in like you belong there',
    glyph: 'spark',
    tone: 'rose',
    featured: true,
    loopTitle: 'Steady confidence',
    lines: [
      'I trust myself to figure this out.',
      'I have done hard things before.',
      'I belong in the rooms I walk into.',
      'I speak clearly and kindly, and my voice carries.',
      'I am steady, even when the day around me is not.',
      'I do not need to be certain to begin.',
    ],
  },
  {
    id: 'calm',
    label: 'Calm',
    blurb: 'Let the noise settle',
    glyph: 'breath',
    tone: 'twilight',
    featured: true,
    loopTitle: 'Coming back to calm',
    lines: [
      'My breath is slow, and my body is following it.',
      'I am safe in this moment, and this moment is enough.',
      'I let my shoulders drop and my jaw soften.',
      'This feeling is loud, and it is not in charge.',
      'I return to my breath as many times as I need to.',
      'Nothing here needs solving in the next minute.',
    ],
  },
  {
    id: 'motivation',
    label: 'Motivation',
    blurb: 'Get the first step done',
    glyph: 'pulse',
    tone: 'gold',
    featured: true,
    loopTitle: 'Getting started',
    lines: [
      'I begin, and beginning is the hard part.',
      'Small steps still count as moving.',
      'I do not wait to feel ready.',
      'I do one thing today that I will be glad of tomorrow.',
      'Momentum starts with the next five minutes.',
      'I would rather start badly than not start.',
    ],
  },
  {
    id: 'discipline',
    label: 'Discipline',
    blurb: 'Keep going on the dull days',
    glyph: 'mountain',
    tone: 'sage',
    loopTitle: 'Keeping my word',
    lines: [
      'I keep the promises I make to myself.',
      'I do good work at a pace I can keep.',
      'I show up on the days I do not feel like it.',
      'My attention comes back to one thing at a time.',
      'I finish what I start, one session at a time.',
      'Consistency is something I build, not something I have.',
    ],
  },
  {
    id: 'self-worth',
    label: 'Self-worth',
    blurb: 'Nothing to prove today',
    glyph: 'bloom',
    tone: 'rose',
    featured: true,
    loopTitle: 'Enough as I am',
    lines: [
      'I am enough, exactly as I am today.',
      'My worth was never something I had to earn.',
      'I am allowed to take up space.',
      'I like the person I am becoming.',
      'I deserve the same kindness I give everyone else.',
      'I do not have to be impressive to be worth loving.',
    ],
  },
  {
    id: 'sleep',
    label: 'Sleep',
    blurb: 'Put the day down',
    glyph: 'moon',
    tone: 'twilight',
    featured: true,
    loopTitle: 'Letting the day go',
    lines: [
      'The day is finished, and I am allowed to put it down.',
      'My body knows how to sleep, and I let it.',
      'I release today, breath by breath.',
      'Everything left over will still be there tomorrow.',
      'I am warm, I am safe, and I am sinking into rest.',
      'I let my thoughts drift past without following them.',
    ],
  },
  {
    id: 'health',
    label: 'Health',
    blurb: 'Look after the body you have',
    glyph: 'leaf',
    tone: 'sage',
    featured: true,
    loopTitle: 'Taking care of myself',
    lines: [
      'I treat my body like someone I love.',
      'I give my body rest, water and kindness.',
      'I listen to what my body is telling me.',
      'I am at home in my body.',
      'I look after myself before I am running on empty.',
      'Taking care of myself is not something I put off.',
    ],
  },
  {
    id: 'school',
    label: 'School',
    blurb: 'Sit down and learn it',
    glyph: 'book',
    tone: 'gold',
    featured: true,
    loopTitle: 'Study steadiness',
    lines: [
      'I am allowed to be a beginner at this.',
      'I learn this one piece at a time.',
      'I can concentrate for the next twenty minutes.',
      'Understanding comes from practice, and I am practising.',
      'I am prepared, and I trust what I know.',
      'A hard subject is not a verdict on me.',
    ],
  },
  {
    id: 'career',
    label: 'Career',
    blurb: 'Do the work, take the credit',
    glyph: 'compass',
    tone: 'gold',
    featured: true,
    loopTitle: 'Work that holds',
    lines: [
      'I am building something steady, one ordinary day at a time.',
      'I finish what matters and let the rest go.',
      'My work is good enough to send.',
      'I say what I think in the room I am in.',
      'I am becoming the person this work needs me to be.',
      'I can ask for what my work is worth.',
    ],
  },
  {
    id: 'relationships',
    label: 'Relationships',
    blurb: 'Be seen as you are',
    glyph: 'heart',
    tone: 'rose',
    featured: true,
    loopTitle: 'Open and looked after',
    lines: [
      'I am easy to love, and I let myself be loved.',
      'I let people see the real version of me.',
      'I choose people who are gentle with me.',
      'I say what I need, clearly and without apology.',
      'I give the kind of love I would like to receive.',
      'I am surrounded by people who are glad I exist.',
    ],
  },
  {
    id: 'gratitude',
    label: 'Gratitude',
    blurb: 'Notice what is already good',
    glyph: 'seed',
    tone: 'gold',
    featured: true,
    loopTitle: 'What is already here',
    lines: [
      'I notice the ordinary things that are going right.',
      'Small good things count, and I let them count.',
      'I am thankful for the people who make my life softer.',
      'I have enough for today, and today is what I am living.',
      'There is something here worth being glad about.',
      'I thank the version of me who set this up.',
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness',
    blurb: 'Show up and move',
    glyph: 'flame',
    tone: 'gold',
    loopTitle: 'Strong and moving',
    lines: [
      'I move today in a way that feels good.',
      'My body carries me through every day, and I thank it.',
      'I am stronger than I was a month ago.',
      'I keep going for one more minute.',
      'Showing up is the whole workout.',
      'I train for how I want to feel, not how I want to look.',
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    blurb: 'Become who you are heading towards',
    glyph: 'growth',
    tone: 'sage',
    loopTitle: 'Becoming',
    lines: [
      'I am proud of how far I have already come.',
      'What I practise, I become.',
      'I am on my own timeline, and it is the right one.',
      'I choose how I speak to myself.',
      'I forgive myself for what I did not know then.',
      'I am allowed to change my mind about who I am.',
    ],
  },
  {
    id: 'morning',
    label: 'Morning',
    blurb: 'Set the tone before the day does',
    glyph: 'sun',
    tone: 'gold',
    loopTitle: 'How this day starts',
    lines: [
      'I meet today as it is, not as I feared it would be.',
      'Today has room in it for something good.',
      'I set the tone for this day, and I choose a kind one.',
      'I start where I am, with what I have.',
      'The first hour of today is mine.',
      'I am awake, and that is enough to begin with.',
    ],
  },
  {
    id: 'night',
    label: 'Night',
    blurb: 'Close the day kindly',
    glyph: 'star',
    tone: 'twilight',
    loopTitle: 'End of the day',
    lines: [
      'Whatever this day held, I am still here at the end of it.',
      'I did what I could with the day I had.',
      'I am allowed to leave today unfinished.',
      'Tomorrow gets a fresh version of me.',
      'I let the day go without going over it again.',
      'I am doing better than I give myself credit for.',
    ],
  },
  {
    id: 'resilience',
    label: 'Resilience',
    blurb: 'Get through the hard stretch',
    glyph: 'mountain',
    tone: 'twilight',
    loopTitle: 'Getting through',
    lines: [
      'I can handle what is in front of me.',
      'This is hard, and I am still here.',
      'I have got through every day so far.',
      'I do not have to feel fine to keep going.',
      'The hard part will not last as long as it feels.',
      'I am allowed to ask for help with this.',
    ],
  },
]

/** The ten tiles the opening chooser shows. */
export const FEATURED_FOCUSES: Focus[] = FOCUS_AREAS.filter(
  (focus) => focus.featured,
)

/** The rest, behind "Something else". */
export const MORE_FOCUSES: Focus[] = FOCUS_AREAS.filter((focus) => !focus.featured)

export function findFocus(id: string | null | undefined): Focus | null {
  if (!id) return null
  return FOCUS_AREAS.find((focus) => focus.id === id) ?? null
}

/**
 * How many starters the welcome flow puts on screen.
 *
 * Four, and the number is load-bearing. Three reads as a shortlist somebody
 * has to settle for; six is a menu, and a menu is a task. Four fits above the
 * fold on the smallest phone this app supports, which is the only place the
 * count actually gets decided.
 */
export const STARTER_COUNT = 4

/**
 * The lines a first-time visitor is offered, best first.
 *
 * The first one is *recommended* rather than merely first: it is the line
 * chosen to be the one most people would keep, it is drawn a step above the
 * others, and it is pre-selected so somebody can go straight on. Elevated,
 * never forced — every other line is one tap away and so is writing your own.
 */
export function startersFor(focus: Focus): string[] {
  return focus.lines.slice(0, STARTER_COUNT)
}

/** The one drawn a step above the rest. */
export function recommendedFor(focus: Focus): string {
  return focus.lines[0]
}

/* ── More than one thing at a time ───────────────────────────── */

/**
 * How many intents somebody may carry into their first loop.
 *
 * Three, and the number is a judgement rather than a limit imposed by the
 * layout. Nobody arrives needing one thing — "calm" and "sleep" are the same
 * evening, "confidence" and "career" are the same meeting — and forcing a
 * single choice made the opening question feel like it was testing them.
 *
 * It stops at three because the starters below are drawn from every intent
 * chosen, and a shortlist assembled from five themes stops being about any of
 * them. Three blends; four is a smoothie.
 */
export const MAX_FOCUSES = 3

/**
 * The shortlist for however many intents were chosen.
 *
 * Round-robin rather than concatenated, which is the whole trick: taking the
 * best line from each intent before the second-best from any of them means a
 * person who chose Sleep and Gratitude sees one of each immediately, rather
 * than four sleep lines with gratitude somewhere below the fold. The first
 * intent still leads, so `recommendedFor` continues to be the first thing on
 * screen and the pre-selected one.
 */
export function blendStarters(focuses: Focus[]): string[] {
  if (focuses.length === 0) return []
  if (focuses.length === 1) return startersFor(focuses[0])

  const lines: string[] = []
  const seen = new Set<string>()
  const depth = Math.max(...focuses.map((focus) => focus.lines.length))

  for (let rank = 0; rank < depth && lines.length < STARTER_COUNT; rank += 1) {
    for (const focus of focuses) {
      if (lines.length >= STARTER_COUNT) break
      const line = focus.lines[rank]
      if (!line || seen.has(line)) continue
      seen.add(line)
      lines.push(line)
    }
  }

  return lines
}

/**
 * What to call a loop built out of several intents.
 *
 * Their own words for what they came for, joined the way a person would say
 * them. A generated title like "Confidence + Calm + Career" reads like a
 * database row; "Confidence, calm and career" reads like something they said,
 * and they can rename it in one tap anyway.
 */
export function loopTitleFor(focuses: Focus[]): string {
  if (focuses.length === 0) return 'My first loop'
  if (focuses.length === 1) return focuses[0].loopTitle

  const labels = focuses.map((focus, index) =>
    index === 0 ? focus.label : focus.label.toLowerCase(),
  )
  const last = labels.pop()!
  return `${labels.join(', ')} and ${last}`
}

/**
 * Every curated line, deduplicated, in a stable order.
 *
 * Stability matters more than it looks: this list decides what gets
 * pre-generated, and a set that reordered itself between runs would rewrite
 * the manifest on every build for no change in the audio.
 */
export function allAffirmations(): string[] {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const focus of FOCUS_AREAS) {
    for (const line of focus.lines) {
      const trimmed = line.trim()
      if (!trimmed || seen.has(trimmed)) continue
      seen.add(trimmed)
      lines.push(trimmed)
    }
  }
  return lines
}

/**
 * What the studio voice says when somebody is deciding whether they like it.
 *
 * Chosen for the voice rather than for the words. Each one carries a comma or
 * a full stop in the middle, because the thing that separates Kokoro from a
 * device synthesiser is not the timbre — it is that it *breathes* at
 * punctuation, and a preview phrase with no pause in it throws away the whole
 * demonstration. They are short for the same reason a shop lets you try a
 * chord rather than a symphony.
 */
export interface PreviewPhrase {
  id: string
  text: string
}

export const STUDIO_PREVIEWS: PreviewPhrase[] = [
  { id: 'breath', text: 'Take a slow breath in, and let it go.' },
  {
    id: 'carrying',
    text: 'Whatever you are carrying, you can set it down for a while.',
  },
  { id: 'nothing', text: 'There is nothing to solve here, and nowhere else to be.' },
  { id: 'yours', text: 'These are your words. I am only holding them for you.' },
]
