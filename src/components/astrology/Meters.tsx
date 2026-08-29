import { useEffect, useState } from 'react'
import type { Dial } from '../../lib/astrology/horoscope'
import { cx } from '../../lib/cx'

/**
 * Four numbers, drawn as arcs.
 *
 * People like a dial, and a dial is the fastest thing on a page to read — so
 * the four qualities of a day get one each, and the caption underneath each
 * one says where the number came from. That caption is not decoration: it is
 * what keeps this honest, because a number with no provenance is a horoscope
 * pretending to be an instrument.
 *
 * The arc is 260° rather than a full circle, with the gap at the bottom. A
 * ring that closes reads as a progress bar for something that will finish; one
 * that does not reads as a gauge, which is what these are.
 */

const TINTS: Record<Dial['key'], string> = {
  energy: 'var(--rose)',
  heart: 'var(--rose-deep)',
  mind: 'var(--gold)',
  calm: 'var(--sage)',
}

const SWEEP = 260
const RADIUS = 42
const LENGTH = (SWEEP / 360) * 2 * Math.PI * RADIUS

function Meter({ dial, delay }: { dial: Dial; delay: number }) {
  /*
   * The arcs fill from empty once, on mount, staggered by a tenth of a second
   * each. It is the one flourish on this screen and it earns its place: the
   * numbers are the first thing anybody looks at, and watching them arrive is
   * what makes the page feel like it was worked out rather than fetched.
   */
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setShown(dial.value), 60 + delay)
    return () => window.clearTimeout(timer)
  }, [dial.value, delay])

  const offset = LENGTH * (1 - shown / 100)

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <svg viewBox="0 0 100 100" width="88" height="88" aria-hidden="true">
          <g transform="rotate(140 50 50)">
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke="color-mix(in oklab, var(--ink) 9%, transparent)"
              strokeDasharray={`${LENGTH} 999`}
            />
            <circle
              className="astro-meter__value"
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke={TINTS[dial.key]}
              strokeDasharray={`${LENGTH} 999`}
              strokeDashoffset={offset}
            />
          </g>
        </svg>
        <span className="type-numeral absolute inset-0 flex items-center justify-center text-[1.45rem] text-ink">
          {dial.value}
        </span>
      </div>
      <p className="type-label mt-1">{dial.label}</p>
    </div>
  )
}

export function Meters({ dials, className }: { dials: Dial[]; className?: string }) {
  return (
    <div className={cx('space-y-4', className)}>
      <div className="grid grid-cols-4 gap-1 sm:gap-3">
        {dials.map((dial, index) => (
          <Meter key={dial.key} dial={dial} delay={index * 110} />
        ))}
      </div>

      <ul className="astro-rows space-y-2 text-[0.86rem] leading-relaxed text-ink-muted">
        {dials.map((dial) => (
          <li key={dial.key} className="pt-2 first:pt-0">
            <span className="font-medium text-ink">{dial.label}</span> · {dial.caption}
          </li>
        ))}
      </ul>

      <p className="type-meta">
        These are a description of the weather, not a score for your day. They
        come from the same contacts as everything else on this page — nothing
        here is random, and nothing here is a prediction.
      </p>
    </div>
  )
}
