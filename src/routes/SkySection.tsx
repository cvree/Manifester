import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BirthDetailsForm } from '../components/astrology/BirthDetailsForm'
import { ChartWheel } from '../components/astrology/ChartWheel'
import { Button } from '../components/Button'
import { Card, SectionHeading } from '../components/Card'
import { Disclosure } from '../components/Disclosure'
import { PlayIcon, SparkIcon } from '../components/Icons'
import { placementOf } from '../lib/astrology/chart'
import {
  declineAstrology,
  forgetAstrology,
  writeAstrology,
} from '../lib/astrology/profile'
import { BODY_PROFILES, formatPosition } from '../lib/astrology/signs'
import { useSky } from '../lib/astrology/useSky'
import { cue } from '../lib/feedback'
import { recordEngagement } from '../lib/engagement'
import { useSession } from '../state/SessionProvider'

/**
 * The Sky, in the library, after the sounds.
 *
 * ── Why it lives here and not on the front page ─────────────────────────────
 *
 * Because Manifester is not an astrology app and must not start behaving like
 * one. The Create screen is for writing a line, the Player is for listening to
 * it, and putting a horoscope on either would be a different product wearing
 * this one's clothes. The library is where the app keeps the things that are
 * *yours* — your loops, your sounds — and a birth chart is exactly that.
 *
 * ── Why anybody would come back for it ──────────────────────────────────────
 *
 * A daily practice needs a reason to be opened on the days you do not feel
 * like practising, and "there is something new here that is about me" is the
 * oldest working answer there is. This section is genuinely different every
 * day, visibly different every two or three when the Moon changes sign, and it
 * always ends in the same place: an intent and a line, with a button that
 * starts the loop.
 *
 * That last part is what stops it being a novelty. The reading is not the
 * destination — it is a doorway back into the thing the app is for, and on the
 * days somebody opens the app only to see what the sky is doing, they leave
 * having done a session.
 */

export function SkySection() {
  const sky = useSky()
  const navigate = useNavigate()
  const { updateDraft, prime, start } = useSession()
  const [editing, setEditing] = useState(false)

  /* ── Nobody has given their details yet ── */

  if (sky.state.status !== 'ready' || editing) {
    return (
      <div data-rise className="space-y-4">
        <SectionHeading>Your sky</SectionHeading>

        <Card>
          {!editing && (
            <>
              <h3 className="type-heading">A chart of your own</h3>
              <p className="type-body mt-2 max-w-[52ch]">
                Give a birth date, a time and a city and Manifester will work
                out where every planet actually was — and then, every morning,
                where they are now and what has moved since. It ends with one
                thing to strengthen today and a line to say.
              </p>
              <p className="type-meta mt-2">
                Worked out on this device from real orbital mechanics. Nothing
                is sent anywhere, and there is no account attached to it.
              </p>
            </>
          )}

          <div className="mt-4">
            <BirthDetailsForm
              initial={
                sky.state.status === 'ready' ? sky.state.profile.birth : null
              }
              saveLabel={editing ? 'Save changes' : 'Show me my chart'}
              onSave={(birth) => {
                writeAstrology(birth)
                setEditing(false)
                sky.refresh()
              }}
              secondary={
                editing ? (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      cue('tap')
                      setEditing(false)
                    }}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      cue('tap')
                      declineAstrology()
                      sky.refresh()
                    }}
                  >
                    Not for me
                  </Button>
                )
              }
            />
          </div>
        </Card>
      </div>
    )
  }

  if (sky.loading || !sky.reading || !sky.natal || !sky.now) {
    return (
      <div data-rise>
        <SectionHeading>Your sky</SectionHeading>
        <p className="type-meta" role="status">
          Working out where everything is…
        </p>
      </div>
    )
  }

  const { reading, natal, now } = sky
  const place = sky.state.profile.birth.place

  const playToday = () => {
    cue('start')
    prime()
    updateDraft({
      text: reading.affirmation,
      title: `${reading.focus.label} · ${new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })}`,
    })
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
      <div data-rise>
        <SectionHeading
          hint={new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        >
          Your sky
        </SectionHeading>
      </div>

      {/* ── Today ── */}

      <Card data-rise>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="type-label text-[var(--rose-deep)]">
            {reading.weatherWord} day
          </p>
          {reading.ingress && (
            <p className="type-meta">
              Moon into {reading.ingress.sign.name} at{' '}
              {reading.ingress.at.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        <h3 className="type-heading mt-1 text-balance">{reading.headline}</h3>

        <p className="type-body mt-3 max-w-[58ch]">{reading.moonSentence}</p>
        <p className="type-body mt-2 max-w-[58ch]">{reading.weather}</p>
      </Card>

      {/* ── The three contacts ── */}

      <div data-rise className="grid gap-3 md:grid-cols-3">
        {reading.highlights.map((highlight) => (
          <div
            key={`${highlight.transit.from}-${highlight.transit.to}`}
            className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-sunken)] p-4"
          >
            <p className="flex items-baseline gap-2">
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
            Nothing in the sky is within orb of your chart today. That is a real
            answer and not a quiet one — an unclaimed day is the easiest kind to
            spend on your own terms.
          </p>
        )}
      </div>

      {/* ── The doorway back into the app ── */}

      <Card data-rise className="border-[var(--rose)] bg-[var(--rose-soft)]">
        <p className="type-label flex items-center gap-1.5 text-[var(--rose-deep)]">
          <SparkIcon aria-hidden="true" className="text-[0.9rem]" />
          Today, strengthen {reading.focus.label.toLowerCase()}
        </p>
        <p className="type-meta mt-1">Because {reading.focusReason}.</p>

        <p className="font-display mt-3 text-[1.4rem] leading-snug text-ink text-balance">
          &ldquo;{reading.affirmation}&rdquo;
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={playToday}
            leading={<PlayIcon className="text-[0.85rem]" />}
          >
            Loop this now
          </Button>
          <Button
            size="md"
            onClick={() => {
              cue('tap')
              updateDraft({ text: reading.affirmation })
              navigate('/create')
            }}
          >
            Edit it first
          </Button>
        </div>
      </Card>

      {/* ── The wheel ── */}

      <Card data-rise>
        <SectionHeading hint={`As seen from ${place.name}`}>
          Chart of the moment
        </SectionHeading>
        <p className="type-body -mt-2 mb-4 max-w-[52ch]">
          Your birth chart on the inside, the sky as it is right now riding on
          the outside. The lines across the middle are the aspects between your
          own planets — green where they run easily, rose where they push.
        </p>

        <ChartWheel
          chart={natal}
          overlay={now}
          title={`Your birth chart with today's planets around it. ${reading.headline}.`}
        />

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {sky.vitals.map((vital) => (
            <div
              key={vital.label}
              className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface-sunken)] px-3.5 py-2.5"
            >
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

        <Disclosure className="mt-4" title="Every position, in full">
          <ul className="space-y-1.5">
            {natal.placements.map((placement) => (
              <li
                key={placement.body}
                className="flex items-baseline justify-between gap-3 text-[0.9rem]"
              >
                <span className="text-ink">
                  <span aria-hidden="true" className="mr-2 text-ink-faint">
                    {BODY_PROFILES[placement.body].symbol}
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

            {natal.ascendant != null && (
              <>
                <li className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-1.5 text-[0.9rem]">
                  <span className="text-ink">Ascendant</span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatPosition(natal.ascendant)}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-3 text-[0.9rem]">
                  <span className="text-ink">Midheaven</span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatPosition(natal.midheaven!)}
                  </span>
                </li>
              </>
            )}
          </ul>

          <p className="type-meta mt-3">
            Whole-sign houses. Positions are ecliptic longitude of date,
            computed here from the standard solar and lunar theories and the
            JPL orbital elements — the same arithmetic an ephemeris uses,
            running on your phone.
          </p>
        </Disclosure>
      </Card>

      {/* ── Where the sky is right now, on its own ── */}

      <Card data-rise>
        <SectionHeading>Where everything is now</SectionHeading>
        <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {now.placements.map((placement) => (
            <li
              key={placement.body}
              className="flex items-baseline justify-between gap-3 text-[0.9rem]"
            >
              <span className="text-ink">
                <span aria-hidden="true" className="mr-2 text-ink-faint">
                  {BODY_PROFILES[placement.body].symbol}
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
          The Moon is at {formatPosition(placementOf(now, 'moon').longitude)},{' '}
          {Math.round(now.phase.illumination * 100)}% lit and{' '}
          {now.phase.waxing ? 'filling' : 'emptying'}.
        </p>
      </Card>

      {/* ── Housekeeping ── */}

      <div data-rise>
        <Disclosure title="Birth details">
          <p className="type-body">
            {new Date(`${sky.state.profile.birth.date}T12:00:00`).toLocaleDateString(
              undefined,
              { day: 'numeric', month: 'long', year: 'numeric' },
            )}
            {sky.state.profile.birth.time
              ? ` at ${sky.state.profile.birth.time}`
              : ' · time unknown'}
            {' · '}
            {place.name}, {place.country}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                cue('tap')
                setEditing(true)
              }}
            >
              Change them
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                cue('tap')
                forgetAstrology()
                sky.refresh()
              }}
            >
              Remove from this device
            </Button>
          </div>
        </Disclosure>
      </div>
    </div>
  )
}
