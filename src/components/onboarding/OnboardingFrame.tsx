import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { useReducedMotion } from '../../lib/motion'
import { ChevronIcon } from '../Icons'

/**
 * The room the first minute happens in.
 *
 * Deliberately not a wizard. There is no title bar, no "Step 2 of 4", and no
 * Next button — the four marks at the bottom are the only progress the screen
 * admits to, and they are quiet enough to read as punctuation until you look
 * for them. What is being avoided is the feeling of a form: the moment
 * somebody thinks they are configuring software, the thirty seconds this takes
 * start feeling like three minutes.
 *
 * Back and Skip sit in the corners at a size that is easy to hit and easy to
 * ignore. Back matters more than it looks — changing your mind about what you
 * came here for is the most likely thing anybody does in this flow — and Skip
 * matters because an introduction you cannot leave is a modal, which is the
 * opposite of what this app is for.
 */

interface OnboardingFrameProps {
  /** 0-based, for the marks. */
  step: number
  total: number
  onSkip: () => void
  onBack?: () => void
  skipLabel?: string
  /** Changes on every step, so the panel re-animates in. */
  stepKey: string
  /**
   * `wide` on the one step that is a grid rather than a column.
   *
   * A single measure suits reading and choosing between two things, and it
   * would make a laptop show the intent grid three tiles across with a scroll
   * — which on the step whose whole point is *seeing all the options at once*
   * is the wrong trade. The step says which shape it is; the frame does not
   * guess from its contents.
   */
  width?: 'column' | 'wide'
  children: ReactNode
}

export function OnboardingFrame({
  step,
  total,
  onSkip,
  onBack,
  skipLabel = 'Skip',
  stepKey,
  width = 'column',
  children,
}: OnboardingFrameProps) {
  const reducedMotion = useReducedMotion()

  return (
    /*
      Tall enough to fill the screen under the header, and free to grow past it
      — the intent grid with every theme open is deliberately taller than a
      phone. `min-h` rather than `h` is what lets a short step sit centred and
      a long one simply scroll.
    */
    <div
      className={cx(
        'relative mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full flex-col',
        width === 'wide' ? 'max-w-xl sm:max-w-2xl lg:max-w-4xl' : 'max-w-xl',
      )}
    >
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={() => {
              cue('tap')
              onBack()
            }}
            className="interactive -ml-2 inline-flex min-h-11 items-center gap-1 rounded-pill pl-2 pr-4 text-[0.9rem] text-ink-faint hover:text-ink"
          >
            <ChevronIcon aria-hidden="true" className="rotate-90 text-[1rem]" />
            Back
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => {
            cue('tap')
            onSkip()
          }}
          className="interactive -mr-2 min-h-11 rounded-pill px-4 text-[0.9rem] text-ink-faint hover:text-ink"
        >
          {skipLabel}
        </button>
      </div>

      {/*
        `key` on the animated wrapper rather than on each step: React tears the
        old subtree down and builds the new one, which is what lets every
        reveal inside start from the beginning. Without it the second step
        would appear fully formed while the first was still arriving.
      */}
      <div
        key={stepKey}
        /*
          Short viewports get their vertical rhythm back. A 568-point phone is
          still a phone somebody uses this on, and the difference between the
          primary action being on screen and eleven pixels below it is entirely
          made of padding that exists for comfort on a laptop.
        */
        className={cx(
          'flex grow flex-col justify-center py-4 [@media(max-height:720px)]:py-1',
          !reducedMotion && 'animate-step-in',
        )}
      >
        {children}
      </div>

      <ol
        className="flex items-center justify-center gap-2 py-6 [@media(max-height:720px)]:py-3"
        aria-label={`Step ${step + 1} of ${total}`}
      >
        {Array.from({ length: total }, (_, index) => (
          <li
            key={index}
            aria-current={index === step ? 'step' : undefined}
            className={cx(
              'h-1 rounded-pill transition-all duration-500 ease-[var(--ease-calm)]',
              index === step
                ? 'w-7 bg-[var(--rose-deep)]'
                : index < step
                  ? 'w-1 bg-[var(--rose)]'
                  : 'w-1 bg-[var(--quiet-border)]',
            )}
          />
        ))}
      </ol>
    </div>
  )
}
