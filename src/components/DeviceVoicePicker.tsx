import { useMemo, useState } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import type { RankedVoice } from '../lib/voiceRanking'
import { Button } from './Button'
import { CheckIcon, PlayIcon } from './Icons'

/**
 * Choosing which of this device's own voices reads the words.
 *
 * This exists because of a specific dishonesty the app used to commit. When
 * Studio Voice was unavailable — declined, failed, or never offered — anything
 * somebody typed themselves was quietly handed to `speechSynthesis`, and the
 * screen carried on saying "Ivy". The person heard a voice that was not the
 * one named anywhere in the interface and had no way to find out why, let
 * alone to do anything about it.
 *
 * So when the studio voice is not going to be the answer, the app asks the
 * question out loud instead: *these are the voices this device has, this is
 * how good each one is, which would you like?* A device with a modern neural
 * voice installed is genuinely pleasant, and somebody who picks it themselves
 * knows exactly what they are listening to.
 *
 * The tiers are the ranking module's, shown rather than hidden. "Basic —
 * robotic, worth avoiding" is not a nice thing to put next to somebody's only
 * option, and it is still the right thing to put there: it is true, it
 * explains what they are hearing, and it is the reason the panel underneath it
 * offers to show them how to install a better one.
 */

interface DeviceVoicePickerProps {
  voices: RankedVoice[]
  voicesReady: boolean
  /** The `voiceURI` currently chosen, if any. */
  selected: string | null
  onSelect: (voice: RankedVoice) => void
  /** Speaks a line in the voice, so the choice can be heard before it is made. */
  onPreview?: (voice: RankedVoice) => void
  /** Which end of the list to lead with. */
  style: 'feminine' | 'masculine'
  className?: string
}

/** How many to show before "Show every voice". */
const SHORTLIST = 4

const TIER_TONE: Record<RankedVoice['tier'], string> = {
  neural: 'text-[var(--sage)]',
  enhanced: 'text-[var(--sage)]',
  standard: 'text-ink-faint',
  basic: 'text-[var(--rose-deep)]',
}

export function DeviceVoicePicker({
  voices,
  voicesReady,
  selected,
  onSelect,
  onPreview,
  style,
  className,
}: DeviceVoicePickerProps) {
  const [all, setAll] = useState(false)

  /*
   * The ones that match the style they chose first, then everything else.
   *
   * Not filtered to the style: a device may have exactly one good voice and it
   * may be the other one, and hiding it to keep a category tidy would be
   * choosing consistency over the person actually enjoying the next twenty
   * minutes.
   */
  const ordered = useMemo(() => {
    const matching = voices.filter((voice) => voice.style === style)
    const rest = voices.filter((voice) => voice.style !== style)
    return [...matching, ...rest]
  }, [voices, style])

  const shown = all ? ordered : ordered.slice(0, SHORTLIST)

  if (!voicesReady) {
    return (
      <p className={cx('type-meta', className)} role="status">
        Looking at what this device can say…
      </p>
    )
  }

  if (ordered.length === 0) {
    return (
      <p className={cx('type-meta', className)}>
        This device does not expose any speech voices to the browser. The
        ready-made lines still play in Ivy and Fen — only your own words need a
        voice this app can reach.
      </p>
    )
  }

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {shown.map((voice) => {
          const chosen = voice.voiceURI === selected
          return (
            <li key={voice.voiceURI}>
              <div
                className={cx(
                  'flex items-center gap-2 rounded-[1.15rem] border px-3 py-2.5 transition-colors duration-300',
                  chosen
                    ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                    : 'border-[var(--border)] bg-[var(--surface-sunken)]',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    cue('select')
                    onSelect(voice)
                  }}
                  aria-pressed={chosen}
                  className="interactive flex min-w-0 grow items-center gap-2.5 rounded-[0.9rem] text-left"
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.8rem]',
                      chosen
                        ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                        : 'bg-[var(--quiet)] text-ink-faint',
                    )}
                  >
                    {chosen ? <CheckIcon /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.94rem] text-ink">
                      {voice.name}
                    </span>
                    <span
                      className={cx(
                        'block truncate text-[0.76rem]',
                        TIER_TONE[voice.tier],
                      )}
                    >
                      {voice.tierLabel}
                    </span>
                  </span>
                </button>

                {onPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      cue('tap')
                      onPreview(voice)
                    }}
                    aria-label={`Hear ${voice.name}`}
                    className="interactive flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[0.8rem] text-ink-muted hover:text-ink"
                  >
                    <PlayIcon />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {ordered.length > SHORTLIST && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 -ml-2"
          onClick={() => {
            cue('tap')
            setAll((open) => !open)
          }}
        >
          {all ? 'Show fewer' : `Show every voice · ${ordered.length}`}
        </Button>
      )}
    </div>
  )
}
