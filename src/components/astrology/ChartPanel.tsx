import type { Chart } from '../../lib/astrology/chart'
import { placementOf } from '../../lib/astrology/chart'
import {
  ELEMENT_LABEL,
  MODALITY_LABEL,
  formatPosition,
  textGlyph,
} from '../../lib/astrology/signs'
import { BODY_PROFILES } from '../../lib/astrology/signs'
import type { Portrait } from '../../lib/astrology/natal'
import type { Vital } from '../../lib/astrology/reading'
import { Card, SectionHeading } from '../Card'
import { Disclosure } from '../Disclosure'
import { ChartWheel } from './ChartWheel'
import type { Element, Modality } from '../../lib/astrology/signs'

/**
 * Them, rather than today.
 *
 * The daily reading is what brings somebody back; this is what makes them stay
 * the first time. It is the longest text in the app by a distance and that is
 * deliberate — a portrait is read slowly, once, and returned to, and the thing
 * that ruins one is not length but padding.
 *
 * So it is ordered by how much of it a person will read: the three everybody
 * knows first, then the paragraph that ties them together, then the wheel,
 * then the balance, then the twelve placements and the aspects behind a fold
 * for the people who want all of it.
 */

interface ChartPanelProps {
  chart: Chart
  overlay: Chart | null
  portrait: Portrait
  vitals: Vital[]
  place: string
}

const ELEMENT_TINT: Record<Element, string> = {
  fire: 'var(--rose)',
  earth: 'var(--sage)',
  air: 'var(--gold)',
  water: 'var(--twilight)',
}

function BalanceBar({
  label,
  value,
  total,
  tint,
}: {
  label: string
  value: number
  total: number
  tint: string
}) {
  const share = total > 0 ? value / total : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[0.82rem] text-ink-muted">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-pill bg-[var(--control-sunken)]">
        <span
          className="block h-full rounded-pill transition-[width] duration-700 ease-[var(--ease-calm)]"
          style={{ width: `${Math.round(share * 100)}%`, background: tint }}
        />
      </span>
      <span className="w-6 shrink-0 text-right text-[0.8rem] tabular-nums text-ink-faint">
        {value}
      </span>
    </div>
  )
}

export function ChartPanel({
  chart,
  overlay,
  portrait,
  vitals,
  place,
}: ChartPanelProps) {
  const elements = Object.entries(portrait.balance.elements) as [Element, number][]
  const modalities = Object.entries(portrait.balance.modalities) as [Modality, number][]
  const elementTotal = elements.reduce((sum, [, value]) => sum + value, 0)
  const modalityTotal = modalities.reduce((sum, [, value]) => sum + value, 0)

  return (
    <div className="space-y-6">
      {/* ── The three everybody knows ── */}

      <div data-rise className="grid gap-3 md:grid-cols-3">
        {portrait.trio.map((entry) => (
          <div key={entry.key} className="surface-panel p-5">
            <div className="flex items-baseline gap-2">
              <span aria-hidden="true" className="astro-glyph text-[1.5rem] text-ink">
                {textGlyph(entry.symbol)}
              </span>
              <div>
                <p className="type-label">{entry.label}</p>
                <p className="font-display text-[1.35rem] leading-tight text-ink">
                  {entry.sign}
                </p>
              </div>
            </div>
            <p className="type-meta mt-1">{entry.detail}</p>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-muted">
              {entry.body}
            </p>
          </div>
        ))}
      </div>

      {/* ── The paragraph that ties them together ── */}

      <Card data-rise level="stage" className="astro-sky">
        <span aria-hidden="true" className="astro-sky__stars" />
        <div className="astro-sky__content">
          <SectionHeading>In one paragraph</SectionHeading>
          <p className="type-body -mt-1 text-[1.05rem] leading-relaxed">
            {portrait.opening}
          </p>
        </div>
      </Card>

      {/* ── Gifts and edges ── */}

      <div data-rise className="grid gap-3 md:grid-cols-2">
        <div className="astro-tint astro-tint--body p-5">
          <p className="type-label text-ink">What comes easily</p>
          <ul className="mt-2 space-y-2 text-[0.92rem] leading-relaxed text-ink-muted">
            {portrait.gifts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="astro-tint astro-tint--heart p-5">
          <p className="type-label text-ink">The growth edges</p>
          <ul className="mt-2 space-y-2 text-[0.92rem] leading-relaxed text-ink-muted">
            {portrait.edges.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="type-meta mt-3">
            These are here because a portrait made only of compliments is one
            nobody believes by the second week.
          </p>
        </div>
      </div>

      {/* ── The wheel ── */}

      <Card data-rise>
        <SectionHeading hint={`As seen from ${place}`}>The wheel</SectionHeading>
        <p className="type-body -mt-2 mb-4 max-w-[52ch]">
          Your birth chart on the inside, the sky as it is right now riding on
          the outside. The lines across the middle are the aspects between your
          own planets — green where they run easily, rose where they push.
        </p>

        <ChartWheel
          chart={chart}
          overlay={overlay}
          title={`Your birth chart with today's planets around it.`}
        />

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {vitals.map((vital) => (
            <div key={vital.label} className="surface-control px-3.5 py-2.5">
              <p className="type-label">{vital.label}</p>
              <p className="font-display mt-0.5 text-[1.15rem] text-ink">
                {vital.value}
              </p>
              {vital.detail && (
                <p className="mt-0.5 text-[0.76rem] leading-snug text-ink-faint">
                  {vital.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── What the chart is made of ── */}

      <Card data-rise title="What it is made of">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2.5">
            <p className="type-label">Elements</p>
            {elements.map(([element, value]) => (
              <BalanceBar
                key={element}
                label={ELEMENT_LABEL[element]}
                value={value}
                total={elementTotal}
                tint={ELEMENT_TINT[element]}
              />
            ))}
          </div>
          <div className="space-y-2.5">
            <p className="type-label">Modes</p>
            {modalities.map(([modality, value]) => (
              <BalanceBar
                key={modality}
                label={MODALITY_LABEL[modality]}
                value={value}
                total={modalityTotal}
                tint="var(--ink-faint)"
              />
            ))}
          </div>
        </div>

        <p className="type-body mt-5 max-w-[60ch]">{portrait.balance.note}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="surface-quiet p-4">
            <p className="type-label">Loudest planet</p>
            <p className="font-display mt-1 text-[1.2rem] text-ink">
              {BODY_PROFILES[portrait.dominant.body].name}
            </p>
            <p className="type-meta mt-1">Because {portrait.dominant.why}.</p>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-muted">
              {portrait.dominant.note}
            </p>
          </div>

          <div className="surface-quiet p-4">
            <p className="type-label">
              {portrait.emphasis ? 'Where the weight sits' : 'How you recharge'}
            </p>
            <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-muted">
              {portrait.emphasis ? portrait.emphasis.note : portrait.recharge}
            </p>
          </div>
        </div>
      </Card>

      {/* ── The chart talking to itself ── */}

      <Card
        data-rise
        title="The conversations inside your chart"
        description="Aspects between your own planets. Every one of these is permanent — not a phase you are in, but a pair of things in you that have always had this relationship."
      >
        <ul className="astro-rows space-y-3">
          {portrait.aspects.map((aspect, index) => (
            <li key={aspect.title} className="pt-3 first:pt-0">
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[1.05rem] text-ink">
                  {aspect.title}
                </span>
                <span className="type-meta shrink-0 tabular-nums">
                  {aspect.orb.toFixed(1)}°
                </span>
              </p>
              <p className="mt-1 text-[0.9rem] leading-relaxed text-ink-muted">
                {aspect.body}
              </p>
              {/*
                Only the three strongest get the "what to do about it" line.
                Four squares in a row all answered with the same sentence about
                friction reads as a template rather than a reading, and the
                three that matter most are the three worth the advice.
              */}
              {index < 3 && (
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink">
                  {aspect.use}
                </p>
              )}
            </li>
          ))}

          {portrait.aspects.length === 0 && (
            <li className="type-meta">
              Nothing in this chart is inside a tight aspect, which is unusual
              and tends to describe somebody whose parts operate fairly
              independently of one another.
            </li>
          )}
        </ul>
      </Card>

      {/* ── Every placement, at length ── */}

      <div data-rise className="space-y-3">
        <SectionHeading hint={`${portrait.placements.length} placements`}>
          Every planet, in full
        </SectionHeading>

        {portrait.placements.map((placement) => (
          <Disclosure
            key={placement.body}
            title={placement.title}
            summary={placement.sign.name}
          >
            <p className="type-body">{placement.text}</p>
            <p className="mt-3 flex gap-2 text-[0.92rem] leading-relaxed text-ink">
              <span aria-hidden="true" className="text-ink-faint">
                ?
              </span>
              {placement.question}
            </p>
          </Disclosure>
        ))}
      </div>

      {/* ── The table, for the people who want the numbers ── */}

      <div data-rise>
        <Disclosure title="Every position, to the minute">
          <ul className="space-y-1.5">
            {chart.placements.map((placement) => (
              <li
                key={placement.body}
                className="flex items-baseline justify-between gap-3 text-[0.9rem]"
              >
                <span className="text-ink">
                  <span aria-hidden="true" className="mr-2 text-ink-faint">
                    {textGlyph(BODY_PROFILES[placement.body].symbol)}
                  </span>
                  {BODY_PROFILES[placement.body].name}
                  {placement.retrograde && (
                    <span className="ml-1.5 text-[var(--rose-deep)]">℞</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {formatPosition(placement.longitude)}
                  {placement.house != null && (
                    <span className="ml-2 text-ink-faint">
                      house {placement.house}
                    </span>
                  )}
                </span>
              </li>
            ))}

            {chart.ascendant != null && (
              <>
                <li className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-1.5 text-[0.9rem]">
                  <span className="text-ink">Ascendant</span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatPosition(chart.ascendant)}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-3 text-[0.9rem]">
                  <span className="text-ink">Midheaven</span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatPosition(chart.midheaven!)}
                  </span>
                </li>
              </>
            )}
          </ul>

          <p className="type-meta mt-3">
            Whole-sign houses. Positions are ecliptic longitude of date,
            computed here from the standard solar and lunar theories and the JPL
            orbital elements — the same arithmetic an ephemeris uses, running on
            your phone.
          </p>
        </Disclosure>
      </div>

      {/* ── Where everything is right now ── */}

      {overlay && (
        <Card data-rise title="Where everything is now">
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {overlay.placements.map((placement) => (
              <li
                key={placement.body}
                className="flex items-baseline justify-between gap-3 text-[0.9rem]"
              >
                <span className="text-ink">
                  <span aria-hidden="true" className="mr-2 text-ink-faint">
                    {textGlyph(BODY_PROFILES[placement.body].symbol)}
                  </span>
                  {BODY_PROFILES[placement.body].name}
                  {placement.retrograde && (
                    <span className="ml-1.5 text-[var(--rose-deep)]">℞</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {formatPosition(placement.longitude)}
                </span>
              </li>
            ))}
          </ul>

          <p className="type-meta mt-3">
            The Moon is at {formatPosition(placementOf(overlay, 'moon').longitude)},{' '}
            {Math.round(overlay.phase.illumination * 100)}% lit and{' '}
            {overlay.phase.waxing ? 'filling' : 'emptying'}.
          </p>
        </Card>
      )}
    </div>
  )
}
