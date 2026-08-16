import { useMemo } from 'react'
import type { Chart } from '../../lib/astrology/chart'
import {
  ASPECTS,
  BODY_PROFILES,
  SIGNS,
  aspectBetween,
  formatShort,
  type Element,
} from '../../lib/astrology/signs'
import { cx } from '../../lib/cx'

/**
 * The chart, drawn.
 *
 * A wheel of this kind is the one image in astrology that is genuinely
 * *information* rather than decoration: it is a polar plot of ecliptic
 * longitude, and once you can read it you can see at a glance that four
 * planets are piled into one sign, or that two of them are exactly opposite.
 * Nothing written can do that as fast, which is why every chart service on the
 * web draws one and why this feature would feel thin without it.
 *
 * ── The conventions, since they are not arbitrary ───────────────────────────
 *
 * The Ascendant is on the **left**, horizontal, and the zodiac runs
 * **anticlockwise** from it. That is not a stylistic choice; it is the
 * orientation every printed chart has used for centuries, and it means the
 * left half of the wheel is the eastern horizon and the top is overhead — so
 * the picture is a view of the sky from where the person was standing. Drawing
 * it any other way would make it unreadable to anybody who has seen one
 * before.
 *
 * When there is no birth time there is no Ascendant, so the wheel falls back
 * to 0° Aries on the left. It says so underneath rather than pretending.
 *
 * ── Why the glyphs shuffle ──────────────────────────────────────────────────
 *
 * Planets bunch. Three bodies within two degrees of each other is completely
 * ordinary and would draw as one illegible smudge, so the labels are pushed
 * apart until they are at least seven degrees from their neighbours while a
 * thin leader line keeps each one tied to the degree it actually occupies.
 * The glyph moves; the truth does not.
 */

/** How close two glyphs may sit before they are pushed apart, in degrees. */
const MIN_GAP = 7.5

const ELEMENT_TINT: Record<Element, string> = {
  fire: 'var(--rose)',
  earth: 'var(--sage)',
  air: 'var(--gold)',
  water: 'var(--twilight)',
}

interface ChartWheelProps {
  chart: Chart
  /** Drawn faintly on an inner ring: today's sky over a natal chart. */
  overlay?: Chart | null
  className?: string
  /** Accessible summary. The wheel itself is decorative to a screen reader. */
  title: string
}

interface Spoke {
  key: string
  symbol: string
  /** Where it really is. */
  longitude: number
  /** Where the glyph is drawn, after being nudged clear of its neighbours. */
  shown: number
  retrograde: boolean
  label: string
}

/** Push overlapping glyphs apart without letting them wander far. */
function declutter(spokes: Spoke[]): Spoke[] {
  const sorted = [...spokes].sort((a, b) => a.longitude - b.longitude)

  /*
   * Several relaxation passes rather than one, because pushing A away from B
   * can push it into C. Six is comfortably enough for eleven bodies and the
   * loop is over in microseconds.
   */
  for (let pass = 0; pass < 6; pass += 1) {
    for (let index = 0; index < sorted.length; index += 1) {
      const here = sorted[index]
      const next = sorted[(index + 1) % sorted.length]
      const gap = ((next.shown - here.shown + 360) % 360)
      if (gap >= MIN_GAP) continue
      const push = (MIN_GAP - gap) / 2
      here.shown = (here.shown - push + 360) % 360
      next.shown = (next.shown + push) % 360
    }
  }

  return sorted
}

export function ChartWheel({ chart, overlay, className, title }: ChartWheelProps) {
  const size = 320
  const centre = size / 2

  /** Ascendant to the left, or the equinox point when there is no birth time. */
  const rotation = chart.ascendant ?? 0

  const point = (longitude: number, radius: number): [number, number] => {
    const angle = ((longitude - rotation + 180) * Math.PI) / 180
    return [centre + radius * Math.cos(angle), centre - radius * Math.sin(angle)]
  }

  const inner = useMemo(
    () =>
      declutter(
        chart.placements.map((placement) => ({
          key: placement.body,
          symbol: BODY_PROFILES[placement.body].symbol,
          longitude: placement.longitude,
          shown: placement.longitude,
          retrograde: placement.retrograde,
          label: `${BODY_PROFILES[placement.body].name} at ${formatShort(placement.longitude)}`,
        })),
      ),
    [chart],
  )

  const outer = useMemo(
    () =>
      overlay
        ? declutter(
            overlay.placements.map((placement) => ({
              key: `t-${placement.body}`,
              symbol: BODY_PROFILES[placement.body].symbol,
              longitude: placement.longitude,
              shown: placement.longitude,
              retrograde: placement.retrograde,
              label: `Transiting ${BODY_PROFILES[placement.body].name} at ${formatShort(placement.longitude)}`,
            })),
          )
        : [],
    [overlay],
  )

  /**
   * The lines across the middle.
   *
   * Only between the bodies of the chart itself, and only the five aspects
   * that carry weight — a wheel with every quincunx on it is a ball of wool.
   * The Moon's are included and they are the ones that change daily, which is
   * exactly what makes the picture worth looking at again tomorrow.
   */
  const lines = useMemo(() => {
    const drawn: {
      key: string
      from: number
      to: number
      temper: string
      strength: number
    }[] = []

    const bodies = chart.placements.filter((placement) => placement.body !== 'node')

    for (let a = 0; a < bodies.length; a += 1) {
      for (let b = a + 1; b < bodies.length; b += 1) {
        const found = aspectBetween(bodies[a].longitude, bodies[b].longitude)
        if (!found || found.kind.id === 'quincunx') continue
        drawn.push({
          key: `${bodies[a].body}-${bodies[b].body}`,
          from: bodies[a].longitude,
          to: bodies[b].longitude,
          temper: found.kind.temper,
          strength: found.exactness,
        })
      }
    }

    return drawn
  }, [chart])

  /*
   * Two layouts, because a transit wheel has one more ring to fit.
   *
   * With today's sky riding outside, everything else is pulled in so the
   * transiting glyphs get a band of their own rather than sharing the zodiac
   * ring with the sign symbols — which read as one row of glyphs at a glance
   * and made it impossible to tell a planet from a sign.
   */
  const signRing = overlay ? 134 : 150
  const signInner = overlay ? 112 : 124
  const glyphRing = overlay ? 97 : 104
  const overlayRing = 149
  const aspectRing = overlay ? 86 : 92

  return (
    <figure className={cx('mx-auto w-full max-w-[22rem]', className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={title}
        className="w-full"
      >
        {/* The twelve sectors, tinted by element so the balance is visible. */}
        {SIGNS.map((sign, index) => {
          const start = index * 30
          const [x1, y1] = point(start, signInner)
          const [x2, y2] = point(start, signRing)
          const [mx, my] = point(start + 15, (signInner + signRing) / 2)
          return (
            <g key={sign.name}>
              <path
                d={sectorPath(point, start, start + 30, signInner, signRing)}
                fill={ELEMENT_TINT[sign.element]}
                opacity={0.09}
              />
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--border-strong)"
                strokeWidth={0.75}
              />
              <text
                x={mx}
                y={my}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fill="var(--ink-muted)"
              >
                {sign.symbol}
              </text>
            </g>
          )
        })}

        <circle
          cx={centre}
          cy={centre}
          r={signRing}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />
        <circle
          cx={centre}
          cy={centre}
          r={signInner}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />

        {/* Whole-sign house divisions, only where there is an Ascendant. */}
        {chart.ascendant != null &&
          Array.from({ length: 12 }, (_, house) => {
            const cusp = Math.floor(chart.ascendant! / 30) * 30 + house * 30
            const [x1, y1] = point(cusp, aspectRing)
            const [x2, y2] = point(cusp, signInner)
            const [lx, ly] = point(cusp + 15, aspectRing + 9)
            return (
              <g key={`house-${house}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--quiet-border)"
                  strokeWidth={0.5}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7.5}
                  fill="var(--ink-faint)"
                >
                  {house + 1}
                </text>
              </g>
            )
          })}

        {/* Aspects, across the middle. */}
        <g>
          {lines.map((line) => {
            const [x1, y1] = point(line.from, aspectRing)
            const [x2, y2] = point(line.to, aspectRing)
            return (
              <line
                key={line.key}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={
                  line.temper === 'flowing'
                    ? 'var(--sage)'
                    : line.temper === 'charged'
                      ? 'var(--rose-deep)'
                      : 'var(--ink-faint)'
                }
                strokeWidth={0.5 + line.strength * 1.1}
                opacity={0.2 + line.strength * 0.45}
              />
            )
          })}
        </g>

        <circle
          cx={centre}
          cy={centre}
          r={aspectRing}
          fill="none"
          stroke="var(--quiet-border)"
          strokeWidth={0.75}
        />

        {/* The horizon and the meridian, which is what makes it a *chart*. */}
        {chart.ascendant != null && chart.midheaven != null && (
          <g>
            {[
              { longitude: chart.ascendant, label: 'AC' },
              { longitude: chart.midheaven, label: 'MC' },
            ].map(({ longitude, label }) => {
              const [x1, y1] = point(longitude, 0)
              const [x2, y2] = point(longitude, signInner)
              const [lx, ly] = point(longitude, signInner + 11)
              return (
                <g key={label}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="var(--rose-deep)"
                    strokeWidth={1}
                    opacity={0.55}
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={8}
                    fontWeight={600}
                    fill="var(--rose-deep)"
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          </g>
        )}

        {/* The bodies, each tied by a leader to the degree it really occupies. */}
        {inner.map((spoke) => {
          const [tx, ty] = point(spoke.longitude, aspectRing)
          const [nx, ny] = point(spoke.shown, glyphRing)
          const [gx, gy] = point(spoke.shown, glyphRing)
          return (
            <g key={spoke.key}>
              <title>{spoke.label}</title>
              <line
                x1={tx}
                y1={ty}
                x2={nx}
                y2={ny}
                stroke="var(--border-strong)"
                strokeWidth={0.5}
              />
              <circle cx={tx} cy={ty} r={1.4} fill="var(--ink-faint)" />
              <text
                x={gx}
                y={gy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fill="var(--ink)"
              >
                {spoke.symbol}
              </text>
              {spoke.retrograde && (
                <text
                  x={gx + 8}
                  y={gy + 6}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={6.5}
                  fill="var(--rose-deep)"
                >
                  ℞
                </text>
              )}
            </g>
          )
        })}

        {/* Today's sky, on the outside, when this is a transit wheel. */}
        {outer.map((spoke) => {
          const [gx, gy] = point(spoke.shown, overlayRing)
          return (
            <g key={spoke.key} opacity={0.72}>
              <title>{spoke.label}</title>
              <text
                x={gx}
                y={gy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fill="var(--rose-deep)"
              >
                {spoke.symbol}
              </text>
            </g>
          )
        })}
      </svg>

      <figcaption className="type-meta mt-2 text-center">
        {chart.ascendant == null
          ? 'Drawn from 0° Aries — a birth time would put your own horizon on the left.'
          : 'Your horizon is on the left; overhead is at the top.'}
        {overlay && ' Today’s planets ride on the outside.'}
      </figcaption>

      <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {ASPECTS.filter((kind) => kind.id !== 'quincunx').map((kind) => (
          <li key={kind.id} className="type-meta text-[0.7rem]">
            <span
              aria-hidden="true"
              className={cx(
                'mr-1',
                kind.temper === 'flowing'
                  ? 'text-[var(--sage)]'
                  : kind.temper === 'charged'
                    ? 'text-[var(--rose-deep)]'
                    : 'text-ink-faint',
              )}
            >
              {kind.symbol}
            </span>
            {kind.name}
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** An annulus sector, which SVG has no primitive for. */
function sectorPath(
  point: (longitude: number, radius: number) => [number, number],
  from: number,
  to: number,
  innerRadius: number,
  outerRadius: number,
): string {
  const [ax, ay] = point(from, innerRadius)
  const [bx, by] = point(to, innerRadius)
  const [cxOuter, cyOuter] = point(to, outerRadius)
  const [dx, dy] = point(from, outerRadius)

  // Anticlockwise on screen, which is `sweep-flag: 0` in SVG's coordinates
  // because its y axis points down.
  return [
    `M ${ax} ${ay}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${bx} ${by}`,
    `L ${cxOuter} ${cyOuter}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${dx} ${dy}`,
    'Z',
  ].join(' ')
}
