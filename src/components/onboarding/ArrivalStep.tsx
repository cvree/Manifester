import { cue } from '../../lib/feedback'
import { Button } from '../Button'
import { Reveal, RevealText } from './Reveal'

/**
 * The first thing anybody sees.
 *
 * One sentence, one action, and a great deal of room. The temptation on an
 * opening screen is to explain — offline, private, no account, ambient sound,
 * breathing guide, exportable audio — and every one of those sentences moves
 * the first affirmation further away. They are all true and they are all
 * better discovered by somebody who is already listening.
 *
 * The button does one quiet, load-bearing thing besides advancing: it is a
 * real user gesture, and it is where the audio hardware gets opened. Browsers
 * only allow that inside a tap, so the whole experience after this one — where
 * lines speak the instant they are touched — depends on this press having
 * happened.
 */

interface ArrivalStepProps {
  onBegin: () => void
}

export function ArrivalStep({ onBegin }: ArrivalStepProps) {
  return (
    <div className="text-center">
      <Reveal delay={0.1} distance={10}>
        <p className="type-label mb-6 text-ink-faint">Manifester</p>
      </Reveal>

      <RevealText
        as="h1"
        delay={0.25}
        className="type-display mx-auto max-w-[16ch] text-balance"
        text="Words you want to believe, on repeat."
      />

      <Reveal delay={0.95}>
        <p className="type-body mx-auto mt-5 max-w-[32ch] text-balance">
          Choose something to strengthen, hear it spoken aloud, and let it
          gently begin again.
        </p>
      </Reveal>

      <Reveal delay={1.15} distance={10}>
        <Button
          variant="primary"
          size="xl"
          block
          className="mt-10 max-w-sm sm:mx-auto"
          onClick={() => {
            cue('start')
            onBegin()
          }}
        >
          Begin
        </Button>

        <p className="type-meta mt-4">
          Under a minute. Everything stays on this device.
        </p>
      </Reveal>
    </div>
  )
}
