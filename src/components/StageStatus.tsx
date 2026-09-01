/**
 * One line of small type at the top of the stage, saying what is happening.
 *
 * It is the smallest thing on the screen and one of the most looked at — it is
 * directly above the title, and it is what somebody reads in the seconds
 * between pressing play and hearing anything. That is the whole design brief:
 * at that size, in that position, type is either considered or it is a badge,
 * and a badge is what a settings screen puts next to a toggle.
 *
 * So three things are deliberate here and none of them is decoration:
 *
 *  - **The tracking.** Wide-set capitals at a small size read as an inscription
 *    rather than as a label, and the wideness is what buys the smallness: this
 *    is *lighter* and *smaller* than the label it replaces and still perfectly
 *    legible, so it sits under the title without competing with it.
 *  - **The change.** A state label that swaps instantly is the one moving thing
 *    on a screen about being still. Each new state settles in from slightly
 *    wider tracking and a little blur, over about the length of one breath in —
 *    the same easing the stage itself travels on.
 *  - **The wait.** When the line is naming a wait rather than a state, a slow
 *    sheen crosses the letters and three dots breathe after them. It replaces
 *    the typographic ellipsis, which at this tracking is three full-width dots
 *    with nothing to say, and it means the difference between "waiting" and
 *    "finished" is legible without reading the words at all.
 *
 * Everything self-running here stops under `prefers-reduced-motion`, where the
 * label simply fades and the dots hold still. See `theme.css`.
 */

import { cx } from '../lib/cx'

export interface StageStatusProps {
  /** The state, in words. Kept short: this is set in wide capitals. */
  label: string
  /**
   * True while the label names something the app is waiting on.
   *
   * Only ever a genuine wait — the voice status behind this is held back for
   * about a second before it is believed, so an ordinary cached line never
   * lights this at all. See `SessionProvider`.
   */
  waiting?: boolean
  className?: string
}

export function StageStatus({
  label,
  waiting = false,
  className,
}: StageStatusProps) {
  return (
    <p
      className={cx(
        'stage__state',
        waiting && 'stage__state--waiting',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {/*
        Keyed by the words, so a new state is a new element and the settle
        animation runs again. Keying by anything else — an index, a status —
        would leave the same node in place and the type would simply jump.
      */}
      <span key={label} className="stage__state-text">
        {label}
      </span>
      {waiting && (
        <span className="stage__state-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </p>
  )
}
