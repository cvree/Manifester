/**
 * Whether somebody has been here before, and how far they got.
 *
 * Two separate facts, kept separately on purpose.
 *
 * **Completion** is a version number rather than a flag. A substantially
 * better introduction is a thing worth offering again — but only deliberately,
 * by raising `ONBOARDING_VERSION`, and only in a way that cannot corrupt what
 * an older build wrote. Anybody who finished version 1 is recorded as having
 * finished version 1 for ever; whether that counts is a question this file
 * answers, not a question stored on their device.
 *
 * **Progress** is the half-finished journey. Somebody who is two steps in and
 * reloads the page, or backgrounds the tab on a phone and comes back to a
 * discarded document, should not lose the intent they chose or the line they
 * were typing. It is written on every step and cleared the moment the first
 * loop starts. It expires, because coming back a week later to a half-answered
 * question about how you were feeling is worse than starting again.
 */

import { readLocal, removeLocal, writeLocal } from './storage'
import type { SavedLoop } from './types'

/**
 * The generation of the welcome experience.
 *
 * 1 — the first guided flow: welcome, focus, affirmation, voice.
 * 2 — the settling field: one atmospheric visual, the voice moment folded into
 *     the affirmation itself, an inline personalise step, and a ritual preview
 *     that transitions into the player rather than navigating to it.
 *
 * Raising this offers the new introduction to people who saw the old one. It
 * is a product decision each time and never an automatic consequence of
 * editing this directory, which is why the constant is here rather than
 * derived from anything.
 */
export const ONBOARDING_VERSION = 2

/**
 * Which versions still count as "has seen the introduction".
 *
 * Version 2 rearranged the same five minutes of value; it did not add anything
 * somebody who completed version 1 is missing. So they are left alone, and can
 * choose to watch it again from About. A future version that genuinely teaches
 * something new drops the old number from this list instead.
 */
const ACCEPTED_VERSIONS = new Set([1, 2])

const DONE_KEY = 'onboarded'
const PROGRESS_KEY = 'onboarding.progress'

/**
 * How long a half-finished introduction is worth keeping.
 *
 * Long enough to survive a phone locking, a tab being discarded under memory
 * pressure, a train tunnel and lunch. Short enough that tomorrow is a fresh
 * start, because "what would you like to strengthen right now?" is a question
 * about right now.
 */
const PROGRESS_TTL_MS = 6 * 60 * 60 * 1000

export interface OnboardingProgress {
  /** Which step they were on. Free-form; the route owns the vocabulary. */
  step: string
  focusId: string | null
  /** Their words, including anything they had started typing. */
  text: string
  voiceStyle: 'feminine' | 'masculine'
  /** Written on every change, and used to expire the whole thing. */
  updatedAt: number
  version: number
}

/* ── Completion ──────────────────────────────────────────────── */

function completedVersion(): number {
  const raw = readLocal(DONE_KEY)
  if (!raw) return 0
  // `'yes'` is what version 1 wrote before this was a number. Reading it as 1
  // is the entire migration, and it costs nothing to keep for ever.
  if (raw === 'yes') return 1
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export function hasOnboarded(): boolean {
  return ACCEPTED_VERSIONS.has(completedVersion())
}

export function markOnboarded(): void {
  writeLocal(DONE_KEY, String(ONBOARDING_VERSION))
  clearProgress()
}

/**
 * Show me the introduction again.
 *
 * Deliberately does *not* touch anything else. Somebody replaying it from
 * About has forty saved loops and a library they care about; the only thing
 * being reset is whether the app thinks they have been introduced.
 */
export function forgetOnboarding(): void {
  removeLocal(DONE_KEY)
  clearProgress()
}

/* ── Progress ────────────────────────────────────────────────── */

export function readProgress(): OnboardingProgress | null {
  const raw = readLocal(PROGRESS_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>
    if (!parsed || typeof parsed !== 'object') return null
    // A journey saved by a different generation of this flow describes steps
    // that may no longer exist. Starting again is the only honest option.
    if (parsed.version !== ONBOARDING_VERSION) return null
    if (typeof parsed.step !== 'string') return null
    if (typeof parsed.updatedAt !== 'number') return null
    if (Date.now() - parsed.updatedAt > PROGRESS_TTL_MS) return null
    return {
      step: parsed.step,
      focusId: typeof parsed.focusId === 'string' ? parsed.focusId : null,
      text: typeof parsed.text === 'string' ? parsed.text : '',
      voiceStyle: parsed.voiceStyle === 'masculine' ? 'masculine' : 'feminine',
      updatedAt: parsed.updatedAt,
      version: ONBOARDING_VERSION,
    }
  } catch {
    return null
  }
}

export function writeProgress(
  progress: Omit<OnboardingProgress, 'updatedAt' | 'version'>,
): void {
  writeLocal(
    PROGRESS_KEY,
    JSON.stringify({
      ...progress,
      updatedAt: Date.now(),
      version: ONBOARDING_VERSION,
    }),
  )
}

export function clearProgress(): void {
  removeLocal(PROGRESS_KEY)
}

/* ── The one small thing to teach afterwards ─────────────────── */

const NUDGE_KEY = 'onboarding.nudged'

/** True once the single post-session suggestion has been seen or dismissed. */
export function hasSeenFirstLoopNudge(): boolean {
  return readLocal(NUDGE_KEY) === 'yes'
}

export function markFirstLoopNudgeSeen(): void {
  writeLocal(NUDGE_KEY, 'yes')
}

/* ── Where to land ───────────────────────────────────────────── */

/**
 * Where somebody landing on the app should actually go.
 *
 * A library with anything in it outranks everything else. Storage can be
 * cleared independently of IndexedDB, and walking a person with forty saved
 * loops through "what would you like to strengthen?" would be the app
 * forgetting them in the most conspicuous way available to it.
 */
export function shouldOnboard(loops: SavedLoop[]): boolean {
  if (loops.length > 0) return false
  return !hasOnboarded()
}
