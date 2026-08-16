/**
 * Whether somebody has been here before.
 *
 * One flag, in localStorage, and it is written the moment the first session
 * starts rather than when the last step is reached — so somebody who taps Skip
 * on step two is a returning visitor next time, exactly like somebody who went
 * all the way through. Nothing about the first minute should be repeatable by
 * accident.
 *
 * A person who clears their storage gets it again, which is correct: as far as
 * this device is concerned they are new.
 */

import { readLocal, removeLocal, writeLocal } from './storage'
import type { SavedLoop } from './types'

const KEY = 'onboarded'

export function hasOnboarded(): boolean {
  return readLocal(KEY) === 'yes'
}

export function markOnboarded(): void {
  writeLocal(KEY, 'yes')
}

/** For the "show me the introduction again" control in About. */
export function forgetOnboarding(): void {
  removeLocal(KEY)
}

/**
 * Where somebody landing on the app should actually go.
 *
 * A library with anything in it outranks the flag. Storage can be cleared
 * independently of IndexedDB, and walking a person with forty saved loops
 * through "what do you want to strengthen?" would be the app forgetting them
 * in the most conspicuous way available to it.
 */
export function shouldOnboard(loops: SavedLoop[]): boolean {
  if (loops.length > 0) return false
  return !hasOnboarded()
}
