import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { DEFAULT_STYLE, type BreathStyleId } from '../lib/breathing'
import { cx } from '../lib/cx'
import type { BreathingRuntime } from '../lib/useBreathing'

/**
 * The emotional centre of Manifester.
 *
 * Six forms, one clock. Every style is driven by the same two CSS custom
 * properties the breathing hook writes each frame — `--e` for expansion and
 * `--p` for progress through the current phase — so whichever one you pick,
 * it is following your breath to the same millisecond, and the browser only
 * ever composites transforms, opacity and one dash offset. React re-renders
 * once a second, for the countdown, and never for the animation itself.
 *
 * The same component appears small in the Create preview and large in the
 * Player; only `--size` changes. It is a registered custom property, so when
 * the Player's stage expands the orb *grows* to its new size rather than
 * jumping to it — and because every layer is measured in `--size`, the petals,
 * rings and stars all travel with it. See "The immersive stage" in `theme.css`.
 */

const SPOKES = [0, 60, 120, 180, 240, 300]
const RIPPLES = [0, 1, 2, 3]
const AURORA = [0, 1, 2]
const STARS = 12

export type VisualizerSize = 'sm' | 'md' | 'lg' | 'stage'

/*
 * `stage` is the expanded player, and it is the one size not decided here:
 * how big the orb may be depends on how much room the immersive layout has
 * left around it, which only the layout knows. It reads `--stage-orb` off the
 * expanded stage — see "The immersive stage" in `theme.css` — and falls back
 * to `lg` anywhere else, so the value is always a length.
 */
const SIZES: Record<VisualizerSize, string> = {
  sm: 'clamp(11rem, 34vw, 13rem)',
  md: 'clamp(13rem, 42vw, 16rem)',
  lg: 'clamp(15rem, 58vw, 21rem)',
  stage: 'var(--stage-orb, clamp(15rem, 58vw, 21rem))',
}

interface BreathingVisualizerProps {
  runtime: BreathingRuntime
  /** Which form to draw. Falls back to the lotus. */
  style?: BreathStyleId
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
  style = DEFAULT_STYLE,
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
      className={cx(
        'breath',
        `breath--${style}`,
        blooming && 'breath--awaken',
        className,
      )}
      style={{ '--size': SIZES[size] } as CSSProperties}
      role="img"
      aria-label={
        runtime.active
          ? `Breathing guide: ${runtime.label}, ${runtime.remaining} seconds left.`
          : 'Breathing guide, resting.'
      }
    >
      {LAYERS[style] ?? LAYERS.bloom}

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
        <div className="breath-caption pointer-events-none flex flex-col items-center gap-1 text-center">
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

/* ── The six forms ──────────────────────────────────────────── */

/**
 * Each entry is only markup: every scale, drift and fade lives in `theme.css`
 * against `--e`, so adding a style never adds a frame of JavaScript.
 */
const LAYERS: Record<BreathStyleId, ReactNode> = {
  /* A seed of light opening into six petals, wrapped in a moonlit halo. */
  bloom: (
    <>
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
    </>
  ),

  /* One disc, one ring, one glow. For people who want the guide to be quiet. */
  halo: (
    <>
      <span aria-hidden="true" className="breath-halo breath-halo--wide" />
      <span aria-hidden="true" className="breath-ring breath-ring--single" />
      <span aria-hidden="true" className="breath-disc" />
    </>
  ),

  /*
   * Still water. The rings are always travelling outward, but the speed and
   * the reach come from the breath — they surge as you fill and settle almost
   * to stillness as you empty.
   */
  ripple: (
    <>
      <span aria-hidden="true" className="breath-halo" />
      {RIPPLES.map((index) => (
        <span
          key={`ripple-${index}`}
          aria-hidden="true"
          className="breath-ripple"
          style={{ '--i': index } as CSSProperties}
        >
          <span className="breath-ripple__ring" />
        </span>
      ))}
      <span aria-hidden="true" className="breath-disc breath-disc--small" />
    </>
  ),

  /*
   * Three broad washes of colour on their own slow orbits. They overlap into
   * white light at the top of the breath and drift apart as it leaves.
   */
  aurora: (
    <>
      {AURORA.map((index) => (
        <span
          key={`aurora-${index}`}
          aria-hidden="true"
          className="breath-aurora"
          style={{ '--i': index } as CSSProperties}
        >
          <span className="breath-aurora__veil" />
        </span>
      ))}
      <span aria-hidden="true" className="breath-ring breath-ring--single" />
      <span aria-hidden="true" className="breath-core breath-core--faint" />
    </>
  ),

  /*
   * Twelve stars on twelve spokes, drawing out to the rim and back to a single
   * point of light. The one style that reads clearly at a glance across a room.
   */
  constellation: (
    <>
      <span aria-hidden="true" className="breath-halo" />
      {Array.from({ length: STARS }, (_, index) => (
        <span
          key={`star-${index}`}
          aria-hidden="true"
          className={cx('breath-star', index % 3 === 0 && 'breath-star--bright')}
          style={
            {
              '--angle': `${(360 / STARS) * index}deg`,
              '--i': index,
            } as CSSProperties
          }
        >
          <span className="breath-star__dot" />
        </span>
      ))}
      <span aria-hidden="true" className="breath-spark" />
    </>
  ),

  /*
   * A circle filling with water. The most literal of the six — the level *is*
   * your lungs — and the one that reads instantly with no explanation at all.
   */
  tide: (
    <>
      <span aria-hidden="true" className="breath-halo breath-halo--wide" />
      <span aria-hidden="true" className="breath-vessel">
        <span className="breath-water">
          <span className="breath-water__crest" />
          <span className="breath-water__crest breath-water__crest--slow" />
        </span>
      </span>
      <span aria-hidden="true" className="breath-ring breath-ring--single" />
    </>
  ),
}

/**
 * A small, still-breathing sample of one form, for the style picker.
 *
 * It is the real thing at a smaller `--size`, frozen at a comfortable
 * half-open pose — so choosing a form means choosing between six pictures
 * rather than six adjectives. No hook and no clock: whatever a style animates
 * on its own still moves, which is exactly the part a static image could not
 * have shown you.
 */
export function BreathStyleThumbnail({
  style,
  className,
}: {
  style: BreathStyleId
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cx('breath breath--thumb', `breath--${style}`, className)}
      style={{ '--size': '3.5rem', '--e': 0.62, '--p': 0.62 } as CSSProperties}
    >
      {LAYERS[style] ?? LAYERS.bloom}
    </span>
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
