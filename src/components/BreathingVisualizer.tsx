import { useEffect, useState, type CSSProperties } from 'react'
import { cx } from '../lib/cx'
import type { BreathingRuntime } from '../lib/useBreathing'

/**
 * The emotional centre of Manifester.
 *
 * A seed of light opening into six petals, wrapped in a moonlit halo and a
 * thin phase ring. Everything is driven by two CSS custom properties the
 * breathing hook writes each frame — `--e` for expansion and `--p` for
 * progress through the current phase — so the browser only ever composites
 * transforms, opacity and one dash offset. React re-renders once a second,
 * for the countdown, and never for the animation itself.
 *
 * The same component appears small in the Create preview and large in the
 * Player; only `--size` changes.
 */

const SPOKES = [0, 60, 120, 180, 240, 300]

export type VisualizerSize = 'sm' | 'md' | 'lg'

const SIZES: Record<VisualizerSize, string> = {
  sm: 'clamp(11rem, 34vw, 13rem)',
  md: 'clamp(13rem, 42vw, 16rem)',
  lg: 'clamp(15rem, 58vw, 21rem)',
}

interface BreathingVisualizerProps {
  runtime: BreathingRuntime
  size?: VisualizerSize
  /**
   * Renders the phase word and countdown inside the orb. The Player wants
   * this; the Create preview labels itself underneath instead.
   */
  showPhase?: boolean
  /** Blooms once when it becomes true — used as a session begins. */
  awaken?: boolean
  className?: string
}

export function BreathingVisualizer({
  runtime,
  size = 'md',
  showPhase = false,
  awaken = false,
  className,
}: BreathingVisualizerProps) {
  const [blooming, setBlooming] = useState(false)

  useEffect(() => {
    if (!awaken) return
    setBlooming(true)
    const timeout = window.setTimeout(() => setBlooming(false), 1500)
    return () => window.clearTimeout(timeout)
  }, [awaken])

  return (
    <div
      ref={runtime.stageRef}
      className={cx('breath', blooming && 'breath--awaken', className)}
      style={{ '--size': SIZES[size] } as CSSProperties}
      role="img"
      aria-label={
        runtime.active
          ? `Breathing guide: ${runtime.label}, ${runtime.remaining} seconds left.`
          : 'Breathing guide, resting.'
      }
    >
      <span aria-hidden="true" className="breath-halo" />

      {SPOKES.map((angle) => (
        <span
          key={`petal-${angle}`}
          aria-hidden="true"
          className="breath-petal"
          style={{ '--angle': `${angle}deg` } as CSSProperties}
        />
      ))}

      <span aria-hidden="true" className="breath-ring breath-ring--outer" />
      <span aria-hidden="true" className="breath-ring breath-ring--inner" />

      {SPOKES.map((angle) => (
        <span
          key={`seed-${angle}`}
          aria-hidden="true"
          className="breath-seed"
          style={{ '--angle': `${angle + 30}deg` } as CSSProperties}
        />
      ))}

      <span aria-hidden="true" className="breath-core" />

      <svg
        aria-hidden="true"
        className="breath-progress"
        viewBox="0 0 100 100"
        focusable="false"
      >
        <circle className="breath-progress__track" cx="50" cy="50" r="48" />
        <circle className="breath-progress__value" cx="50" cy="50" r="48" />
      </svg>

      {showPhase && (
        <div className="pointer-events-none flex flex-col items-center gap-1 text-center">
          <span
            key={runtime.phase}
            className="animate-phase-in font-display text-[1.5rem] leading-none text-ink"
          >
            {runtime.active ? runtime.label : 'Ready'}
          </span>
          {runtime.active && (
            <span className="type-numeral text-[0.95rem] text-ink-muted">
              {runtime.remaining}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The phase word, count and breath tally, for layouts that place the label
 * outside the orb.
 */
export function BreathingCaption({
  runtime,
  className,
}: {
  runtime: BreathingRuntime
  className?: string
}) {
  if (!runtime.active) return null

  return (
    <div
      className={cx('flex flex-col items-center gap-1', className)}
      aria-live="polite"
    >
      <span
        key={runtime.phase}
        className="animate-phase-in font-display text-[1.35rem] leading-none text-ink"
      >
        {runtime.label}
      </span>
      <span className="type-numeral text-[0.85rem] text-ink-muted">
        {runtime.remaining}s
        {runtime.breaths > 0 &&
          ` · ${runtime.breaths} ${runtime.breaths === 1 ? 'breath' : 'breaths'}`}
      </span>
    </div>
  )
}
