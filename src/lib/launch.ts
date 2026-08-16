import { shouldOnboard } from './onboarding'
import { pickLaunchLoop } from './loops'
import type { SavedLoop } from './types'

export type LaunchDestination = '/player' | '/create' | '/welcome'

/**
 * The first screen, decided in one place.
 *
 * Three answers, in order of how much this device already knows about the
 * person opening it:
 *
 *  - A loop worth resuming means the Player, which is where somebody who has
 *    used this before almost always wants to be.
 *  - Nothing saved and nothing seen means the introduction: an empty editor is
 *    the worst possible first impression of an app whose whole value is the
 *    words it already has.
 *  - Anything else — they have been introduced, they simply have no loops
 *    right now — is the editor, as it always was.
 */
export function launchDestination(loops: SavedLoop[]): LaunchDestination {
  if (pickLaunchLoop(loops)) return '/player'
  if (shouldOnboard(loops)) return '/welcome'
  return '/create'
}
