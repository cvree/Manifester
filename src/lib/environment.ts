/**
 * The player's environment: what the room is made of, and where its points of
 * light stand.
 *
 * Nothing here animates anything. It is the *place* — a description that has to
 * be identical every time the player opens, so that the room reads as somewhere
 * you have returned to rather than as decoration that was regenerated while you
 * were not looking. The movement all comes from one clock elsewhere
 * (`useBreathing`), and the strength it is applied at comes from one mix
 * elsewhere again (`useBackgroundMix`).
 */

/* ── Modes ──────────────────────────────────────────────────── */

/**
 * The kinds of room the background visualiser can be.
 *
 * Named so that none of them shares a name with a *breathing form* (`Bloom`,
 * `Ripple`, `Aurora`, `Tide` and the rest, in `breathing.ts`). The two settings
 * sit in the same sheet, and two lists with four names in common is a sheet
 * where nobody can tell which "Tide" they just chose.
 *
 * A mode is an id in this list, an entry in `BACKGROUND_MODES`, a set of layers
 * in `BackgroundScene` and a `.player-scene--<id>` block in `theme.css`. It is
 * never a second clock: every one of them is drawn from the same `--e`, `--e-mid`
 * and `--e-far` the orb is using, on the same frame, so no mode can disagree
 * with the breath and no two modes can disagree with each other. That is also
 * what makes a crossfade between two of them safe — see `useBackgroundScenes`.
 *
 * The room around them does not change: the warm ground wash, the horizon, the
 * vignette and the light behind a spoken line are the same in every mode. What
 * changes is what the breath is *made visible as*.
 */
export type BackgroundModeId =
  | 'atmosphere'
  | 'rings'
  | 'waterline'
  | 'curtains'
  | 'starfield'
  | 'stillness'

/** What the setting can hold: a mode, or the instruction to drift between them. */
export type BackgroundChoice = BackgroundModeId | 'random'

export interface BackgroundMode {
  id: BackgroundModeId
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
    description: 'The room fills like water as you breathe in, and draws back.',
  },
  {
    id: 'curtains',
    name: 'Curtains',
    description: 'Light reaching down the screen, and lifting again.',
  },
  {
    id: 'starfield',
    name: 'Starfield',
    description: 'A field of stars opening outward around you.',
  },
  {
    id: 'stillness',
    name: 'Stillness',
    description: 'Almost nothing. One deep field, and the dark breathing in it.',
  },
]

export const DEFAULT_BACKGROUND_MODE: BackgroundModeId = 'atmosphere'
export const DEFAULT_BACKGROUND_CHOICE: BackgroundChoice = DEFAULT_BACKGROUND_MODE

export function findBackgroundMode(id: string): BackgroundMode {
  return (
    BACKGROUND_MODES.find((mode) => mode.id === id) ?? BACKGROUND_MODES[0]
  )
}

export function isBackgroundChoice(value: unknown): value is BackgroundChoice {
  if (value === 'random') return true
  return BACKGROUND_MODES.some((mode) => mode.id === value)
}

/** What the setting is called where there is only room for its name. */
export function backgroundChoiceName(choice: BackgroundChoice): string {
  return choice === 'random' ? 'Drifting' : findBackgroundMode(choice).name
}

/* ── Drifting between rooms ─────────────────────────────────── */

/**
 * How long a room is held before the next one begins to arrive.
 *
 * Long enough that the change is something you notice having happened rather
 * than something you watch happen: about eighteen breaths at a four-second
 * pattern. A visualiser that reinvents itself every thirty seconds is a
 * screensaver, and this is meant to be a room.
 */
export const SCENE_HOLD_MS = 96_000

/**
 * And how long the two rooms overlap. Deliberately most of a whole breath, so
 * the arriving room is already breathing in step by the time it is visible —
 * there is no frame at which one is doing something the other is not.
 */
export const SCENE_FADE_MS = 4200

/**
 * The next room to drift into, given the one on screen.
 *
 * Never the same one twice — a "random" that repeats itself reads as the
 * feature having stalled — and pure, so the sequencing is testable without
 * waiting a minute and a half for it.
 *
 * `roll` is a number in [0, 1): `Math.random()` at the call site, a fixture in
 * the tests.
 */
export function nextScene(
  current: BackgroundModeId,
  roll: number,
): BackgroundModeId {
  const others = BACKGROUND_MODES.filter((mode) => mode.id !== current)
  if (others.length === 0) return current
  return others[pick(others.length, roll)].id
}

/** Any room at all — the one the first drift of a session opens in. */
export function sceneAt(roll: number): BackgroundModeId {
  return BACKGROUND_MODES[pick(BACKGROUND_MODES.length, roll)].id
}

/** `Math.floor`, with the `roll === 1` case that would land past the end. */
function pick(count: number, roll: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(roll * count)))
}

/* ── How the breath travels ─────────────────────────────────── */

/**
 * How far behind the orb the rest of the room is, in seconds.
 *
 * The breath does not arrive everywhere at once. The orb is at `now`, the light
 * around it a quarter of a second behind, the far field two thirds of a second
 * behind that — small enough that nobody counts it, large enough that an
 * in-breath is felt as something moving *through* the room rather than as the
 * whole screen changing on one frame.
 *
 * These are sampled from the same curve rather than delayed from the same
 * value (see `expansionAt`), so no amount of lag can put the room out of step:
 * there is nothing here to drift.
 */
export const BREATH_LAG_SECONDS = {
  /** The light immediately around the orb. */
  mid: 0.26,
  /** The far field, the horizon and the echo that trails a full inhale. */
  far: 0.62,
} as const

/* ── The points of light ────────────────────────────────────── */

export interface Mote {
  /** Degrees around the orb. */
  angle: number
  /** 0 → 1 of however far the field reaches at this viewport size. */
  distance: number
  /**
   * 0 is distant — tiny, dim, and barely moved by the breath. 1 is near —
   * larger, softer, and drawn further out on an in-breath. Breath controls the
   * gravity, depth decides how much of it each point feels.
   */
  depth: number
  /** Diameter in pixels. */
  size: number
  /** Seconds of negative delay on its own twinkle, so none are in step. */
  delay: number
  /** Seconds one twinkle takes. Varied so they never resolve into a pulse. */
  period: number
}

/** Enough to read as a scattering; few enough to never read as a particle system. */
const MOTE_COUNT = 18

/**
 * A small deterministic generator.
 *
 * `Math.random()` would place these differently on every mount, which means a
 * point of light could jump across the screen because an unrelated piece of UI
 * state changed. The room has to be the same room.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The field, built once at module load and never again.
 *
 * Angles are stratified — one point per equal sector, jittered inside it —
 * rather than drawn freely. Free placement clumps, and a clump of three lights
 * touching reads as a mistake rather than as a scattering; stratifying gives
 * the irregularity without the accidents.
 *
 * Depth is drawn with a bias toward the distance, so most of the field sits
 * far back and only a few points are near enough to have real presence. A
 * screen where every point is a foreground point has no depth at all.
 */
function buildField(count: number): Mote[] {
  const random = mulberry32(0x9e37)
  const sector = 360 / count

  return Array.from({ length: count }, (_, index) => {
    // Cubed, so the median point is well back and the near ones are rare.
    const depth = random() ** 3

    return {
      angle: index * sector + random() * sector * 0.82,
      // Near points are held a little closer in, which is what makes the
      // scattering read as a volume rather than as a ring.
      distance: 0.5 + random() * 0.5 - depth * 0.12,
      depth,
      size: 1.1 + depth * 2.1,
      delay: -random() * 24,
      period: 13 + random() * 12,
    }
  })
}

export const MOTE_FIELD: readonly Mote[] = buildField(MOTE_COUNT)
