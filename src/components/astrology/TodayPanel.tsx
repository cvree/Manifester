import { useState } from 'react'
import { useNavigate } from 'react-router'
import { whenPhrase, type Horoscope } from '../../lib/astrology/horoscope'
import { drawCard, DECK_SIZE, type Card as OracleCard } from '../../lib/astrology/oracle'
import { placementOf } from '../../lib/astrology/chart'
import { textGlyph } from '../../lib/astrology/signs'
import { recordEngagement } from '../../lib/engagement'
import { cue } from '../../lib/feedback'
import { shareText } from '../../lib/share'
import { useSession } from '../../state/SessionProvider'
import { Button } from '../Button'
import { Card, SectionHeading } from '../Card'
import { Disclosure } from '../Disclosure'
import { CopyIcon, MoonIcon, PlayIcon, SparkIcon, StarIcon } from '../Icons'
import { DayArc } from './DayArc'
import { Meters } from './Meters'
import { MoonDisc } from './MoonDisc'

/**
 * Today.
 *
 * ── What this screen is trying to be ────────────────────────────────────────
 *
 * The thing somebody opens before they are properly awake. That imposes an
 * order, and the order is the whole design: the *feel* of the day first, in a
 * sentence somebody can read with one eye open; then four numbers, because a
 * number is the fastest thing on a page; then the practice, because that is
 * what the app is for and burying it under nine hundred words of astrology
 * would be a different product; and only then the depth — the paragraphs, the
 * four areas of a life, the hours, the contacts — for the mornings somebody
 * has ten minutes rather than one.
 *
 * ── Why the practice card sits so high ──────────────────────────────────────
 *
 * Because the reading is a doorway and not a destination. Every visit that
 * ends in a session is the feature doing its job; every visit that ends in a
 * paragraph is a horoscope app wearing this one's clothes. So the passage and
 * the button are above the fold on a phone, and everything below them is
 * optional by design.
 *
 * ── Why the card offers a paragraph and a line ──────────────────────────────
 *
 * The paragraph is what the day is actually worth — six or seven sentences
 * assembled out of the same arithmetic as the rest of the screen, running
 * about a minute a pass, so the second pass lands differently from the first.
 * The single line underneath it is for the mornings that have four minutes in
 * them. Both are on the same card, and neither is described as the lesser one.
 */

interface TodayPanelProps {
  horoscope: Horoscope
}

/**
 * How long a pass takes, rounded to something a person would say.
 *
 * "About 47 seconds" is a machine talking. The estimate is worth showing —
 * somebody deciding between the paragraph and the one line wants to know what
 * they are agreeing to — and it is not worth pretending it is precise.
 */
function aboutSeconds(seconds: number): string {
  if (seconds < 55) return `${Math.round(seconds / 5) * 5} seconds`
  if (seconds < 80) return 'a minute'
  return `${Math.round(seconds / 30) / 2} minutes`
}

export function TodayPanel({ horoscope }: TodayPanelProps) {
  const navigate = useNavigate()
  const { updateDraft, prime, start } = useSession()
  const [card, setCard] = useState<OracleCard | null>(null)
  const [copied, setCopied] = useState(false)

  const { reading, sky, passage } = horoscope
  const moon = placementOf(sky, 'moon')

  const today = new Date(`${reading.day}T12:00:00`)

  /** What a session started from this screen is called in the library. */
  const dayTitle = `${reading.focus.label} · ${today.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`

  /** Start a session on a line, from wherever on this page it was pressed. */
  const loop = (text: string, title: string) => {
    cue('start')
    prime()
    updateDraft({ text, title })
    // One tick, so the session reads the draft that was just queued rather
    // than the one before it. The same wait the welcome flow takes.
    window.setTimeout(() => {
      start()
      recordEngagement()
      navigate('/player')
    }, 20)
  }

  return (
    <div className="space-y-6">
      {/* ── The sky itself ── */}

      <Card level="stage" data-rise className="astro-sky sm:px-8 sm:py-9">
        <span aria-hidden="true" className="astro-sky__stars" />
        <span aria-hidden="true" className="astro-sky__aurora" />

        <div className="astro-sky__content">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="astro-pill astro-pill--lead">
                  {reading.weatherWord} day
                </span>
                <span className="astro-pill">
                  <span aria-hidden="true" className="astro-glyph text-[0.95rem]">
                    {textGlyph(moon.sign.symbol)}
                  </span>
                  Moon in {moon.sign.name}
                </span>
              </div>

              <p className="type-meta mt-3">
                {today.toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>

              <h2 className="type-display mt-1 text-balance">{reading.headline}</h2>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <MoonDisc
                cycle={sky.phase.cycle}
                size={78}
                className="size-[64px] sm:size-[108px]"
                label={`${sky.phase.name}, ${Math.round(sky.phase.illumination * 100)}% lit`}
              />
              <p className="text-center text-[0.72rem] leading-tight text-ink-faint">
                {sky.phase.name}
                <br />
                {Math.round(sky.phase.illumination * 100)}% lit
              </p>
            </div>
          </div>

          <p className="type-body mt-4 max-w-[58ch]">{reading.moonSentence}</p>

          {reading.ingress && (
            <p className="type-meta mt-2">
              The Moon crosses into {reading.ingress.sign.name} at{' '}
              {whenPhrase(reading.ingress.at, today)}, and the mood turns with it.
            </p>
          )}
        </div>
      </Card>

      {/* ── The four dials ── */}

      <Card data-rise>
        <Meters dials={horoscope.dials} />
      </Card>

      {/* ── The doorway back into the app ── */}

      <Card
        data-rise
        level="stage"
        className="border-[var(--rose)] bg-[var(--rose-soft)]"
      >
        <p className="type-label flex items-center gap-1.5 text-[var(--rose-deep)]">
          <SparkIcon aria-hidden="true" className="text-[0.9rem]" />
          Today, strengthen {reading.focus.label.toLowerCase()}
        </p>
        <p className="type-meta mt-1">Because {reading.focusReason}.</p>

        {/*
          The passage, whole.

          Set at a reading size rather than a headline one: this is six or
          seven sentences and the display face at 1.5rem, which was right for a
          single line, turns a paragraph into a poster. The first sentence is
          the library line the reading chose, so the eye still lands on
          something quotable in the first half second.
        */}
        <p className="font-display mt-3 max-w-[54ch] text-[1.12rem] leading-relaxed text-ink">
          &ldquo;{passage.text}&rdquo;
        </p>

        <p className="type-meta mt-2.5">
          {passage.sentences.length} sentences, about {aboutSeconds(passage.seconds)}{' '}
          a pass. {passage.why}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => loop(passage.text, dayTitle)}
            leading={<PlayIcon className="text-[0.85rem]" />}
          >
            Loop this now
          </Button>
          <Button
            size="lg"
            onClick={() => {
              cue('tap')
              updateDraft({ text: passage.text, title: dayTitle })
              navigate('/create')
            }}
          >
            Edit it first
          </Button>
        </div>

        {/*
          The short way out.

          A paragraph is the right default and it is not right for everybody
          on every morning — somebody with four minutes wants one sentence,
          repeated. Both are on the same card, and the short one is written
          from today's sky rather than taken from the library, so choosing it
          is not choosing less of the day.
        */}
        <div className="mt-4 rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
          <p className="type-label">Or one line, written from today&rsquo;s sky</p>
          <p className="font-display mt-1 text-[1.1rem] leading-snug text-ink">
            &ldquo;{horoscope.skyLine}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => loop(horoscope.skyLine, `Sky line · ${reading.day}`)}
            className="interactive mt-1.5 min-h-11 rounded-pill text-[0.86rem] text-ink-muted underline decoration-[var(--border-strong)] underline-offset-4 hover:text-ink"
          >
            Loop the line instead
          </button>
        </div>
      </Card>

      {/* ── The reading, at length ── */}

      <Card data-rise title="What today is made of">
        <div className="space-y-3.5">
          {horoscope.overview.map((paragraph, index) => (
            <p key={index} className="type-body max-w-[62ch]">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            size="sm"
            leading={<CopyIcon className="text-[0.85rem]" />}
            onClick={() => {
              cue('tap')
              void shareText({
                title: `My sky · ${today.toLocaleDateString()}`,
                text: horoscope.shareText,
              }).then((outcome) => {
                if (outcome === 'copied' || outcome === 'shared') {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2400)
                }
              })
            }}
          >
            {copied ? 'Copied' : 'Share today'}
          </Button>
        </div>
      </Card>

      {/* ── Four areas of a life ── */}

      <div data-rise>
        <SectionHeading hint="Body · heart · mind · spirit">
          Where it lands
        </SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          {horoscope.areas.map((area) => (
            <div key={area.key} className={`astro-tint astro-tint--${area.key} p-4`}>
              <p className="type-label text-ink">{area.label}</p>
              <p className="mt-1.5 text-[0.92rem] leading-relaxed text-ink-muted">
                {area.text}
              </p>
              <p className="mt-2.5 flex gap-2 text-[0.9rem] leading-relaxed text-ink">
                <StarIcon
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-[0.8rem] text-[var(--rose-deep)]"
                />
                {area.action}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── The hours ── */}

      <Card
        data-rise
        title="The hours"
        description="The Moon moves half a degree an hour, so the stretches of a day genuinely differ. This is where its contacts to your chart fall."
      >
        <DayArc
          hours={horoscope.hours}
          power={horoscope.power}
          quiet={horoscope.quiet}
        />
      </Card>

      {/* ── The three contacts ── */}

      <div data-rise>
        <SectionHeading hint="Strongest first">Touching your chart</SectionHeading>
        <div className="grid gap-3 md:grid-cols-3">
          {reading.highlights.map((highlight) => (
            <div
              key={`${highlight.transit.from}-${highlight.transit.to}`}
              className="surface-quiet p-4"
            >
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[1.05rem] text-ink">
                  {highlight.title}
                </span>
                <span className="type-meta shrink-0 tabular-nums">
                  {highlight.transit.orb.toFixed(1)}°
                </span>
              </p>
              <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-muted">
                {highlight.body}
              </p>
            </div>
          ))}

          {reading.highlights.length === 0 && (
            <p className="type-meta md:col-span-3">
              Nothing in the sky is within orb of your chart today. That is a
              real answer and not a quiet one — an unclaimed day is the easiest
              kind to spend on your own terms.
            </p>
          )}
        </div>
      </div>

      {/* ── Do, ease off, ask ── */}

      <div data-rise className="grid gap-3 md:grid-cols-3">
        <div className="surface-quiet p-4">
          <p className="type-label text-[var(--sage)]">Do this</p>
          <p className="mt-1.5 text-[0.92rem] leading-relaxed text-ink">
            {horoscope.doThis}
          </p>
        </div>
        <div className="surface-quiet p-4">
          <p className="type-label text-[var(--rose-deep)]">Ease off</p>
          <p className="mt-1.5 text-[0.92rem] leading-relaxed text-ink">
            {horoscope.easeOff}
          </p>
        </div>
        <div className="surface-quiet p-4">
          <p className="type-label text-[var(--gold)]">Sit with</p>
          <p className="mt-1.5 text-[0.92rem] leading-relaxed text-ink">
            {horoscope.ask}
          </p>
        </div>
      </div>

      {/* ── The horizon ── */}

      <Card data-rise level="quiet">
        <p className="type-label flex items-center gap-1.5">
          <MoonIcon aria-hidden="true" className="text-[0.9rem]" />
          Tomorrow, briefly
        </p>
        <p className="type-body mt-1.5 max-w-[62ch]">{horoscope.tomorrow.line}</p>
        {/*
          One line and no further. The whole reading exists for tomorrow as
          well, and printing it a day early would teach people that the
          morning visit is optional.
        */}
        <p className="type-meta mt-2">
          The rest of it is worked out fresh in the morning.
        </p>
      </Card>

      {/* ── The one part that is a shuffle ── */}

      <Card data-rise className="text-center">
        <p className="type-label">Ask the sky</p>
        {card ? (
          <>
            <p aria-hidden="true" className="astro-glyph mt-2 text-[2.4rem] text-ink">
              {card.glyph}
            </p>
            <h3 className="type-heading mt-1">{card.title}</h3>
            <p className="type-body mx-auto mt-2 max-w-[46ch] text-balance">
              {card.message}
            </p>
            <p className="font-display mx-auto mt-3 max-w-[40ch] text-[1.15rem] leading-snug text-balance text-ink">
              {card.question}
            </p>
          </>
        ) : (
          <p className="type-body mx-auto mt-2 max-w-[46ch] text-balance">
            {DECK_SIZE} questions, shuffled. Everything else in here is
            arithmetic; this one is a deck — and being asked something you did
            not choose is a surprisingly good way to get unstuck.
          </p>
        )}

        <Button
          size="md"
          className="mt-4"
          leading={<StarIcon className="text-[0.85rem]" />}
          onClick={() => {
            cue('select')
            setCard((current) => drawCard(current?.title))
          }}
        >
          {card ? 'Draw another' : 'Draw a question'}
        </Button>
      </Card>

      {/* ── The arithmetic, for anybody who wants to check it ── */}

      <div data-rise>
        <Disclosure
          title="How today was worked out"
          summary="The positions this reading is standing on"
        >
          <dl className="astro-rows space-y-2 text-[0.88rem] leading-relaxed">
            {horoscope.workings.map((row) => (
              <div key={row.label} className="flex gap-x-3 pt-2 first:pt-0">
                <dt className="w-28 shrink-0 text-ink-faint sm:w-32">{row.label}</dt>
                <dd className="min-w-0 grow text-ink-muted">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="type-meta mt-3">
            Every one of these can be checked against any ephemeris in the
            world. That is the point of showing them: this reading is
            arithmetic you are allowed to audit, and the only part of the whole
            screen that is a shuffle says so on its own card.
          </p>
        </Disclosure>
      </div>
    </div>
  )
}
