/**
 * The words this app already knows it might say.
 *
 * Manifester speaks whatever somebody writes, so most speech is unknowable
 * ahead of time — but not all of it, and the part that is knowable is the part
 * most people hear first: the starter lines under the editor, everything the
 * writing helper can offer, and the sample used to audition a voice.
 *
 * Those are pre-generated at build time by `scripts/generate-speech.mjs` and
 * shipped as ordinary static files, which is why a brand new device with a
 * cold cache and no backend at all still speaks in the studio voice the first
 * time somebody presses play.
 */

import { SUGGESTION_LINES } from '../wordcraft.ts'

/** The starting points offered under the editor on the Create screen. */
export const STARTER_LINES: string[] = [
  'I am allowed to move at my own pace.',
  'I meet today with a steady, open heart.',
  'I trust myself to handle what this day brings.',
  'I am becoming someone I am proud of.',
  'Rest is part of the work, not a break from it.',
]

/** What a voice says when somebody asks to hear it. */
export const VOICE_SAMPLE = 'This is how your words will sound.'

/**
 * The phrases worth generating, without duplicates.
 *
 * Order is stable so that a regeneration of an unchanged list produces an
 * unchanged manifest, which is what makes the whole thing diffable.
 */
export function knownPhrases(): string[] {
  const seen = new Set<string>()
  const phrases: string[] = []
  for (const phrase of [VOICE_SAMPLE, ...STARTER_LINES, ...SUGGESTION_LINES]) {
    const trimmed = phrase.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    phrases.push(trimmed)
  }
  return phrases
}
