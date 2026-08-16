import { useState } from 'react'
import { BirthDetailsForm } from '../astrology/BirthDetailsForm'
import { declineAstrology, writeAstrology } from '../../lib/astrology/profile'
import { cue } from '../../lib/feedback'
import { Button } from '../Button'
import { MoonIcon, StarIcon } from '../Icons'
import { Reveal, RevealText } from './Reveal'

/**
 * The one optional beat in the first minute.
 *
 * ── Why it is offered here at all ───────────────────────────────────────────
 *
 * Because the people who use an app like this every morning and the people who
 * check where the Moon is every morning are, to a striking degree, the same
 * people — and because a daily practice needs a reason to be opened on the
 * days when practising is the last thing anybody feels like. The chart is that
 * reason. It is different every day, it is about them, and every reading ends
 * by handing back an intent and a line, so a visit that started as curiosity
 * finishes as a session.
 *
 * ── Why it is so easy to refuse ─────────────────────────────────────────────
 *
 * Because a large share of people will want nothing to do with it, and they
 * are not wrong. Astrology is not for everyone, a birth date and time is
 * genuinely sensitive, and an app that nags about either has broken something
 * more valuable than the feature is worth.
 *
 * So "Not for me" sits at the same weight as the form, the refusal is
 * *remembered* rather than asked again next week, and the consequence is
 * complete: the Sky section never appears in the library, nothing else in the
 * app mentions it, and the entire ephemeris stays undownloaded. It remains in
 * Settings for anyone who changes their mind, which is where a declined
 * feature belongs — findable, and silent until it is looked for.
 */

interface SkyStepProps {
  /** Move on, whichever way this was answered. */
  onDone: () => void
}

export function SkyStep({ onDone }: SkyStepProps) {
  const [opened, setOpened] = useState(false)

  return (
    <div>
      <RevealText
        as="h1"
        className="type-title text-center text-balance"
        text="Would you like a chart of your own?"
      />

      <Reveal delay={0.28}>
        <p className="type-body mt-3 text-center text-balance">
          Manifester can work out where every planet was when you were born, and
          then, each morning, what has moved since — ending with one thing to
          strengthen today and a line to say.
        </p>
      </Reveal>

      {!opened ? (
        <>
          <Reveal delay={0.4}>
            <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
              <ul className="space-y-2.5 text-[0.9rem] leading-relaxed text-ink-muted">
                <li className="flex items-start gap-2.5">
                  <MoonIcon
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-[0.9rem] text-[var(--rose-deep)]"
                  />
                  Real positions, from real orbital mechanics — not twelve
                  paragraphs written a month ago.
                </li>
                <li className="flex items-start gap-2.5">
                  <StarIcon
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-[0.9rem] text-[var(--rose-deep)]"
                  />
                  Worked out on this device. Your birth details are never sent
                  anywhere, and there is no account attached to them.
                </li>
              </ul>
              <p className="type-meta mt-3">
                It lives in your library, after the sounds. It will not appear
                anywhere else.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.55} distance={10}>
            <Button
              variant="primary"
              size="xl"
              block
              className="mt-5"
              onClick={() => {
                cue('tap')
                setOpened(true)
              }}
            >
              Yes, set it up
            </Button>

            <button
              type="button"
              onClick={() => {
                cue('tap')
                // Remembered, so this is asked once in a lifetime rather than
                // on every update that touches onboarding.
                declineAstrology()
                onDone()
              }}
              className="interactive mx-auto mt-3 block min-h-11 rounded-pill px-3 text-[0.9rem] text-ink-faint hover:text-ink"
            >
              Not for me
            </button>
          </Reveal>
        </>
      ) : (
        <Reveal delay={0.1}>
          <div className="mt-5">
            <BirthDetailsForm
              saveLabel="Save and carry on"
              onSave={(birth) => {
                writeAstrology(birth)
                onDone()
              }}
              secondary={
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    cue('tap')
                    setOpened(false)
                  }}
                >
                  Back
                </Button>
              }
            />
          </div>
        </Reveal>
      )}
    </div>
  )
}
