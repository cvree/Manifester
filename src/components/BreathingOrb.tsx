import type { CSSProperties } from 'react'
import type { BreathingRuntime } from '../lib/useBreathing'

/**
 * The breathing guide's visuals.
 *
 * Everything scales from a single `--e` custom property that the hook writes
 * each frame, so the browser only ever composites transforms and opacity — no
 * layout, no paint, no React work per frame.
 *
 * Six seed lights ride outward on the breath, picking up the seed-and-star
 * motif from the app icon and the background.
 *
 * Rendered as an absolutely positioned layer behind the play button, and never
 * interactive — the button underneath must always take the tap.
 */

const SEEDS = [0, 60, 120, 180, 240, 300]

export function BreathingOrb({ runtime }: { runtime: BreathingRuntime }) {
  return (
    <div
      ref={runtime.stageRef}
      className="breath-stage pointer-events-none absolute inset-0 flex items-center justify-center"
      role="img"
      aria-label={`Breathing guide. ${runtime.label}.`}
    >
      <span aria-hidden="true" className="breath-halo" />
      <span aria-hidden="true" className="breath-ring breath-ring--outer" />
      <span aria-hidden="true" className="breath-ring breath-ring--inner" />

      {SEEDS.map((angle) => (
        <span
          key={angle}
          aria-hidden="true"
          className="breath-seed"
          style={{ '--angle': `${angle}deg` } as CSSProperties}
        />
      ))}

      <span aria-hidden="true" className="breath-core" />
    </div>
  )
}

/** The phase name and count, shown under the orb. */
export function BreathingCaption({ runtime }: { runtime: BreathingRuntime }) {
  if (!runtime.active) return null

  return (
    <div className="flex flex-col items-center gap-0.5" aria-live="polite">
      <span
        key={runtime.phase}
        className="animate-phase-in font-display text-[1.35rem] leading-none text-ink"
      >
        {runtime.label}
      </span>
      <span className="text-[0.85rem] tabular-nums text-ink-faint">
        {runtime.remaining}
        {runtime.breaths > 0 &&
          ` · ${runtime.breaths} ${runtime.breaths === 1 ? 'breath' : 'breaths'}`}
      </span>
    </div>
  )
}
