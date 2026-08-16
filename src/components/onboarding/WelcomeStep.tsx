import { cue } from '../../lib/feedback'
import { cx } from '../../lib/cx'
import { useReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { SparkIcon } from '../Icons'

/**
 * The first thing anybody sees.
 *
 * One sentence about what this is, one button, and a great deal of room. The
 * temptation on an opening screen is to explain — offline, private, no
 * account, ambient sound, breathing guide, exportable audio — and every one of
 * those sentences moves the first affirmation further away. They are all true
 * and they are all better discovered by somebody who is already listening.
 *
 * The button does one quiet, load-bearing thing besides advancing: it is a
 * real user gesture, and it is where the audio hardware gets opened. Browsers
 * only allow that inside a tap, so the whole screen after this one — where
 * lines play the instant they are touched — depends on this press having
 * happened.
 */

interface WelcomeStepProps {
  onBegin: () => void
}

export function WelcomeStep({ onBegin }: WelcomeStepProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className="text-center">
      <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center">
        <span
          aria-hidden="true"
          className={cx(
            'absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,var(--glow),transparent_68%)]',
            !reducedMotion && 'animate-welcome-glow',
          )}
        />
        <span
          aria-hidden="true"
          className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[1.6rem] text-[var(--rose-deep)]"
        >
          <SparkIcon />
        </span>
      </div>

      <h1 className="type-display text-balance">
        Words you want to believe, on repeat.
      </h1>
      <p className="type-body mx-auto mt-4 max-w-[34ch] text-balance">
        Manifester reads your affirmations aloud over gentle sound, and begins
        again. Let&rsquo;s find your first one.
      </p>

      <Button
        variant="primary"
        size="xl"
        block
        className="mt-9"
        onClick={() => {
          cue('start')
          onBegin()
        }}
      >
        Begin
      </Button>

      <p className="type-meta mt-4">
        Takes under a minute. Everything stays on this device.
      </p>
    </div>
  )
}
