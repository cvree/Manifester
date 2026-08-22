/**
 * Which piece belongs to the moment somebody is in.
 *
 * Pure, and deliberately so: what the soundtrack does is a design decision
 * that ought to be readable in one screen and assertable in a test, not
 * something you reconstruct by reading five route components.
 *
 * ── The scenes ──
 *
 * A scene is a *feeling*, not a route. Several routes share one, and one route
 * can be two scenes depending on what the session is doing — which is the
 * point: the music follows the person, and the person is not a URL.
 *
 *   arrival     the threshold. Onboarding, and the player before it begins.
 *   shaping     writing and editing the words.
 *   listening   a session running, wherever they happen to be standing.
 *   completion  the loop has finished, or a piece of work has landed.
 *   reflection  the library, the archive, the reading — coming back.
 *   silent      somewhere music would be an intrusion.
 *
 * Silence for a live microphone is *not* here, and that is deliberate: it is a
 * fact about the hardware rather than about where somebody is standing, so it
 * lives beside page visibility in the manager. See `Soundtrack.setRecording`.
 *
 * ── The two rules that are not about routes ──
 *
 * **A running session outranks the route.** Somebody who walks from the player
 * to the library mid-session has not changed what they are doing; they have
 * gone to look something up while it plays. Swapping the music underneath them
 * would be the app noticing a navigation the person did not experience as one.
 *
 * ── And one that is about not deciding ──
 *
 * The launch route is a redirect that exists for as long as IndexedDB takes to
 * answer. Giving it a scene of its own would put a crossfade into every cold
 * start and every refresh, so it returns `null`: *hold whatever is playing*.
 * The same answer serves any route this file has not been told about, which is
 * the safe default for a layer nobody should notice.
 */

import type { SessionStatus } from '../types'
import type { SoundtrackTrackId } from './tracks'

export type SoundtrackScene =
  | 'arrival'
  | 'shaping'
  | 'listening'
  | 'completion'
  | 'reflection'
  | 'silent'

export interface SceneInput {
  /** `location.pathname`, as the hash router reports it. */
  path: string
  status: SessionStatus
}

/**
 * The scene for a moment, or `null` to hold whatever is already playing.
 */
export function sceneFor({ path, status }: SceneInput): SoundtrackScene | null {
  if (status === 'complete') return 'completion'
  if (status === 'playing' || status === 'paused') return 'listening'

  switch (normalisePath(path)) {
    case '/welcome':
      return 'arrival'
    case '/create':
      return 'shaping'
    /*
     * An idle player is the moment before, not the moment after: the words are
     * chosen, the room is ready, and the only thing left is to press play. It
     * shares the threshold with onboarding because it is the same threshold.
     */
    case '/player':
      return 'arrival'
    case '/library':
    case '/about':
    case '/share':
      return 'reflection'
    default:
      return null
  }
}

/** The scene's piece. `silent` is a scene with no piece, which is the point. */
export function trackForScene(scene: SoundtrackScene): SoundtrackTrackId | null {
  switch (scene) {
    case 'arrival':
      return 'twilight-sanctuary'
    case 'shaping':
      return 'the-velvet-hour'
    case 'listening':
      return 'between-two-breaths'
    case 'completion':
      return 'the-glass-room'
    case 'reflection':
      return 'after-the-sun-recedes'
    case 'silent':
      return null
  }
}

/**
 * The piece worth having ready next, so a scene change is a crossfade rather
 * than a wait for a download.
 *
 * One step ahead and no further. Fetching the whole set on arrival would be
 * eleven megabytes for an atmosphere, most of which the visit will never
 * reach; fetching nothing would put a gap where the crossfade should be. The
 * answer is the ordinary next move from where they are standing, which for
 * almost everybody is towards listening.
 */
export function likelyNextTrack(scene: SoundtrackScene): SoundtrackTrackId | null {
  switch (scene) {
    // From the threshold and from the editor, the next press is play.
    case 'arrival':
    case 'shaping':
      return 'between-two-breaths'
    // A session ends in completion.
    case 'listening':
      return 'the-glass-room'
    // And completion is one tap from the library.
    case 'completion':
      return 'after-the-sun-recedes'
    // Somebody browsing their loops is on their way to playing one; the piece
    // for that is already the answer above, so this is the other direction —
    // opening one to edit it.
    case 'reflection':
      return 'the-velvet-hour'
    case 'silent':
      return null
  }
}

/**
 * Trailing slashes and the query string are not part of the decision. The hash
 * router hands over a clean pathname today; this is what stops that being an
 * assumption.
 */
function normalisePath(path: string): string {
  const withoutQuery = path.split('?')[0].split('#')[0]
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1)
  }
  return withoutQuery || '/'
}
