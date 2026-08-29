import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Chart } from '../../lib/astrology/chart'
import { carePlanOf } from '../../lib/astrology/care'
import type { Horoscope } from '../../lib/astrology/horoscope'
import { recordEngagement } from '../../lib/engagement'
import { cue } from '../../lib/feedback'
import { usePreferences } from '../../state/PreferencesProvider'
import { useSession } from '../../state/SessionProvider'
import { Button } from '../Button'
import { Card, SectionHeading } from '../Card'
import { BreathIcon, LeafIcon, MoonIcon, PlayIcon } from '../Icons'

/**
 * The care plan: what to actually do with a body and an evening.
 *
 * ── Why this is the panel that justifies the whole feature ──────────────────
 *
 * Because it is the only one that ends in the app doing something. Everything
 * here is wired: the breath pattern is one this player already knows and the
 * button sets it and starts a session, the ritual is four steps somebody can
 * follow in five minutes, the prompts are three questions with a place to put
 * the answers, and the suggested session has a length and a line attached.
 *
 * A horoscope that ends in a paragraph is entertainment. One that ends in a
 * ten-minute practice, chosen from what is actually overhead, is the thing
 * this app is for — and it is different tomorrow, which is what makes it a
 * habit rather than a feature.
 *
 * ── The line that is not crossed ────────────────────────────────────────────
 *
 * Nothing here diagnoses or treats anything, and the note saying so is on the
 * screen rather than in a footer. The traditional body correspondences are
 * used as attention prompts, which is the only honest thing to do with them.
 */

interface CarePanelProps {
  natal: Chart
  horoscope: Horoscope
}

export function CarePanel({ natal, horoscope }: CarePanelProps) {
  const navigate = useNavigate()
  const { updateDraft, prime, start } = useSession()
  const { preferences, update: updatePreferences } = usePreferences()
  const [applied, setApplied] = useState(false)

  const plan = useMemo(() => carePlanOf(natal, horoscope), [natal, horoscope])

  /**
   * Take the breath the sky suggests, and go and do it.
   *
   * This writes the pattern into preferences rather than into the session,
   * because the breathing guide is app-level: choosing it here should still be
   * chosen tomorrow, exactly as it would be if it had been picked in settings.
   */
  const breatheNow = (withVoice: boolean) => {
    cue('start')
    updatePreferences({
      breathingEnabled: true,
      breathPattern: plan.breath.preset.pattern,
    })
    prime()
    updateDraft({
      text: withVoice ? plan.session.line : '',
      title: withVoice ? plan.session.label : plan.breath.preset.name,
    })
    window.setTimeout(() => {
      start()
      recordEngagement()
      navigate('/player')
    }, 20)
  }

  return (
    <div className="space-y-6">
      {/* ── The body, today ── */}

      <Card data-rise level="stage" className="astro-sky">
        <span aria-hidden="true" className="astro-sky__stars" />
        <div className="astro-sky__content">
          <p className="type-label text-[var(--sage)]">{plan.attention.title}</p>
          <p className="type-body mt-2 max-w-[58ch] text-[1.02rem]">
            {plan.attention.text}
          </p>
          <p className="mt-4 flex gap-2.5 rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-[0.95rem] leading-relaxed text-ink">
            <LeafIcon
              aria-hidden="true"
              className="mt-1 shrink-0 text-[0.9rem] text-[var(--sage)]"
            />
            {plan.attention.action}
          </p>
        </div>
      </Card>

      {/* ── The breath ── */}

      <Card data-rise className="border-[var(--rose)] bg-[var(--rose-soft)]">
        <p className="type-label flex items-center gap-1.5 text-[var(--rose-deep)]">
          <BreathIcon aria-hidden="true" className="text-[0.9rem]" />
          Today&rsquo;s breath
        </p>
        <h3 className="type-heading mt-1">{plan.breath.preset.name}</h3>
        <p className="type-body mt-1.5 max-w-[52ch]">
          {plan.breath.preset.description}
        </p>
        <p className="type-meta mt-2 max-w-[52ch]">{plan.breath.why}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="md"
            leading={<PlayIcon className="text-[0.85rem]" />}
            onClick={() => breatheNow(false)}
          >
            Breathe it now
          </Button>
          <Button
            size="md"
            onClick={() => {
              cue('save')
              updatePreferences({
                breathingEnabled: true,
                breathPattern: plan.breath.preset.pattern,
              })
              setApplied(true)
              window.setTimeout(() => setApplied(false), 2400)
            }}
          >
            {applied ? 'Saved as your pattern' : 'Use this pattern from now on'}
          </Button>
        </div>

        {!preferences.breathingEnabled && (
          <p className="type-meta mt-2">
            Your breathing guide is currently switched off — either button above
            turns it back on.
          </p>
        )}
      </Card>

      {/* ── Five minutes, in order ── */}

      <Card data-rise title={plan.ritual.title}>
        <ol className="space-y-3">
          {plan.ritual.steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="type-numeral flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--quiet)] text-[0.85rem] text-ink-muted">
                {index + 1}
              </span>
              <span className="text-[0.95rem] leading-relaxed text-ink">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-[1.15rem] border border-[var(--border)] bg-[var(--quiet)] p-4">
          <p className="type-label">
            A session for today · about {plan.session.minutes} minutes
          </p>
          <p className="font-display mt-1.5 text-[1.15rem] leading-snug text-ink">
            &ldquo;{plan.session.line}&rdquo;
          </p>
          <Button
            variant="primary"
            size="md"
            className="mt-3"
            leading={<PlayIcon className="text-[0.85rem]" />}
            onClick={() => breatheNow(true)}
          >
            Start it
          </Button>
        </div>
      </Card>

      {/* ── The heart ── */}

      <Card data-rise className="astro-tint astro-tint--heart">
        <p className="type-label text-ink">{plan.emotional.title}</p>
        <p className="type-body mt-2 max-w-[58ch]">{plan.emotional.text}</p>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink">
          {plan.emotional.action}
        </p>
      </Card>

      {/* ── Rest ── */}

      <Card data-rise className="astro-tint astro-tint--spirit">
        <p className="type-label flex items-center gap-1.5 text-ink">
          <MoonIcon aria-hidden="true" className="text-[0.9rem]" />
          {plan.rest.title}
        </p>
        <p className="type-body mt-2 max-w-[58ch]">{plan.rest.text}</p>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink">
          {plan.rest.action}
        </p>
      </Card>

      {/* ── The three small ones ── */}

      <div data-rise>
        <SectionHeading hint="Small, and today">Three things that help</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="surface-quiet p-4">
            <p className="type-label text-[var(--sage)]">Move</p>
            <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-muted">
              {plan.movement}
            </p>
          </div>
          <div className="surface-quiet p-4">
            <p className="type-label text-[var(--gold)]">Eat</p>
            <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-muted">
              {plan.nourish}
            </p>
          </div>
          <div className="surface-quiet p-4">
            <p className="type-label text-[var(--twilight)]">Feel</p>
            <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-muted">
              {plan.sensory}
            </p>
          </div>
        </div>
      </div>

      {/* ── Three questions ── */}

      <Card
        data-rise
        title="Three questions worth answering"
        description="Different tomorrow, because the sky behind them is."
      >
        <ul className="astro-rows space-y-3">
          {plan.prompts.map((prompt) => (
            <li key={prompt} className="pt-3 first:pt-0">
              <p className="font-display text-[1.1rem] leading-snug text-ink">
                {prompt}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── The honest note ── */}

      <p data-rise className="type-meta max-w-[62ch]">
        {plan.note}
      </p>
    </div>
  )
}
