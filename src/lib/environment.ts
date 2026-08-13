/**
 * The player's environment: what the room is made of, and where its points of
 * light stand.
 */

import { mulberry32 } from './random'

/* ── Modes ──────────────────────────────────────────────────── */

export type BackgroundModeId =
  | 'atmosphere'
  | 'rings'
  | 'waterline'
  | 'curtains'
  | 'starfield'
  | 'stillness'

/** Canvas-drawn worlds that can be chosen independently as full-screen rooms. */
export type LivingBackgroundId = 'cathedral' | 'moonpool'

/** What the setting can hold: a room, a living world, or drifting rooms. */
export type BackgroundChoice =
  | BackgroundModeId
  | LivingBackgroundId
  | 'random'

export interface BackgroundMode {
  id: BackgroundModeId
  name: string
  description: string
}

export interface LivingBackgroundMode {
  id: LivingBackgroundId
  name: string
  description: string
}

export const BACKGROUND_MODES: BackgroundMode[] = [
  {
    id: 'atmosphere',
    name: 'Atmosphere',
    description: 'Fog, light and a slow aurora. The room as it is.',
  },
  {
    id: 'rings',
    name: 'Rings',
    description: 'A ring of light leaving on every in-breath, travelling out.',
  },
  {
    id: 'waterline',
    name: 'Waterline',
    description:
      'An ocean filling as you breathe in and draining as you empty, with the light on the water beneath you.',
  },
  {
    id: 'curtains',
    name: 'Curtains',
    description:
      'The aurora: ribbons of green and rose reaching down the sky as you fill, and lifting as you empty.',
  },
  {
    id: 'starfield',
    name: 'Starfield',
    description:
      'A sky that opens wide as you breathe in, and gathers tight around you as you breathe out.',
  },
  {
    id: 'stillness',
    name: 'Stillness',
    description: 'Almost nothing. One deep field, and the dark breathing in it.',
  },
]

/**
 * The background halves of the two immersive worlds. These are deliberately
 * separate from breathing form selection: choosing one here changes only the
 * room, while choosing Cathedral or Moonpool under Form changes only the guide.
 */
export const LIVING_BACKGROUND_MODES: LivingBackgroundMode[] = [
  {
    id: 'cathedral',
    name: 'Ink Cathedral',
    description: 'Pearl-and-gold ink builds a luminous cathedral around you.',
  },
  {
    id: 'moonpool',
    name: 'Moonpool',
    description: 'A dark ocean opens above you onto moonlight and stars.',
  },
]

export const DEFAULT_BACKGROUND_MODE: BackgroundModeId = 'atmosphere'
export const DEFAULT_BACKGROUND_CHOICE: BackgroundChoice = DEFAULT_BACKGROUND_MODE

export function findBackgroundMode(id: string): BackgroundMode {
  return (
    BACKGROUND_MODES.find((mode) => mode.id === id) ?? BACKGROUND_MODES[0]
  )
}

export function isLivingBackgroundChoice(
  value: unknown,
): value is LivingBackgroundId {
  return value === 'cathedral' || value === 'moonpool'
}

export function isBackgroundChoice(value: unknown): value is BackgroundChoice {
  if (value === 'random' || isLivingBackgroundChoice(value)) return true
  return BACKGROUND_MODES.some((mode) => mode.id === value)
}

/** What the setting is called where there is only room for its name. */
export function backgroundChoiceName(choice: BackgroundChoice): string {
  if (choice === 'random') return 'Drifting'
  if (isLivingBackgroundChoice(choice)) {
    return (
      LIVING_BACKGROUND_MODES.find((mode) => mode.id === choice)?.name ??
      'Immersive room'
    )
  }
  return findBackgroundMode(choice).name
}

/* ── Drifting between standard rooms ───────────────────────── */

export const SCENE_HOLD_MS = 96_000
export const SCENE_FADE_MS = 4200

export function nextScene(
  current: BackgroundModeId,
  roll: number,
): BackgroundModeId {
  const others = BACKGROUND_MODES.filter((mode) => mode.id !== current)
  if (others.length === 0) return current
  return others[pick(others.length, roll)].id
}

export function sceneAt(roll: number): BackgroundModeId {
  return BACKGROUND_MODES[pick(BACKGROUND_MODES.length, roll)].id
}

function pick(count: number, roll: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(roll * count)))
}

/* ── How the breath travels ─────────────────────────────────── */

export const BREATH_LAG_SECONDS = {
  mid: 0.26,
  far: 0.62,
} as const

/* ── The points of light ────────────────────────────────────── */

export interface Mote {
  angle: number
  distance: number
  depth: number
  size: number
  delay: number
  period: number
}

const MOTE_COUNT = 18
const STAR_COUNT = 60

function buildField(count: number, seed = 0x9e37): Mote[] {
  const random = mulberry32(seed)
  const sector = 360 / count

  return Array.from({ length: count }, (_, index) => {
    const depth = random() ** 3

    return {
      angle: index * sector + random() * sector * 0.82,
      distance: 0.5 + random() * 0.5 - depth * 0.12,
      depth,
      size: 1.1 + depth * 2.1,
      delay: -random() * 24,
      period: 13 + random() * 12,
    }
  })
}

export const MOTE_FIELD: readonly Mote[] = buildField(MOTE_COUNT)

export const STAR_FIELD: readonly Mote[] = buildField(STAR_COUNT, 0x5f3a).map(
  (star, index) => ({
    ...star,
    distance: 0.22 + ((index % 6) / 6) * 0.5 + star.distance * 0.36,
  }),
)
