import { cx } from '../../lib/cx'

/**
 * The Moon, drawn to the phase it is actually at.
 *
 * Not an emoji and not one of eight pictures. The terminator — the line
 * between the lit and unlit halves — is the projection of a circle seen at an
 * angle, which means it is an *ellipse* whose width is the cosine of the
 * phase angle, and drawing it that way makes a waxing crescent on the fourth
 * of the month visibly different from one on the fifth.
 *
 * Two arcs make the shape: the outer half-circle on the lit limb, and the
 * terminator back the other way. Which side each is on flips at the quarters,
 * which is what the two sweep flags below are doing.
 */

interface MoonDiscProps {
  /** 0 at new, 0.5 at full, 1 back at new. */
  cycle: number
  /** Pixel radius. */
  size?: number
  className?: string
  /** For a screen reader — the phase name and how lit it is. */
  label: string
}

export function MoonDisc({ cycle, size = 72, label, className }: MoonDiscProps) {
  const r = 50
  const theta = cycle * Math.PI * 2
  const rx = Math.abs(Math.cos(theta)) * r

  /* The lit limb is on the right while the Moon is waxing, on the left after. */
  const outer = cycle < 0.5 ? 1 : 0
  /*
   * The terminator bulges away from the lit limb once past the quarter — which
   * is the difference between a crescent and a gibbous, and is exactly the
   * sign of the cosine.
   */
  const inner = Math.cos(theta) > 0 ? 1 - outer : outer

  const path = `M 0 ${-r} A ${r} ${r} 0 0 ${outer} 0 ${r} A ${rx.toFixed(
    2,
  )} ${r} 0 0 ${inner} 0 ${-r} Z`

  return (
    <svg
      viewBox="-56 -56 112 112"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cx('astro-moon shrink-0', className)}
    >
      {/* The unlit disc, so the dark half is a moon rather than a hole. */}
      <circle
        r={r}
        fill="color-mix(in oklab, var(--ink) 12%, transparent)"
        stroke="var(--border)"
      />
      <path d={path} fill="var(--moonlight)" stroke="none" />
      {/*
        Two craters, at fixed positions. Enough to read as a moon rather than a
        pie chart, few enough not to become a texture.
      */}
      <g fill="color-mix(in oklab, var(--ink) 8%, transparent)">
        <circle cx="-14" cy="-16" r="9" />
        <circle cx="16" cy="12" r="6" />
        <circle cx="-4" cy="26" r="4" />
      </g>
      <circle
        r={r}
        fill="none"
        stroke="color-mix(in oklab, var(--moonlight) 60%, transparent)"
      />
    </svg>
  )
}
