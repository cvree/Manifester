/**
 * The words of the breath, written large.
 *
 * ── Why this is its own module ──
 *
 * `PHASE_LABEL` in `breathing.ts` is a caption: four words that sit inside the
 * orb at fourteen pixels and tell you which part of the breath you are in. It
 * is correct and it is small, and both of those are on purpose — it has to fit
 * in a circle beside a countdown.
 *
 * Cinematic typography is the opposite instrument. The type *is* the screen:
 * two words across the middle of it, resolving out of blur one letter at a
 * time, spreading as you fill and drawing back in as you empty. At that size
 * the words stop being a label and start being the guide, which means they
 * carry things a caption never had to — a line underneath in the voice a
 * person would actually use, and an emphasis that puts the two phases that
 * *move* above the two that hold still.
 *
 * None of that belongs in a `Record` beside the engine's timing constants, and
 * all of it is worth testing without a browser. Hence a module: the words, the
 * emphasis, and the one piece of arithmetic that decides which line you get.
 */

import type { BreathPhase } from './breathing'

/**
 * The phase, as a title card.
 *
 * Two words for the two moving phases and one for the two still ones, which is
 * not a style choice — "Breathe in" and "Breathe out" have to be told apart at
 * a glance from across a room, half-read, by someone whose eyes are closing.
 * The shared first word is what makes the second one the thing you actually
 * read, and a single word for the holds is what makes the holds feel like the
 * absence of that.
 */
export const CINEMATIC_WORD: Record<BreathPhase, string> = {
  inhale: 'Breathe in',
  holdIn: 'Hold',
  exhale: 'Breathe out',
  holdOut: 'Rest',
}

/**
 * The quieter line under the word.
 *
 * One short instruction, in the voice a person would use rather than the voice
 * an app would. They rotate by breath, so the same phrase is never on screen
 * twice running and a long session does not become four sentences repeating
 * until you stop reading them — which is exactly what happens to a fixed
 * subtitle, and the moment it happens the line has become furniture.
 *
 * They are deliberately not instructions you have to *follow*. By the time
 * somebody is watching this the breathing is already being led by the shape
 * and the sound; these are there to be half-read and agreed with.
 */
const WHISPERS: Record<BreathPhase, readonly string[]> = {
  inhale: [
    'let it fill you',
    'slowly, all the way down',
    'take up a little more room',
    'draw the light in',
    'let the chest open',
  ],
  holdIn: [
    'stay here',
    'nothing to do',
    'full, and still',
    'hold it lightly',
  ],
  exhale: [
    'let it go',
    'longer than you took it in',
    'soften as it leaves',
    'empty all the way out',
    'let the day out with it',
  ],
  holdOut: [
    'empty, and easy',
    'the pause is part of it',
    'wait for the next one',
    'nothing is missing here',
  ],
}

/**
 * Which line goes under the word on this breath.
 *
 * Indexed by the breath count rather than chosen at random, and the difference
 * matters more than it looks: random means the same phrase can land twice in a
 * row, which reads as the screen having glitched rather than as chance. A
 * walk through the list is also *pure* — the same breath always gets the same
 * line — so a re-render caused by anything else cannot swap the words out from
 * under someone mid-phase.
 */
export function cinematicWhisper(phase: BreathPhase, breaths: number): string {
  const lines = WHISPERS[phase]
  const index = Math.abs(Math.trunc(breaths)) % lines.length
  return lines[index]
}

/**
 * True for the two phases that are actually a movement.
 *
 * The whole brief for this layer was "emphasize breathe in, breathe out", and
 * this is where that emphasis is decided rather than in six scattered CSS
 * selectors. The holds are set smaller and dimmer — they are the rests in the
 * bar, and a rest typeset at the same weight as the note is a rest nobody
 * hears.
 */
export function isMovingPhase(phase: BreathPhase): boolean {
  return phase === 'inhale' || phase === 'exhale'
}

/** One glyph of the title card, with everything the stagger needs to place it. */
export interface Glyph {
  /** The character itself. A space is `' '` and is never animated. */
  char: string
  /** Position in the whole phrase — what the per-letter delay is derived from. */
  index: number
}

/** One word of the title card. Words are the wrapping unit; letters are not. */
export interface CinematicWord {
  glyphs: Glyph[]
  /** Position of the word in the phrase, for keying. */
  index: number
}

/**
 * Split a phrase into words, and words into letters.
 *
 * Two levels, because the two are answering different questions. Letters are
 * what the entrance staggers over — a title that resolves one letter at a time
 * is the entire effect, and it needs each glyph to be its own box with its own
 * delay. Words are what the line *wraps* on: at this type size "Breathe out"
 * does not fit across a phone, and a phrase that broke mid-word would be a
 * typographic error rather than a title card. So the letters are boxes inside
 * word boxes, and the word boxes are what may go to a second line.
 *
 * The running index is over the phrase rather than the word, so the stagger
 * sweeps left to right across both words instead of restarting at each one.
 */
export function cinematicGlyphs(phrase: string): CinematicWord[] {
  const words: CinematicWord[] = []
  let running = 0

  for (const [index, word] of phrase.split(' ').entries()) {
    if (word.length === 0) continue
    const glyphs = [...word].map((char) => ({ char, index: running++ }))
    // The space between words is a delay's worth of the sweep too, so the two
    // words read as one phrase being written rather than two arriving.
    running += 1
    words.push({ glyphs, index })
  }

  return words
}

/** How many glyphs the whole phrase came to — the sweep's length. */
export function glyphCount(words: CinematicWord[]): number {
  return words.reduce((total, word) => total + word.glyphs.length, 0)
}
