import { useEffect, useRef, useState } from 'react'
import { STUDIO_PREVIEWS } from '../../lib/affirmations'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { VOICE_PROFILES, voiceForStyle } from '../../lib/tts'
import { useTTSStatus } from '../../lib/tts/useTTSStatus'
import { Button } from '../Button'
import { CheckIcon, PlayIcon, WaveIcon } from '../Icons'
import { StudioVoicePanel } from '../StudioVoicePanel'
import { useAudition } from './useAudition'

/**
 * Ivy or Fen, and then the offer.
 *
 * Two cards, and tapping one both selects it *and* speaks — the same gesture
 * as the previous step, because comparing two voices means hearing them one
 * after the other and any extra button between the tap and the sound is a
 * button somebody presses twice.
 *
 * The preview line is chosen rather than random and it rotates on each play.
 * Every one of them has a comma or a full stop in the middle, because what
 * separates this from a phone's built-in synthesiser is not the timbre — it is
 * that Kokoro *breathes* at punctuation. A phrase with no pause in it throws
 * away the entire demonstration.
 *
 * The Studio Voice offer sits underneath, after they have heard what it sounds
 * like, and never before. Selling somebody a ninety-megabyte download for a
 * voice they have not heard is asking them to take it on faith; letting them
 * hear it first is the same offer, honestly made.
 */

interface VoiceStepProps {
  style: 'feminine' | 'masculine'
  onStyleChange: (style: 'feminine' | 'masculine') => void
  onBegin: () => void
  beginning: boolean
}

export function VoiceStep({
  style,
  onStyleChange,
  onBegin,
  beginning,
}: VoiceStepProps) {
  const audition = useAudition()
  const status = useTTSStatus()
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [declined, setDeclined] = useState(false)
  /** False until the first press, so the first press does not skip a line. */
  const heardOnce = useRef(false)
  const { warm } = audition

  const at = (index: number) =>
    STUDIO_PREVIEWS[index % STUDIO_PREVIEWS.length].text
  const phrase = at(phraseIndex)

  /*
   * Both voices, and the line after this one.
   *
   * The next line is warmed now rather than when it becomes current, because
   * "when it becomes current" is the same instant somebody is waiting to hear
   * it — a preload that starts then has arrived too late to have been one.
   */
  useEffect(() => {
    warm([phrase, at(phraseIndex + 1)], 'feminine')
    warm([phrase, at(phraseIndex + 1)], 'masculine')
  }, [phrase, phraseIndex, warm])

  const hear = (next: 'feminine' | 'masculine') => {
    /*
     * Advance *before* speaking rather than after.
     *
     * Rotating afterwards was the obvious way round and it was wrong: the
     * index changed while the clip was still playing, so the caption named a
     * sentence nobody was hearing and the card never said "Listening" —
     * `speaking` held the old line while the render compared against the new
     * one. Moving on at the start of a press keeps what is on screen and what
     * is in the speakers the same thing.
     */
    const index = heardOnce.current ? phraseIndex + 1 : phraseIndex
    heardOnce.current = true
    setPhraseIndex(index)

    cue('select')
    onStyleChange(next)
    audition.play(at(index), next)
  }

  return (
    <div>
      <h1 className="type-display text-center text-balance">Who should read it?</h1>
      <p className="type-body mt-3 text-center text-balance">
        Tap to hear each one. Both are Manifester&rsquo;s own voices.
      </p>

      <div role="radiogroup" aria-label="Voice" className="mt-7 grid grid-cols-2 gap-3">
        {(['feminine', 'masculine'] as const).map((option) => {
          const profile = VOICE_PROFILES[voiceForStyle(option)]
          const selected = style === option
          const speaking = audition.speaking === phrase && selected
          const preparing = audition.loading === phrase && selected

          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => hear(option)}
              className={cx(
                'interactive pressable flex min-h-[9.5rem] flex-col items-start gap-1.5 rounded-[1.25rem] border p-4 text-left',
                'transition-[background-color,border-color,box-shadow] duration-300 ease-[var(--ease-calm)]',
                selected
                  ? 'border-[var(--rose)] bg-[var(--rose-soft)] shadow-[0_10px_30px_-16px_var(--glow)]'
                  : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex h-9 w-9 items-center justify-center rounded-full text-[0.85rem]',
                  selected
                    ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                    : 'bg-[var(--quiet)] text-ink-faint',
                )}
              >
                {speaking ? <WaveIcon /> : selected ? <CheckIcon /> : <PlayIcon />}
              </span>
              <span className="font-display text-[1.3rem] leading-tight text-ink">
                {profile.label}
              </span>
              <span className="text-[0.84rem] leading-snug text-ink-muted">
                {profile.description}
              </span>
              <span className="type-meta mt-auto" role={preparing ? 'status' : undefined}>
                {preparing
                  ? 'Preparing…'
                  : speaking
                    ? 'Listening'
                    : option === 'feminine'
                      ? 'Feminine'
                      : 'Masculine'}
              </span>
            </button>
          )
        })}
      </div>

      <p className="type-meta mt-3 text-center" aria-live="polite">
        “{phrase}”
      </p>

      {/*
        The offer, and only for somebody who does not already have it. A person
        whose device is already speaking every line in the studio voice is
        shown that fact instead of an advertisement for it.

        "Maybe later" genuinely puts it away rather than scrolling it out of
        sight: the offer collapses to one line, the same offer stays in the
        Voice settings for ever, and nothing about the session that follows is
        any different. An invitation that cannot be declined is a demand.
      */}
      {declined && !status.unlimited ? (
        <p className="type-meta mt-6 text-center">
          Studio Voice is under Voice in settings whenever you want it.
        </p>
      ) : (
        <StudioVoicePanel
          className="mt-6"
          variant={status.unlimited ? 'inline' : 'card'}
          onDismiss={() => setDeclined(true)}
        />
      )}

      <Button
        variant="primary"
        size="xl"
        block
        className="mt-6"
        loading={beginning}
        onClick={() => {
          cue('start')
          audition.stop()
          onBegin()
        }}
      >
        {beginning ? 'Beginning…' : 'Begin my first session'}
      </Button>

      <p className="type-meta mt-3 text-center">
        Ten minutes, looping gently. Stop whenever you like.
      </p>
    </div>
  )
}
