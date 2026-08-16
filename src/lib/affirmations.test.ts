import { describe, expect, it } from 'vitest'
import {
  FEATURED_FOCUSES,
  FOCUS_AREAS,
  MORE_FOCUSES,
  STUDIO_PREVIEWS,
  allAffirmations,
  findFocus,
  type FocusId,
} from './affirmations'
import { countWords } from './format'

/*
 * The content is a feature, not a fixture. These are the rules that make an
 * affirmation survive being said forty times in a row, and they are the ones a
 * later edit is most likely to break by accident — a line that reads beautifully
 * on the page and is unbearable on the tenth repetition.
 */

/** Every theme the product promises, so a deletion is a failing test. */
const REQUIRED: FocusId[] = [
  'confidence',
  'self-worth',
  'motivation',
  'discipline',
  'calm',
  'sleep',
  'health',
  'school',
  'career',
  'relationships',
  'gratitude',
  'fitness',
  'growth',
  'morning',
  'night',
]

describe('the affirmation library', () => {
  it('covers every theme the app offers', () => {
    for (const id of REQUIRED) {
      expect(findFocus(id), `missing focus: ${id}`).not.toBeNull()
    }
    expect(FOCUS_AREAS).toHaveLength(REQUIRED.length)
  })

  it('offers enough of each to choose from without scrolling for ever', () => {
    for (const focus of FOCUS_AREAS) {
      expect(focus.lines.length, focus.id).toBeGreaterThanOrEqual(5)
      expect(focus.lines.length, focus.id).toBeLessThanOrEqual(8)
    }
  })

  it('keeps every line short enough to repeat', () => {
    for (const focus of FOCUS_AREAS) {
      for (const line of focus.lines) {
        const words = countWords(line)
        // Below four words there is nothing to hold on to; above fourteen the
        // shape of the sentence is gone by the time the loop comes round.
        expect(words, `${focus.id}: ${line}`).toBeGreaterThanOrEqual(4)
        expect(words, `${focus.id}: ${line}`).toBeLessThanOrEqual(14)
      }
    }
  })

  it('writes them as sentences, because they are read aloud', () => {
    for (const line of allAffirmations()) {
      expect(line[0], line).toBe(line[0].toUpperCase())
      // Kokoro reads punctuation as timing. A line with no full stop is a line
      // with no ending, and it runs straight into the next repetition.
      expect(line.at(-1), line).toMatch(/[.!?]/)
      expect(line, `${line} — leading or trailing space`).toBe(line.trim())
    }
  })

  it('never says the same thing twice', () => {
    const lines = allAffirmations()
    expect(new Set(lines).size).toBe(lines.length)

    for (const focus of FOCUS_AREAS) {
      expect(new Set(focus.lines).size, focus.id).toBe(focus.lines.length)
    }
  })

  it('shows eight tiles first and keeps the rest one tap away', () => {
    // Seven themes plus the "Something else" tile the chooser adds itself.
    // Eight is the number the grid was designed around: two rows of four on a
    // tablet, four rows of two on a phone, and no scrolling to make a first
    // decision.
    expect(FEATURED_FOCUSES).toHaveLength(7)
    expect(FEATURED_FOCUSES.length + MORE_FOCUSES.length).toBe(FOCUS_AREAS.length)
    // Nothing may be in both lists, or the chooser shows it twice.
    const featured = new Set(FEATURED_FOCUSES.map((focus) => focus.id))
    expect(MORE_FOCUSES.some((focus) => featured.has(focus.id))).toBe(false)
  })

  it('gives every focus a title a saved loop can wear', () => {
    for (const focus of FOCUS_AREAS) {
      expect(focus.loopTitle.trim().length, focus.id).toBeGreaterThan(0)
      expect(focus.blurb.trim().length, focus.id).toBeGreaterThan(0)
    }
  })
})

describe('the studio voice previews', () => {
  it('all carry a pause, which is the thing being demonstrated', () => {
    expect(STUDIO_PREVIEWS.length).toBeGreaterThanOrEqual(3)
    for (const { text } of STUDIO_PREVIEWS) {
      // A comma or a mid-sentence stop. Kokoro breathes at these, and a
      // preview phrase without one throws away the whole comparison.
      expect(text.slice(0, -1), text).toMatch(/[,.:;—]/)
      expect(countWords(text), text).toBeLessThanOrEqual(14)
    }
  })

  it('has stable ids, because they are cache keys in everything but name', () => {
    const ids = STUDIO_PREVIEWS.map((preview) => preview.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
