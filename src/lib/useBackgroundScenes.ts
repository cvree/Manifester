/**
 * Which room is on screen, and what happens when it changes.
 *
 * The setting can name a room, or it can say `random` — drift between all of
 * them. Drifting is the only reason this hook exists, and the whole of it is:
 * two rooms are mounted at once for a few seconds, the arriving one fades up
 * and the leaving one fades down.
 *
 * That is safe to do only because a mode is not an animation. Every room is
 * drawn from the same `--e`, `--e-mid` and `--e-far` the orb is using, written
 * by `useBreathing` onto the field they both live in — so during a crossfade
 * the two rooms are at the same moment of the same breath, and what you see is
 * one breath drawn two ways at once rather than two effects colliding.
 *
 * Reduced motion picks a room and keeps it. A crossfade is only a fade, but a
 * room *changing* is a change of scene, and asking for less motion is a
 * reasonable way of asking not to be surprised.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SCENE_FADE_MS,
  SCENE_HOLD_MS,
  nextScene,
  sceneAt,
  type BackgroundChoice,
  type BackgroundModeId,
} from './environment'

export interface ActiveScene {
  id: BackgroundModeId
  /** Distinct per arrival, so React keeps a leaving room mounted while it goes. */
  key: number
  /** True for a room that is fading up. False for the one that was already here. */
  entering: boolean
  /** True for a room on its way out. Removed once its fade is over. */
  leaving: boolean
}

interface Options {
  choice: BackgroundChoice
  reducedMotion: boolean
  /** The one place randomness enters, and the seam the tests use. */
  roll?: () => number
}

/**
 * Every room that should be rendered right now: one, or two mid-drift. Newest
 * last, so a leaving room paints beneath the one arriving.
 */
export function useBackgroundScenes({
  choice,
  reducedMotion,
  roll = Math.random,
}: Options): ActiveScene[] {
  const rollRef = useRef(roll)
  rollRef.current = roll

  const [scenes, setScenes] = useState<ActiveScene[]>(() => [
    {
      id: choice === 'random' ? sceneAt(roll()) : choice,
      key: 0,
      // The first room was simply already here. Its arrival is the mix's
      // business (`useBackgroundMix`), and two reveals would fight.
      entering: false,
      leaving: false,
    },
  ])

  /** The room the next drift should move away from. */
  const here = useRef<BackgroundModeId>(scenes[0].id)
  const keyRef = useRef(0)

  /** Bring a room in, and send whatever is here on its way. */
  const arrive = useCallback((id: BackgroundModeId): number => {
    if (here.current === id) return 0
    here.current = id
    keyRef.current += 1
    const key = keyRef.current

    setScenes((current) => [
      ...current.filter((scene) => !scene.leaving).map((scene) => ({
        ...scene,
        leaving: true,
      })),
      { id, key, entering: true, leaving: false },
    ])

    /*
     * One timer per arrival, and it only ever drops rooms older than the one
     * it belongs to — so a setting changed twice inside a single fade cannot
     * strand a layer at half opacity or remove the room that just arrived.
     */
    return window.setTimeout(() => {
      setScenes((current) =>
        current
          .filter((scene) => scene.key >= key)
          .map((scene) => (scene.entering ? { ...scene, entering: false } : scene)),
      )
    }, SCENE_FADE_MS)
  }, [])

  // A named mode: go there, and stay there.
  useEffect(() => {
    if (choice === 'random') return
    const timer = arrive(choice)
    return () => window.clearTimeout(timer)
  }, [choice, arrive])

  // Drifting: hold a room, then move to one that is not this one.
  useEffect(() => {
    if (choice !== 'random' || reducedMotion) return

    let fade = 0
    const hold = window.setInterval(() => {
      window.clearTimeout(fade)
      fade = arrive(nextScene(here.current, rollRef.current()))
    }, SCENE_HOLD_MS)

    return () => {
      window.clearInterval(hold)
      window.clearTimeout(fade)
    }
  }, [choice, reducedMotion, arrive])

  return scenes
}
