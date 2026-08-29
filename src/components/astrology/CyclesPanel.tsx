import { useMemo } from 'react'
import type { Chart, Where } from '../../lib/astrology/chart'
import { cyclesOf } from '../../lib/astrology/cycles'
import { BODY_PROFILES, textGlyph } from '../../lib/astrology/signs'
import { cx } from '../../lib/cx'
import { Card } from '../Card'
import { MoonDisc } from './MoonDisc'

/**
 * The month, the week, the season and the chapter.
 *
 * ── Why this panel exists ───────────────────────────────────────────────────
 *
 * Because almost nothing that matters happens inside a single day, and a
 * feature that can only describe today quietly teaches people that the whole
 * thing is trivia. The questions somebody actually arrives with — *am I in the
 * middle of something, is this stretch going to end, why has this year been
 * like this* — are questions about arcs.
 *
 * The week strip is the most immediately useful thing here: it is the one
 * screen in the app somebody might plan around, and seeing on Monday that
 * Thursday is the open day is worth more than any paragraph on this page.
 */

interface CyclesPanelProps {
  natal: Chart
  where: Where | null
  /** Recomputed when the calendar day rolls over. */
  day: string
}

const WORD_TINT: Record<string, string> = {
  Open: 'var(--sage)',
  Mixed: 'var(--twilight)',
  Quiet: 'var(--ink-faint)',
  Charged: 'var(--rose)',
  Deep: 'var(--gold)',
}

function dateLine(at: Date): string {
  return at.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

function timeLine(at: Date): string {
  return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function CyclesPanel({ natal, where, day }: CyclesPanelProps) {
  /*
   * Built here rather than in the hook. The week ahead is seven readings and
   * the chapters walk twenty years of Saturn five days at a time — a few
   * milliseconds, but there is no reason for somebody who only ever opens
   * Today to spend them.
   */
  const cycles = useMemo(
    () => cyclesOf(natal, where, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `day` is the clock
    [natal, where, day],
  )

  const { phase, week, newMoon, fullMoon, retrogrades, ingresses, chapters, solar } =
    cycles

  return (
    <div className="space-y-6">
      {/* ── Where the Moon is in its month ── */}

      <Card data-rise level="stage" className="astro-sky">
        <span aria-hidden="true" className="astro-sky__stars" />
        <span aria-hidden="true" className="astro-sky__aurora" />

        <div className="astro-sky__content flex flex-wrap items-start gap-5">
          <MoonDisc
            cycle={phase.cycle}
            size={104}
            label={`${phase.name}, ${Math.round(phase.illumination * 100)}% lit`}
          />

          <div className="min-w-[16rem] flex-1">
            <p className="type-label">
              Day {Math.round(phase.cycle * 29.5) + 1} of the lunar month
            </p>
            <h2 className="type-title mt-1">{phase.name}</h2>
            <p className="type-meta mt-1">
              {Math.round(phase.illumination * 100)}% lit and{' '}
              {phase.waxing ? 'filling' : 'emptying'}, in {phase.sign.name}.
            </p>
            <p className="type-body mt-3 max-w-[52ch]">{phase.lore.is}</p>
          </div>
        </div>

        <div className="astro-sky__content mt-5 grid gap-3 sm:grid-cols-3">
          <div className="surface-quiet p-4">
            <p className="type-label text-[var(--sage)]">Good for</p>
            <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink">
              {phase.lore.doThis}
            </p>
          </div>
          <div className="surface-quiet p-4">
            <p className="type-label text-[var(--twilight)]">Rest</p>
            <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink">
              {phase.lore.rest}
            </p>
          </div>
          <div className="surface-quiet p-4">
            <p className="type-label text-[var(--gold)]">Sit with</p>
            <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink">
              {phase.lore.question}
            </p>
          </div>
        </div>
      </Card>

      {/* ── The week ── */}

      <Card
        data-rise
        title="The seven days ahead"
        description="Each one read exactly the way today is. The starred day is the easiest of the seven — put the difficult conversation there."
      >
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((entry, index) => (
            <div
              key={entry.at.toISOString()}
              className={cx(
                'flex flex-col items-center gap-1 rounded-[0.9rem] border p-2 text-center',
                entry.best
                  ? 'border-[color-mix(in_oklab,var(--sage)_55%,transparent)] bg-[var(--sage-soft)]'
                  : 'border-[var(--border)] bg-[var(--quiet)]',
              )}
            >
              <span className="text-[0.7rem] font-semibold text-ink-faint">
                {index === 0 ? 'Today' : entry.weekday}
              </span>
              <MoonDisc
                cycle={entry.cycle}
                size={20}
                label={`${entry.phaseName}, ${Math.round(entry.illumination * 100)}% lit`}
              />
              <span aria-hidden="true" className="astro-glyph text-[1.05rem] text-ink">
                {textGlyph(entry.moonSign.symbol)}
              </span>
              <span
                className="h-1.5 w-full rounded-pill"
                style={{ background: WORD_TINT[entry.word] ?? 'var(--ink-faint)' }}
              />
              <span className="text-[0.68rem] leading-tight text-ink-muted">
                {entry.word}
              </span>
            </div>
          ))}
        </div>

        <ul className="astro-rows mt-4 space-y-2 text-[0.88rem]">
          {week.map((entry, index) => (
            <li key={entry.at.toISOString()} className="flex gap-3 pt-2 first:pt-0">
              <span className="w-24 shrink-0 text-ink-faint">
                {index === 0 ? 'Today' : entry.weekday} {entry.dayNumber}
              </span>
              <span className="text-ink-muted">
                <span className="text-ink">{entry.headline}.</span>{' '}
                {entry.word.toLowerCase()} · Moon in {entry.moonSign.name}
                {entry.turns && ' (it changes sign today)'} · {entry.phaseName}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── The next two turning points ── */}

      <div data-rise className="grid gap-3 md:grid-cols-2">
        {[newMoon, fullMoon].map((lunation) => (
          <div key={lunation.kind} className="astro-tint astro-tint--spirit p-5">
            <p className="type-label text-ink">
              {lunation.kind === 'new' ? 'Next new moon' : 'Next full moon'}
            </p>
            <p className="font-display mt-1 text-[1.2rem] text-ink">
              {dateLine(lunation.at)}
            </p>
            <p className="type-meta mt-0.5">{timeLine(lunation.at)}</p>
            <p className="mt-2.5 text-[0.9rem] leading-relaxed text-ink-muted">
              {lunation.text}
            </p>
          </div>
        ))}
      </div>

      {/* ── The chapters ── */}

      <Card
        data-rise
        title="The long chapters"
        description="The handful of transits that only happen once or twice in a life. Most people are inside one and have never been told which."
      >
        {chapters.length === 0 ? (
          <p className="type-body">
            None of the big cycles is near your chart in the next twenty years,
            which is its own answer: whatever this stretch of your life is
            about, it is not being driven by the slow ones.
          </p>
        ) : (
          <ul className="astro-rows space-y-3">
            {chapters.map((chapter) => (
              <li key={chapter.id} className="pt-3 first:pt-0">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-[1.1rem] text-ink">
                    {chapter.title}
                  </span>
                  <span
                    className={cx(
                      'astro-pill',
                      chapter.status === 'now' && 'astro-pill--lead',
                    )}
                  >
                    {chapter.when}
                  </span>
                </p>
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-muted">
                  {chapter.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Your own new year ── */}

      <Card data-rise className="astro-tint astro-tint--mind">
        <p className="type-label text-ink">Your solar return</p>
        <p className="font-display mt-1 text-[1.35rem] text-ink">
          {dateLine(solar.at)}
        </p>
        <p className="type-body mt-2 max-w-[52ch]">{solar.text}</p>
      </Card>

      {/* ── Retrogrades and ingresses ── */}

      <div data-rise className="grid gap-3 md:grid-cols-2">
        <Card title="Going backwards">
          {retrogrades.length === 0 ? (
            <p className="type-body">
              Nothing is retrograde right now. Everything in the sky is moving
              forwards, which happens less often than you would think.
            </p>
          ) : (
            <ul className="astro-rows space-y-2.5">
              {retrogrades.map((entry) => (
                <li key={entry.body} className="pt-2.5 first:pt-0">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="text-ink">
                      <span aria-hidden="true" className="mr-2 text-ink-faint">
                        {textGlyph(BODY_PROFILES[entry.body].symbol)}
                      </span>
                      {BODY_PROFILES[entry.body].name} ℞
                    </span>
                    {entry.direct && (
                      <span className="type-meta shrink-0">
                        direct{' '}
                        {entry.direct.toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-muted">
                    {entry.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Changing sign soon">
          {ingresses.length === 0 ? (
            <p className="type-body">
              Nothing changes sign in the next couple of months. The texture of
              this stretch is going to hold.
            </p>
          ) : (
            <ul className="astro-rows space-y-2.5">
              {ingresses.map((entry) => (
                <li key={`${entry.body}-${entry.at.toISOString()}`} className="pt-2.5 first:pt-0">
                  <p className="type-meta">
                    {entry.at.toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                  <p className="mt-0.5 text-[0.9rem] leading-relaxed text-ink">
                    {entry.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
