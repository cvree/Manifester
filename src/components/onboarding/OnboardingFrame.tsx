import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { useReducedMotion } from '../../lib/motion'

/**
 * The room the first minute happens in.
 *
 * Deliberately not a wizard. There is no title bar, no "Step 2 of 4", and no
 * Back/Next pair — the four dots at the bottom are the only progress the
 * screen admits to, and they are small enough to read as decoration until you
 * look for them. What is being avoided is the feeling of a form: the moment
 * somebody thinks they are configuring software, the thirty seconds this
 * screen is allowed to take start feeling like three minutes.
 *
 * Skip sits in the corner from the very first frame, at a size that is easy to
 * hit and easy to ignore. An introduction you cannot leave is a modal, and a
 * modal is the opposite of what this app is for.
 */

interface OnboardingFrameProps {
  /** 0-based, for the dots. */
  step: number
  total: number
  onSkip: () => void
  skipLabel?: string
  /** Changes on every step, so the whole panel re-animates in. */
  stepKey: string
  /**
   * `wide` on the one step that is a grid rather than a column.
   *
   * A single measure suits reading and choosing between two things, and it
   * makes a laptop show the theme grid three tiles across with a scroll —
   * which on the step whose whole point is *seeing all the options at once* is
   * the wrong trade. The step says which shape it is; the frame does not
   * guess from its contents.
   */
  width?: 'column' | 'wide'
  children: ReactNode
}

export function OnboardingFrame({
  step,
  total,
  onSkip,
  skipLabel = 'Skip',
  stepKey,
  width = 'column',
  children,
}: OnboardingFrameProps) {
  const reducedMotion = useReducedMotion()

  return (
    /*
      Tall enough to fill the screen under the header, and free to grow past it
      — the focus grid with every theme open is deliberately taller than a
      phone. `min-h` rather than `h` is what lets a short step sit centred and
      a long one simply scroll.
    */
    <div
      className={cx(
        'mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full flex-col',
        width === 'wide' ? 'max-w-xl sm:max-w-2xl lg:max-w-4xl' : 'max-w-xl',
      )}
    >
      <div className="flex justify-end">
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
        old subtree down and builds the new one, which is what restarts the
        animation. Without it the second step would appear fully formed while
        the first one was still fading.
      */}
      <div
        key={stepKey}
        className={cx(
          'flex grow flex-col justify-center py-4',
          !reducedMotion && 'animate-step-in',
        )}
      >
        {children}
      </div>

      <ol
        className="flex items-center justify-center gap-2 py-6"
        aria-label={`Step ${step + 1} of ${total}`}
      >
        {Array.from({ length: total }, (_, index) => (
          <li
            key={index}
            aria-current={index === step ? 'step' : undefined}
            className={cx(
              'h-1.5 rounded-pill transition-all duration-500 ease-[var(--ease-calm)]',
              index === step
                ? 'w-6 bg-[var(--rose-deep)]'
                : index < step
                  ? 'w-1.5 bg-[var(--rose)]'
                  : 'w-1.5 bg-[var(--quiet-border)]',
            )}
          />
        ))}
      </ol>
    </div>
  )
}
