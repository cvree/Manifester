/**
 * Haptics and interface sounds.
 *
 * Every sound here is synthesised from a couple of oscillators at the moment it
 * plays — there are no audio files in this repository, and these are no
 * exception. They are deliberately quiet and short: a cue you notice only if
 * you are listening for it.
 *
 * Its own small `AudioContext` is used rather than the session bus, so a cue
 * can never be caught by a session fade or suspended along with the music.
 */

export type Cue =
  | 'tap'
  | 'start'
  | 'stop'
  | 'inhale'
  | 'exhale'
  | 'hold'
  | 'complete'
  | 'error'

interface CueShape {
  /** Ascending tones make a gesture feel like it opened something. */
  notes: number[]
  duration: number
  gain: number
  type: OscillatorType
  /** Milliseconds of vibration, where the device supports it. */
  vibrate?: number | number[]
}

const CUES: Record<Cue, CueShape> = {
  tap: { notes: [660], duration: 0.07, gain: 0.05, type: 'sine', vibrate: 8 },
  start: {
    notes: [523.25, 784],
    duration: 0.18,
    gain: 0.07,
    type: 'sine',
    vibrate: [14, 40, 22],
  },
  stop: { notes: [523.25, 392], duration: 0.2, gain: 0.06, type: 'sine', vibrate: 18 },
  // The breathing cues are the softest things in the app on purpose.
  inhale: { notes: [523.25], duration: 0.5, gain: 0.045, type: 'sine', vibrate: 12 },
  exhale: { notes: [392], duration: 0.7, gain: 0.045, type: 'sine', vibrate: 20 },
  hold: { notes: [659.25], duration: 0.28, gain: 0.03, type: 'sine', vibrate: 6 },
  complete: {
    notes: [523.25, 659.25, 783.99],
    duration: 0.5,
    gain: 0.07,
    type: 'sine',
    vibrate: [16, 60, 16, 60, 30],
  },
  error: { notes: [311.13, 261.63], duration: 0.24, gain: 0.06, type: 'triangle', vibrate: [30, 50, 30] },
}

let ctx: AudioContext | null = null
let soundEnabled = true
let hapticsEnabled = true

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled
}

/** Vibration is Android-and-friends only; iOS Safari does not expose it. */
export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/**
 * Browsers refuse to vibrate until the page has been genuinely tapped, and log
 * an error every time you ask before then. Breathing cues fire on a timer, so
 * without this guard a session started by keyboard would fill the console.
 */
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
  if (activation) return activation.hasBeenActive
  return sawGesture
}

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/**
 * Play a cue. Safe to call from anywhere — it does nothing at all when the
 * user has turned cues off, and never throws.
 */
export function cue(name: Cue): void {
  const shape = CUES[name]
  if (!shape) return

  if (hapticsEnabled && shape.vibrate != null && mayVibrate()) {
    try {
      navigator.vibrate(shape.vibrate)
    } catch {
      /* Some browsers throw when the page is not visible. */
    }
  }

  if (!soundEnabled) return

  const audio = context()
  if (!audio) return

  const now = audio.currentTime
  shape.notes.forEach((frequency, index) => {
    const startAt = now + index * shape.duration * 0.55

    const osc = audio.createOscillator()
    osc.type = shape.type
    osc.frequency.value = frequency

    // A soft-edged bell: quick in, gentle exponential tail, no click.
    const envelope = audio.createGain()
    envelope.gain.setValueAtTime(0.0001, startAt)
    envelope.gain.exponentialRampToValueAtTime(shape.gain, startAt + 0.02)
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + shape.duration)

    // Roll the top off so it sits behind the voice rather than over it.
    const tone = audio.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2400

    osc.connect(envelope).connect(tone).connect(audio.destination)
    osc.start(startAt)
    osc.stop(startAt + shape.duration + 0.05)
  })
}

/**
 * Prime the cue context from a user gesture. iOS refuses to start audio
 * otherwise, and the first cue would be silently swallowed.
 */
export function primeFeedback(): void {
  context()
}

export function disposeFeedback(): void {
  if (!ctx) return
  void ctx.close().catch(() => undefined)
  ctx = null
}
