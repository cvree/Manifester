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
 * Only `atmosphere` is built. The union names the others because the shape of
 * the thing is the point: a mode is an id in this list, an entry in
 * `BACKGROUND_MODES`, and a `.player-field--<id>` block in `theme.css` that
 * re-tints or re-weights the layers already there. It is not a second
 * component, a second clock or a second set of geometry, and keeping it that
 * way is what makes "one day, an Aurora mode" a morning's work rather than a
 * rewrite.
 */
export type BackgroundModeId =
  | 'atmosphere'
  | 'aurora'
  | 'constellation'
  | 'tide'
  | 'void'

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
]

export const DEFAULT_BACKGROUND_MODE: BackgroundModeId = 'atmosphere'

export function findBackgroundMode(id: string): BackgroundMode {
  return (
    BACKGROUND_MODES.find((mode) => mode.id === id) ?? BACKGROUND_MODES[0]
  )
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
