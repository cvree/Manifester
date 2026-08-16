import { useEffect, useMemo, useState } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { auditionDeviceVoice, stopDeviceAudition } from '../lib/speech'
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
 * ── It speaks when you touch it ─────────────────────────────────────────────
 *
 * Every voice in this list speaks the moment it is chosen, in the voice
 * itself, saying what it is for: *this is how your own words will sound*. That
 * is not a flourish, it is the entire point of the control. A list of
 * operating-system voice names — "Microsoft David", "Microsoft Mark" — is
 * unreadable to anybody who has not already heard them, so a picker that stays
 * silent until a separate Play button is found is asking people to choose
 * between three strings. Choosing by ear takes a second and the answer is
 * theirs.
 *
 * It also changes what the labels should say. The tier used to read "Basic —
 * robotic, worth avoiding", which is true, and which on a machine where every
 * voice is Basic is three rows telling somebody their only options are bad. It
 * is one word now. The person can hear it; they do not need to be told.
 *
 * ── The whole card is the target ────────────────────────────────────────────
 *
 * The name and the tier used to be the only part of a row that answered to a
 * tap. Everything else — the padding, the tick, the gap beside the Play button
 * — looked exactly as pressable and did nothing, which on a phone is a row that
 * feels broken rather than a row that is smaller than it looks.
 *
 * So the card holds the click handler and the button inside it holds none. A
 * press anywhere on the row bubbles up to one place and is handled once,
 * including the presses that arrive from the keyboard by way of the button; the
 * Play button stops the event, because hearing a voice again is a different act
 * from choosing it. Two targets, no button nested inside a button, and no dead
 * pixels between them.
 */

interface DeviceVoicePickerProps {
  voices: RankedVoice[]
  voicesReady: boolean
  /** The `voiceURI` currently chosen, if any. */
  selected: string | null
  onSelect: (voice: RankedVoice) => void
  /**
   * Extra work to do when a voice is auditioned.
   *
   * The audition itself is not this: the picker speaks by itself, because a
   * silent list of system voice names is not a choice anybody can make. This
   * is for a parent that wants to *also* do something — put the voice into a
   * running session, say.
   */
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
  const [heard, setHeard] = useState<string | null>(null)

  // A voice must never carry on talking over the screen that replaces this one.
  useEffect(() => () => stopDeviceAudition(), [])

  const audition = (voice: RankedVoice) => {
    setHeard(voice.voiceURI)
    auditionDeviceVoice(voice.voiceURI)
    onPreview?.(voice)
  }

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
              {/*
                The card carries the handler, and the button inside it carries
                none.

                That inversion is what makes every pixel of the row answer to a
                tap — the padding, the gap, the space beside Play — without a
                button nested inside a button, which is invalid and which screen
                readers render as nonsense. A press on the label bubbles up to
                here and is handled once; a press on the padding is handled the
                same way; and Play stops the event so that hearing a voice again
                is still a different act from choosing it.

                The `<button>` stays because the accessibility has to be real:
                it is what gets focus, what announces `aria-pressed`, and what
                Enter and Space activate — and those activations arrive here as
                clicks, like any other.
              */}
              <div
                onClick={() => {
                  cue('select')
                  onSelect(voice)
                  // Chosen and heard in one press. See the note above.
                  audition(voice)
                }}
                className={cx(
                  'flex cursor-pointer items-center gap-2 rounded-[1.15rem] border px-3 py-2.5 transition-colors duration-300',
                  chosen
                    ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                    : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
                )}
              >
                <button
                  type="button"
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
                      {voice.tierShort}
                      {heard === voice.voiceURI && ' · playing'}
                    </span>
                  </span>
                </button>

                {/*
                  Kept even though selecting already speaks, because hearing a
                  voice a second time without re-committing to it is a
                  different thing to want — which is exactly what the stopped
                  propagation buys: the one part of the card that auditions
                  without also choosing.
                */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    cue('tap')
                    audition(voice)
                  }}
                  aria-label={`Hear ${voice.name} again`}
                  className="interactive flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[0.8rem] text-ink-muted hover:text-ink"
                >
                  <PlayIcon />
                </button>
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
