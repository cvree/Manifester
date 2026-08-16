import { useEffect, useState } from 'react'
import type { Focus } from '../../lib/affirmations'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { Button } from '../Button'
import { CheckIcon, PencilIcon, PlayIcon, WaveIcon } from '../Icons'
import { TextArea } from '../TextArea'
import { useAudition } from './useAudition'

/**
 * The moment this whole screen exists for: the first line, out loud.
 *
 * Six suggestions for whatever they chose, and tapping one *plays it*. Not
 * selects it and offers a Preview button — plays it, immediately, in the same
 * gesture. Everything on this step is arranged around making that first sound
 * arrive within a few hundred milliseconds:
 *
 *  - Every line here is pre-generated in both voices, so the common case is a
 *    small file fetch and a decode rather than any synthesis at all.
 *  - The other five are warmed the moment the step appears, so the second and
 *    third taps have nothing left to do.
 *  - Tapping a line that is already playing stops it, so somebody comparing
 *    three of them never ends up with two speaking at once.
 *
 * Editing is one tap away rather than in the way. Most people will take a
 * suggestion; the ones who want their own words should not have to scroll past
 * an empty textarea to find out that suggestions existed.
 */

interface AffirmationStepProps {
  focus: Focus
  style: 'feminine' | 'masculine'
  value: string
  onChange: (text: string) => void
  onContinue: () => void
}

export function AffirmationStep({
  focus,
  style,
  value,
  onChange,
  onContinue,
}: AffirmationStepProps) {
  const audition = useAudition()
  const [editing, setEditing] = useState(false)
  const { warm } = audition

  // Fetch what they are most likely to tap next, while they are still reading.
  useEffect(() => {
    warm(focus.lines, style)
  }, [focus, style, warm])

  const custom = value.trim().length > 0 && !focus.lines.includes(value.trim())

  const pick = (line: string) => {
    if (audition.speaking === line || audition.loading === line) {
      audition.stop()
      return
    }
    cue('select')
    onChange(line)
    audition.play(line, style)
  }

  return (
    <div>
      <h1 className="type-display text-center text-balance">
        Choose your first line
      </h1>
      <p className="type-body mt-3 text-center text-balance">
        Tap one to hear it. This is the voice that will read it back to you.
      </p>

      <ul className="mt-7 space-y-2">
        {focus.lines.map((line) => {
          const selected = value.trim() === line
          const playing = audition.speaking === line
          const preparing = audition.loading === line
          return (
            <li key={line}>
              <button
                type="button"
                onClick={() => pick(line)}
                aria-pressed={selected}
                className={cx(
                  'interactive pressable flex w-full items-center gap-3 rounded-[1.15rem] border px-4 py-3.5 text-left',
                  'transition-[background-color,border-color] duration-300 ease-[var(--ease-calm)]',
                  selected
                    ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                    : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.8rem] transition-colors duration-300',
                    playing || preparing
                      ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                      : selected
                        ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                        : 'bg-[var(--quiet)] text-ink-faint',
                  )}
                >
                  {playing ? (
                    <WaveIcon />
                  ) : selected ? (
                    <CheckIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </span>
                <span className="grow text-[1rem] leading-snug text-ink">{line}</span>
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

      {editing ? (
        <div className="mt-4">
          <TextArea
            // Mounted by the tap that asked for it, so the caret lands where
            // somebody just said they wanted to type.
            autoFocus
            minRows={3}
            value={value}
            aria-label="Your affirmation"
            placeholder="Write it in your own words…"
            onChange={(event) => onChange(event.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                cue('tap')
                audition.play(value, style)
              }}
              disabled={!value.trim()}
              leading={<PlayIcon className="text-[0.85rem]" />}
            >
              {audition.loading ? 'Preparing your voice…' : 'Hear it'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Done
            </Button>
          </div>
          <p className="type-meta mt-2">
            Your own words are read on this device too. Nothing you write is
            sent anywhere.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            cue('tap')
            setEditing(true)
          }}
          className="interactive mt-3 inline-flex min-h-11 items-center gap-2 rounded-pill px-3 text-[0.9rem] text-ink-muted hover:text-ink"
        >
          <PencilIcon className="text-[0.85rem]" />
          {custom ? 'Edit your words' : 'Write my own instead'}
        </button>
      )}

      <Button
        variant="primary"
        size="xl"
        block
        className="mt-6"
        disabled={!value.trim()}
        onClick={() => {
          cue('tap')
          audition.stop()
          onContinue()
        }}
      >
        Continue
      </Button>
    </div>
  )
}
