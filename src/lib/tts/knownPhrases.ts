/**
 * The words this app already knows it might say.
 *
 * Manifester speaks whatever somebody writes, so most speech is unknowable
 * ahead of time — but not all of it, and the part that is knowable is the part
 * most people hear first: the curated affirmation library, the Studio Voice
 * preview lines, the starter phrases under the editor, everything the writing
 * helper can offer, and the sample used to audition a voice.
 *
 * Those are pre-generated at build time by `scripts/generate-speech.mjs` and
 * shipped as ordinary static files, which is why a brand new device with a
 * cold cache, no backend and no model installed still speaks in the studio
 * voice the first time somebody presses play.
 *
 * The list is split into two tiers because they are worth different amounts of
 * disk. `INSTANT_PHRASES` are the ones somebody hears in their first minute,
 * and they are generated at both of the speeds anybody is likely to be on.
 * Everything else is generated at the app's default speed alone, and a person
 * who has moved the speed slider falls through to whatever engine they have —
 * which is the correct trade, because by then they are not a new visitor.
 */

import { STUDIO_PREVIEWS, allAffirmations } from '../affirmations.ts'
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

function dedupe(phrases: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const phrase of phrases) {
    const trimmed = phrase.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/**
 * Everything on the path from opening the app to hearing the first line.
 *
 * The voice sample, the four preview phrases the voice moment auditions, and
 * the starters. Small enough to be worth generating at more than one speed.
 */
export function instantPhrases(): string[] {
  return dedupe([
    VOICE_SAMPLE,
    ...STUDIO_PREVIEWS.map((preview) => preview.text),
    ...STARTER_LINES,
  ])
}

/**
 * The phrases worth generating, without duplicates.
 *
 * Order is stable so that a regeneration of an unchanged list produces an
 * unchanged manifest, which is what makes the whole thing diffable.
 */
export function knownPhrases(): string[] {
  return dedupe([...instantPhrases(), ...allAffirmations(), ...SUGGESTION_LINES])
}
