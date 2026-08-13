/**
 * Which standard ambient room is on screen, and what happens when it changes.
 *
 * Canvas worlds are valid background choices too, but PlayerAtmosphere renders
 * those directly. This hook only sequences the six CSS rooms and therefore
 * normalizes a canvas-world choice to the default CSS room when it is ever
 * handed one.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_BACKGROUND_MODE,
  SCENE_FADE_MS,
  SCENE_HOLD_MS,
  isLivingBackgroundChoice,
  nextScene,
  sceneAt,
  type BackgroundChoice,
  type BackgroundModeId,
} from './environment'

export interface ActiveScene {
  id: BackgroundModeId
  key: number
  entering: boolean
  leaving: boolean
}

interface Options {
  choice: BackgroundChoice
  reducedMotion: boolean
  roll?: () => number
}

function standardChoice(choice: BackgroundChoice): BackgroundModeId | 'random' {
  return isLivingBackgroundChoice(choice) ? DEFAULT_BACKGROUND_MODE : choice
}

export function useBackgroundScenes({
  choice,
  reducedMotion,
  roll = Math.random,
}: Options): ActiveScene[] {
  const rollRef = useRef(roll)
  rollRef.current = roll
  const normalized = standardChoice(choice)

  const [scenes, setScenes] = useState<ActiveScene[]>(() => [
    {
      id: normalized === 'random' ? sceneAt(roll()) : normalized,
      key: 0,
      entering: false,
      leaving: false,
    },
  ])

  const here = useRef<BackgroundModeId>(scenes[0].id)
  const keyRef = useRef(0)

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

    return window.setTimeout(() => {
      setScenes((current) =>
        current
          .filter((scene) => scene.key >= key)
          .map((scene) => (scene.entering ? { ...scene, entering: false } : scene)),
      )
    }, SCENE_FADE_MS)
  }, [])

  useEffect(() => {
    const next = standardChoice(choice)
    if (next === 'random') return
    const timer = arrive(next)
    return () => window.clearTimeout(timer)
  }, [choice, arrive])

  useEffect(() => {
    if (standardChoice(choice) !== 'random' || reducedMotion) return

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
