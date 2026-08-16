import { useEffect, useMemo, useState } from 'react'
import {
  blendStarters,
  recommendedFor,
  type Focus,
} from '../../lib/affirmations'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { VOICE_PROFILES, voiceForStyle } from '../../lib/tts'
import { useTTSStatus } from '../../lib/tts/useTTSStatus'
import { improveWords } from '../../lib/wordcraft'
import { Button } from '../Button'
import { CheckIcon, PencilIcon, PlayIcon, SparkIcon, WaveIcon } from '../Icons'
import { SegmentedControl } from '../SegmentedControl'
import { TextArea } from '../TextArea'
import { Reveal, RevealText } from './Reveal'
import type { Audition } from './useAudition'

/**
 * The moment this whole experience exists for: their line, out loud.
 *
 * Everything on this step is arranged around the second between a tap and a
 * voice. Four starters — blended from every intent they chose, best of each
 * first — one of them elevated as the recommendation and pre-selected so the
 * next step is always one press away, and tapping any of them *speaks it*, in
 * the same gesture, with no Preview button in between. All four are warmed the
 * moment the step appears, so the common case is a decode rather than a
 * request.
 *
 * ── The voice moment ────────────────────────────────────────────────────────
 *
 * Ivy and Fen are compared **through the person's own affirmation** rather
 * than through a sample sentence, and that is the entire design of this
 * control. "This is how your words will sound" demonstrates a voice; hearing
 * *I can handle what is in front of me* in two voices demonstrates a decision
 * somebody actually has to make. Switching speaks immediately in the new
 * voice, and the other voice's version of the selected line is warmed in the
 * background so the switch is instant rather than a second wait.
 *
 * ── Personalising ───────────────────────────────────────────────────────────
 *
 * One tap, in place, on the same screen — *once the question of who reads it
 * has an answer*. Writing your own words is the one thing on this screen the
 * shelf of pre-recorded clips cannot cover, so it is also the one thing that
 * used to change what the app sounded like without saying so. `OwnWordsGate`
 * is where that is asked now; this step only knows whether it has been.
 *
 * Beyond that it is a textarea, a Hear it, and one press of the writing helper
 * the app already has, which runs offline and rewrites their line into the
 * present tense without sending it anywhere.
 */

interface VoiceMomentStepProps {
  /** In the order they were chosen. The first one leads. */
  focuses: Focus[]
  value: string
  style: 'feminine' | 'masculine'
  audition: Audition
  /** True while the textarea is open rather than the suggestion list. */
  writing: boolean
  /**
   * Ask to write their own. The route decides whether that means opening the
   * textarea or asking the voice question first.
   */
  onWriteOwn: () => void
  onShowSuggestions: () => void
  onChange: (text: string) => void
  onStyleChange: (style: 'feminine' | 'masculine') => void
  onContinue: () => void
}

export function VoiceMomentStep({
  focuses,
  value,
  style,
  audition,
  writing,
  onWriteOwn,
  onShowSuggestions,
  onChange,
  onStyleChange,
  onContinue,
}: VoiceMomentStepProps) {
  // Memoised because it is an effect dependency: a fresh array on every render
  // would re-warm four clips every time somebody typed a character.
  const starters = useMemo(() => blendStarters(focuses), [focuses])
  const recommended = focuses.length > 0 ? recommendedFor(focuses[0]) : starters[0]
  const [note, setNote] = useState<string | null>(null)
  const status = useTTSStatus()
  const { warm, play } = audition

  /*
   * Everything they might tap next, in the voice they are in. The other voice
   * is warmed for the *selected* line only — warming eight clips to save a
   * wait on at most one of them is somebody's data allowance.
   */
  useEffect(() => {
    warm(starters, style)
  }, [starters, style, warm])

  useEffect(() => {
    const line = value.trim()
    if (!line) return
    warm([line], style === 'feminine' ? 'masculine' : 'feminine')
  }, [value, style, warm])

  const speak = (line: string, voice: 'feminine' | 'masculine' = style) => {
    const trimmed = line.trim()
    if (!trimmed) return
    play(trimmed, voice)
  }

  const pick = (line: string) => {
    // A second tap on the line that is speaking stops it. Somebody comparing
    // three of them must never end up with two talking at once.
    if (audition.speaking === line || audition.loading === line) {
      audition.stop()
      return
    }
    cue('select')
    onChange(line)
    speak(line)
  }

  const switchVoice = (next: 'feminine' | 'masculine') => {
    if (next === style) return
    cue('select')
    onStyleChange(next)
    // The point of the switch is hearing the difference, so it speaks. This is
    // the one place in the app where changing a setting makes a sound on
    // purpose.
    speak(value, next)
  }

  const reword = () => {
    const result = improveWords(value)
    cue(result.changed ? 'save' : 'tap')
    if (result.changed) onChange(result.text)
    setNote(
      result.changed
        ? 'Reworded on this device. Tap Hear it, or edit it yourself.'
        : 'That already reads the way it should. Edit it yourself if you like.',
    )
  }

  const ready = value.trim().length > 0

  return (
    <div>
      <RevealText
        as="h1"
        className="type-title text-center text-balance"
        text={writing ? 'Say it in your own words' : 'Tap a line to hear it'}
      />

      <Reveal delay={0.3}>
        {writing ? (
          <div className="mt-6">
            <TextArea
              autoFocus
              minRows={3}
              value={value}
              aria-label="Your affirmation"
              placeholder="I can handle what is in front of me."
              onChange={(event) => {
                setNote(null)
                onChange(event.target.value)
              }}
            />
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={!ready}
                onClick={() => {
                  cue('tap')
                  speak(value)
                }}
                leading={<PlayIcon className="text-[0.85rem]" />}
              >
                {audition.loading ? 'Preparing your voice…' : 'Hear it'}
              </Button>
              <Button
                size="sm"
                disabled={!ready}
                onClick={reword}
                leading={<SparkIcon className="text-[0.9rem]" />}
              >
                Reword it for me
              </Button>
              {starters.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    cue('tap')
                    setNote(null)
                    onShowSuggestions()
                  }}
                >
                  Show suggestions
                </Button>
              )}
            </div>
            <p className="type-meta mt-2.5" aria-live="polite">
              {note ??
                (status.unlimited
                  ? 'Written here, read here, in the voice you chose. Nothing you type leaves this device.'
                  : // Said once more, at the moment it becomes true, because
                    // this is the sentence the gate was protecting.
                    'Written here, read here by this device’s own voice. Nothing you type leaves this device.')}
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-1.5 [@media(max-height:720px)]:mt-3">
            {starters.map((line) => {
              const selected = value.trim() === line
              const isRecommended = line === recommended
              const playing = audition.speaking === line
              const preparing = audition.loading === line
              return (
                <li key={line}>
                  <button
                    type="button"
                    onClick={() => pick(line)}
                    aria-pressed={selected}
                    className={cx(
                      'interactive pressable relative flex w-full items-center gap-3 rounded-[1.15rem] border px-3.5 py-3 text-left [@media(max-height:720px)]:py-2.5',
                      'transition-[background-color,border-color,box-shadow] duration-300 ease-[var(--ease-calm)]',
                      selected
                        ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                        : isRecommended
                          ? // Elevated, never forced: a warmer surface and a
                            // quiet label, and every other line is one tap away.
                            'border-[var(--border-strong)] bg-[var(--surface-strong)] shadow-[0_8px_24px_-18px_var(--glow)] hover:border-[var(--rose)]'
                          : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.8rem] transition-colors duration-300',
                        playing || preparing || selected
                          ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                          : 'bg-[var(--quiet)] text-ink-faint',
                      )}
                    >
                      {playing ? <WaveIcon /> : selected ? <CheckIcon /> : <PlayIcon />}
                    </span>
                    <span className="grow">
                      <span className="block text-[0.96rem] leading-snug text-ink">
                        {line}
                      </span>
                      {/*
                        Shown whether or not it is selected. It arrives
                        pre-selected, so hiding the label on selection would
                        mean the recommendation is never actually legible as
                        one — the elevation would read as "this happens to be
                        first" rather than "we think this is the one".
                      */}
                      {isRecommended && (
                        <span className="type-label mt-0.5 block text-[0.62rem] text-ink-faint">
                          Recommended
                        </span>
                      )}
                    </span>
                    {preparing && (
                      <span className="type-meta shrink-0" role="status">
                        Preparing…
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Reveal>

      <Reveal delay={0.5} distance={10}>
        {/*
          The voice moment. Under the words rather than above them, because it
          is a question about the line you have just chosen — and it speaks
          when you change it, which is the only way to answer that question.
        */}
        <div className="mt-4 flex items-center gap-2.5 [@media(max-height:720px)]:mt-3">
          <span className="type-label shrink-0">Read by</span>
          <SegmentedControl
            className="grow"
            label="Which voice reads your affirmation"
            value={style}
            onChange={switchVoice}
            segments={[
              {
                value: 'feminine',
                label: VOICE_PROFILES[voiceForStyle('feminine')].label,
                ariaLabel: `${VOICE_PROFILES[voiceForStyle('feminine')].label}, feminine`,
              },
              {
                value: 'masculine',
                label: VOICE_PROFILES[voiceForStyle('masculine')].label,
                ariaLabel: `${VOICE_PROFILES[voiceForStyle('masculine')].label}, masculine`,
              },
            ]}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          {!writing ? (
            <button
              type="button"
              onClick={() => {
                cue('tap')
                onWriteOwn()
              }}
              className="interactive -ml-2 inline-flex min-h-11 items-center gap-2 rounded-pill px-2 text-[0.88rem] text-ink-muted hover:text-ink"
            >
              <PencilIcon className="text-[0.85rem]" />
              Write my own
            </button>
          ) : (
            <span />
          )}
        </div>

        <Button
          variant="primary"
          size="xl"
          block
          className="mt-1"
          disabled={!ready}
          onClick={() => {
            cue('tap')
            audition.stop()
            onContinue()
          }}
        >
          Continue
        </Button>
      </Reveal>
    </div>
  )
}
