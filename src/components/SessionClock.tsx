import { formatClock } from '../lib/format'
import type { SessionStatus } from '../lib/types'
import { useSessionClock } from '../state/SessionProvider'
import { StageStatus } from './StageStatus'

/*
 * The only components in the app that re-render once a second.
 *
 * Each subscribes to the one number it draws, so the tick of a running session
 * redraws a few characters of type and nothing else — not the stage, not the
 * orb, not the controls beside it. See `ClockStore`.
 */

/** "12:34 remaining", "3:02 elapsed", "20:00 listened". */
export function ClockReadout({
  status,
  wordless,
}: {
  status: SessionStatus
  wordless: boolean
}) {
  const elapsed = useSessionClock((clock) => clock.elapsedSeconds)
  const remaining = useSessionClock((clock) => clock.remainingSeconds)
  const complete = status === 'complete'

  const label = complete
    ? formatClock(elapsed)
    : remaining != null
      ? formatClock(remaining)
      : formatClock(elapsed)
  const caption = complete
    ? wordless
      ? 'breathed'
      : 'listened'
    : remaining != null
      ? 'remaining'
      : 'elapsed'

  return (
    <div className="flex items-center gap-3">
      {/*
        A timer, not a live region. As `aria-live="polite"` it changed every
        second and a screen reader read the clock aloud once a second for the
        whole session; `timer` is there to be asked, and stays quiet otherwise.
      */}
      <span className="type-numeral text-[1.05rem] text-ink" role="timer">
        {label}
      </span>
      <span className="type-meta">{caption}</span>
    </div>
  )
}

/** How long the session that just ended lasted, as words. */
export function ElapsedText() {
  const elapsed = useSessionClock((clock) => clock.elapsedSeconds)
  return <>{formatClock(elapsed)}</>
}

/**
 * The label at the top of the stage.
 *
 * Here rather than in the player because one of its states — the rest between
 * passes — counts down, and a countdown in the player would redraw the player.
 */
export function LiveStageStatus({
  status,
  wordless,
  voicePreparing,
  override,
}: {
  status: SessionStatus
  wordless: boolean
  voicePreparing: boolean
  /** A label that wins over everything else, e.g. sleep mode's. */
  override?: string | null
}) {
  const delay = useSessionClock((clock) => clock.delayRemaining)
  const playing = status === 'playing'

  /*
   * The one state on this line that is a *wait* rather than a fact.
   *
   * It is rare now and meant to be rarer still: the lines of a draft are
   * fetched while somebody is looking at the play button, the loop keeps the
   * whole pass warm behind itself, and the flag underneath is not believed
   * until the wait has lasted about a second — so a cached line, which is
   * nearly every line, never lights this at all. See `useWarmVoice`.
   */
  const waiting = playing && !wordless && delay == null && voicePreparing

  const label =
    status === 'complete'
      ? 'Complete'
      : status === 'paused'
        ? 'Paused'
        : playing
          ? (override ??
            (wordless
              ? 'Breathing'
              : delay != null
                ? `Resting · ${delay}s`
                : waiting
                  ? 'Finding the voice'
                  : 'Now looping'))
          : 'Ready when you are'

  return <StageStatus label={label} waiting={waiting && !override} />
}
