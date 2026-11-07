/**
 * Sleep mode, as arithmetic.
 *
 * Somebody falling asleep to a loop wants two things that pull against each
 * other: the sound to keep going until they are gone, and the sound to be gone
 * by the time they are. An ordinary session timer gets the first and fails the
 * second — the voice and the rain are at full level until the last second and
 * then a two-second fade, which is exactly the change of state that wakes a
 * person who had just dropped off.
 *
 * So a sleep timer spends its last stretch fading *everything* — voice,
 * background, rhythm, breath, music — on a curve with no corners: it leaves
 * full level with zero slope, so the start of the fade is not an event, and it
 * arrives at silence with zero slope, so the end is not one either. The fade
 * is long — most of a short timer, twenty-five minutes of a long one — because
 * a change spread over that long is below what anybody can notice happening.
 *
 * Everything here is pure, so the shape of the night can be tested without a
 * clock or a speaker.
 */

/** The sleep timer lengths offered, in minutes. */
export const SLEEP_PRESETS = [15, 30, 45, 60, 90] as const

/** How much a "+" press adds, in minutes. */
export const SLEEP_EXTEND_MINUTES = 15

const MINUTE = 60_000
const MIN_FADE_MS = 2 * MINUTE
const MAX_FADE_MS = 25 * MINUTE
/** Share of the timer spent fading, before the bounds above. */
const FADE_SHARE = 0.6

/**
 * How long the fade lasts for a timer of `totalMs`.
 *
 * Sixty per cent of it, between two and twenty-five minutes, and never longer
 * than the timer itself. A fifteen-minute timer fades for nine; an hour fades
 * for twenty-five and plays at full level for the thirty-five before that.
 */
export function fadeWindowMs(totalMs: number): number {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return 0
  const share = totalMs * FADE_SHARE
  return Math.min(totalMs, Math.max(MIN_FADE_MS, Math.min(MAX_FADE_MS, share)))
}

/**
 * The level everything should be at, 0–1, with `remainingMs` left of a sleep
 * timer that was `totalMs` long.
 *
 * Full until the fade begins, then a raised-cosine to zero: flat at both ends,
 * steepest in the middle where it is least noticeable.
 */
export function sleepLevel(remainingMs: number, totalMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0
  const fade = fadeWindowMs(totalMs)
  if (fade <= 0 || remainingMs >= fade) return 1
  const progress = remainingMs / fade
  return 0.5 - 0.5 * Math.cos(Math.PI * progress)
}

/** When, in epoch milliseconds, the fade begins for a timer ending at `endsAt`. */
export function fadeStartsAt(endsAt: number, totalMs: number): number {
  return endsAt - fadeWindowMs(totalMs)
}

/** "11:42 pm" — a clock time in the person's own locale. */
export function formatClockTime(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    const date = new Date(epochMs)
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  }
}
