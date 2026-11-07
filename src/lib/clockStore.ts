/**
 * The session's numbers that change every second, kept out of React state.
 *
 * ── Why this exists ──
 *
 * The elapsed time, the countdown and the rest between passes used to live in
 * the session snapshot, so every second — and, with a timer set, four times a
 * second, because the countdown arrived as a fraction that was never the same
 * twice — the whole session context was handed a new object and every screen
 * that reads it re-rendered: the player, its controls, the mixer, the header,
 * the lock-screen bridge. On the same main thread that draws the breath.
 *
 * Three numbers that only a clock readout actually looks at do not belong in a
 * context that most of the app reads. They live here instead, as whole
 * seconds, and a component that wants them subscribes with `useSessionClock`
 * — which re-renders that component alone, and only when the number it
 * selected has actually changed.
 */

export interface ClockReading {
  /** Whole seconds of active listening in this session. */
  elapsedSeconds: number
  /** Whole seconds left on the timer, rounded up, or `null` with no timer. */
  remainingSeconds: number | null
  /** Whole seconds left in the rest between passes, or `null` while speaking. */
  delayRemaining: number | null
}

export const EMPTY_READING: ClockReading = {
  elapsedSeconds: 0,
  remainingSeconds: null,
  delayRemaining: null,
}

function whole(value: number | null | undefined, round: (n: number) => number) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.max(0, round(value))
}

export class ClockStore {
  private reading: ClockReading = EMPTY_READING
  private readonly listeners = new Set<() => void>()

  /** Stable between changes, as `useSyncExternalStore` requires. */
  readonly get = (): ClockReading => this.reading

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Merge new values in, rounded to what a person can see.
   *
   * Elapsed counts down to the second it is in (floor); a countdown shows the
   * second it has not yet finished (ceil), so "0:01" is on screen for the last
   * second rather than "0:00". Nothing is announced unless a whole second
   * actually moved — which is what makes calling this four times a second free.
   */
  set(patch: Partial<ClockReading>): void {
    const next: ClockReading = {
      elapsedSeconds:
        patch.elapsedSeconds !== undefined
          ? (whole(patch.elapsedSeconds, Math.floor) ?? 0)
          : this.reading.elapsedSeconds,
      remainingSeconds:
        patch.remainingSeconds !== undefined
          ? whole(patch.remainingSeconds, Math.ceil)
          : this.reading.remainingSeconds,
      delayRemaining:
        patch.delayRemaining !== undefined
          ? whole(patch.delayRemaining, Math.ceil)
          : this.reading.delayRemaining,
    }
    if (
      next.elapsedSeconds === this.reading.elapsedSeconds &&
      next.remainingSeconds === this.reading.remainingSeconds &&
      next.delayRemaining === this.reading.delayRemaining
    ) {
      return
    }
    this.reading = next
    for (const listener of [...this.listeners]) listener()
  }

  reset(): void {
    this.set(EMPTY_READING)
  }
}
