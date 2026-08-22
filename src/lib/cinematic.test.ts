import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_WORD,
  cinematicGlyphs,
  cinematicWhisper,
  glyphCount,
  isMovingPhase,
} from './cinematic'
import { PHASE_LABEL, type BreathPhase } from './breathing'

const PHASES: BreathPhase[] = ['inhale', 'holdIn', 'exhale', 'holdOut']

/**
 * What is worth asserting here is not the copy — that is a judgement, and a
 * test that pins it just makes rewording it a chore. It is the two properties
 * the layer on screen actually depends on: that the line under the word is a
 * pure function of the breath number and never repeats twice running, and that
 * splitting a phrase into words and letters neither loses a character nor
 * hands two of them the same animation delay.
 */

describe('cinematicWhisper', () => {
  it('is pure — the same breath always gets the same line', () => {
    for (const phase of PHASES) {
      expect(cinematicWhisper(phase, 7)).toBe(cinematicWhisper(phase, 7))
    }
  })

  it('never shows the same line on two breaths running', () => {
    for (const phase of PHASES) {
      for (let breath = 0; breath < 40; breath += 1) {
        expect(cinematicWhisper(phase, breath)).not.toBe(
          cinematicWhisper(phase, breath + 1),
        )
      }
    }
  })

  it('walks the whole list rather than favouring the front of it', () => {
    const seen = new Set<string>()
    for (let breath = 0; breath < 40; breath += 1) {
      seen.add(cinematicWhisper('exhale', breath))
    }
    expect(seen.size).toBe(5)
  })

  it('survives a breath count that is negative or fractional', () => {
    // `completedBreaths` floors, so it can be negative a hair before the first
    // breath begins — a modulo that returned NaN there would blank the line.
    for (const breaths of [-1, -13, 0.5, -0.5]) {
      expect(cinematicWhisper('inhale', breaths)).toBeTruthy()
    }
  })
})

describe('CINEMATIC_WORD', () => {
  it('emphasises the two phases that are a movement', () => {
    expect(isMovingPhase('inhale')).toBe(true)
    expect(isMovingPhase('exhale')).toBe(true)
    expect(isMovingPhase('holdIn')).toBe(false)
    expect(isMovingPhase('holdOut')).toBe(false)
  })

  it('says the same thing as the small caption does', () => {
    // The two are set at wildly different sizes, but a screen that said
    // "Breathe out" in one place and "Exhale" in the other would be two guides.
    for (const phase of PHASES) {
      expect(CINEMATIC_WORD[phase]).toBe(PHASE_LABEL[phase])
    }
  })
})

describe('cinematicGlyphs', () => {
  it('keeps every letter, grouped by word', () => {
    const words = cinematicGlyphs('Breathe out')
    expect(words).toHaveLength(2)
    expect(words[0].glyphs.map((g) => g.char).join('')).toBe('Breathe')
    expect(words[1].glyphs.map((g) => g.char).join('')).toBe('out')
    expect(glyphCount(words)).toBe(10)
  })

  it('sweeps one index across the phrase, not per word', () => {
    const words = cinematicGlyphs('Breathe out')
    const indices = words.flatMap((word) => word.glyphs.map((g) => g.index))
    expect(new Set(indices).size).toBe(indices.length)
    expect(indices[0]).toBe(0)
    // 'Breathe' is seven letters and the space costs a step, so 'out' starts
    // at eight rather than at seven — the gap is part of the sweep.
    expect(words[1].glyphs[0].index).toBe(8)
  })

  it('handles a single word and stray spacing without empty boxes', () => {
    expect(cinematicGlyphs('Hold')).toHaveLength(1)
    expect(cinematicGlyphs('  Rest  ')).toHaveLength(1)
    expect(cinematicGlyphs('')).toHaveLength(0)
  })
})
