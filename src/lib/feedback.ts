/**
 * Quiet touch feedback.
 *
 * The old interface generated a family of synthetic confirmation chimes. They
 * were more noticeable than useful in a nighttime product, so interface cues
 * are now silent. Where a device genuinely supports vibration, the same calls
 * can still provide a brief, restrained tactile answer.
 */

export type Cue =
  | 'tap'
  | 'select'
  | 'start'
  | 'stop'
  | 'save'
  | 'inhale'
  | 'exhale'
  | 'hold'
  | 'complete'
  | 'error'

const PATTERNS: Partial<Record<Cue, number | number[]>> = {
  tap: 7,
  select: 5,
  start: 12,
  stop: 14,
  save: [8, 28, 10],
  inhale: 12,
  exhale: 18,
  hold: 6,
  complete: [12, 48, 22],
  error: [24, 45, 24],
}

let hapticsEnabled = true

/** Retained for stored preferences and older callers; interface audio is retired. */
export function setSoundEnabled(enabled: boolean): void {
  void enabled
}

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled
}

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

let sawGesture = false
if (typeof window !== 'undefined') {
  const remember = () => {
    sawGesture = true
    window.removeEventListener('pointerdown', remember)
    window.removeEventListener('keydown', remember)
  }
  window.addEventListener('pointerdown', remember, { once: true, passive: true })
  window.addEventListener('keydown', remember, { once: true })
}

function mayVibrate(): boolean {
  if (!hapticsSupported()) return false
  const activation = (
    navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
  ).userActivation
  return activation ? activation.hasBeenActive : sawGesture
}

export function haptic(name: Cue): void {
  const pattern = PATTERNS[name]
  if (!hapticsEnabled || pattern == null || !mayVibrate()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* Hidden pages and a few embedded browsers refuse vibration. */
  }
}

/** Interface cues are intentionally silent; this remains the shared haptic seam. */
export function cue(name: Cue): void {
  haptic(name)
}

export function primeFeedback(): void {
  /* No audio context to unlock. */
}

export function disposeFeedback(): void {
  /* No audio resources to release. */
}
