/**
 * The breathing pattern engine.
 *
 * A breath is four phases — inhale, hold, exhale, hold — any of which may be
 * zero seconds. Progress is computed from the wall clock rather than counted
 * frames, so a dropped frame or a throttled tab never lets the guide drift out
 * of step with the person following it.
 *
 * The engine holds no rendering concerns at all: it reports which phase we are
 * in and how far through it we are, and the orb decides what that looks like.
 */

export type BreathPhase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'

export interface BreathPattern {
  inhale: number
  holdIn: number
  exhale: number
  holdOut: number
}

/** What a pattern is for. Presets are grouped under these on the picker. */
export type BreathMood = 'settle' | 'balance' | 'focus' | 'sleep' | 'lift'

export const MOOD_LABEL: Record<BreathMood, string> = {
  settle: 'Settle',
  balance: 'Balance',
  focus: 'Focus',
  sleep: 'Sleep',
  lift: 'Lift',
}

/** The order moods appear in, calmest first. */
export const MOOD_ORDER: BreathMood[] = [
  'settle',
  'balance',
  'focus',
  'sleep',
  'lift',
]

export interface BreathPreset {
  id: string
  name: string
  /** One honest line about what it is for. */
  description: string
  mood: BreathMood
  pattern: BreathPattern
}

/** Longer out-breath than in-breath is the calming direction. */
export const DEFAULT_PATTERN: BreathPattern = {
  inhale: 4,
  holdIn: 0,
  exhale: 6,
  holdOut: 0,
}

export const BREATH_PRESETS: BreathPreset[] = [
  {
    id: 'calm',
    name: 'Calm',
    description: 'In for 4, out for 6. A longer out-breath settles you.',
    mood: 'settle',
    pattern: DEFAULT_PATTERN,
  },
  {
    id: 'sigh',
    name: 'Let go',
    description: 'In for 4, out for 8. The longest exhale here, for tension.',
    mood: 'settle',
    pattern: { inhale: 4, holdIn: 0, exhale: 8, holdOut: 0 },
  },
  {
    id: 'even',
    name: 'Even',
    description: 'In for 5, out for 5. Steady and easy to follow.',
    mood: 'balance',
    pattern: { inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 },
  },
  {
    id: 'coherent',
    name: 'Coherent',
    description: 'In and out for 5.5 — about six breaths a minute.',
    mood: 'balance',
    pattern: { inhale: 5.5, holdIn: 0, exhale: 5.5, holdOut: 0 },
  },
  {
    id: 'box',
    name: 'Box',
    description: 'Four counts each: in, hold, out, hold.',
    mood: 'focus',
    pattern: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  },
  {
    id: 'triangle',
    name: 'Triangle',
    description: 'In for 4, hold 4, out for 6. Box, with a softer landing.',
    mood: 'focus',
    pattern: { inhale: 4, holdIn: 4, exhale: 6, holdOut: 0 },
  },
  {
    id: 'unwind',
    name: 'Unwind',
    description: 'In for 4, hold 7, out for 8. Slow and deep.',
    mood: 'sleep',
    pattern: { inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  },
  {
    id: 'deep-rest',
    name: 'Deep rest',
    description: 'In for 6, out for 10. Very slow — best lying down.',
    mood: 'sleep',
    pattern: { inhale: 6, holdIn: 0, exhale: 10, holdOut: 0 },
  },
  {
    id: 'awaken',
    name: 'Awaken',
    description: 'In for 6, out for 3. A longer in-breath brings you up.',
    mood: 'lift',
    pattern: { inhale: 6, holdIn: 0, exhale: 3, holdOut: 0 },
  },
  {
    id: 'clear',
    name: 'Clear',
    description: 'In for 3, out for 3. Quick, bright and wakeful.',
    mood: 'lift',
    pattern: { inhale: 3, holdIn: 0, exhale: 3, holdOut: 0 },
  },
]

/* ── Visual styles ──────────────────────────────────────────── */

/**
 * How the guide is drawn.
 *
 * Every style reads the same two custom properties and so follows the same
 * breath exactly; what changes is the form it takes. They exist because a
 * shape you find beautiful is a shape you will keep watching, and watching is
 * the whole mechanism — one person settles into a lotus opening, another into
 * water, another wants a plain circle and nothing else.
 */
export type BreathStyleId =
  | 'bloom'
  | 'halo'
  | 'ripple'
  | 'aurora'
  | 'constellation'
  | 'tide'

export interface BreathStyle {
  id: BreathStyleId
  name: string
  description: string
}

export const BREATH_STYLES: BreathStyle[] = [
  {
    id: 'bloom',
    name: 'Bloom',
    description: 'Six petals opening from a seed of light.',
  },
  {
    id: 'halo',
    name: 'Halo',
    description: 'One circle and one ring. Nothing else.',
  },
  {
    id: 'ripple',
    name: 'Ripple',
    description: 'Rings travelling outward across still water.',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Slow drifts of colour that gather and part.',
  },
  {
    id: 'constellation',
    name: 'Constellation',
    description: 'Stars drawing apart and back into a point.',
  },
  {
    id: 'tide',
    name: 'Tide',
    description: 'A water line rising and falling inside the circle.',
  },
]

export const DEFAULT_STYLE: BreathStyleId = 'bloom'

export function findStyle(id: string): BreathStyle {
  return BREATH_STYLES.find((style) => style.id === id) ?? BREATH_STYLES[0]
}

/* ── Timing ─────────────────────────────────────────────────── */

export const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: 'Breathe in',
  holdIn: 'Hold',
  exhale: 'Breathe out',
  holdOut: 'Rest',
}

/**
 * Half-second steps, because two of the presets people ask for by name —
 * coherent breathing at 5.5 seconds a side — are not whole numbers, and a
 * custom timing control that cannot reach the preset beside it is a control
 * that quietly calls itself a liar.
 */
export const PHASE_LIMITS = { min: 0, max: 20, step: 0.5 }

/** `5.5` → `"5.5"`, `6` → `"6"`. Trailing `.0` reads like a stopwatch. */
export function formatSeconds(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function cycleSeconds(pattern: BreathPattern): number {
  return pattern.inhale + pattern.holdIn + pattern.exhale + pattern.holdOut
}

/** Breaths per minute, for the pattern picker's readout. */
export function breathsPerMinute(pattern: BreathPattern): number {
  const total = cycleSeconds(pattern)
  return total > 0 ? 60 / total : 0
}

/** A pattern with no time in it would divide by zero everywhere downstream. */
export function isPatternValid(pattern: BreathPattern): boolean {
  return pattern.inhale > 0 && pattern.exhale > 0
}

export function findPreset(pattern: BreathPattern): BreathPreset | undefined {
  return BREATH_PRESETS.find(
    (preset) =>
      preset.pattern.inhale === pattern.inhale &&
      preset.pattern.holdIn === pattern.holdIn &&
      preset.pattern.exhale === pattern.exhale &&
      preset.pattern.holdOut === pattern.holdOut,
  )
}

/** e.g. `"4 in · 7 hold · 8 out"` — the shape of a breath in one line. */
export function describePattern(pattern: BreathPattern): string {
  return [
    `${formatSeconds(pattern.inhale)} in`,
    pattern.holdIn > 0 ? `${formatSeconds(pattern.holdIn)} hold` : null,
    `${formatSeconds(pattern.exhale)} out`,
    pattern.holdOut > 0 ? `${formatSeconds(pattern.holdOut)} rest` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export interface BreathState {
  phase: BreathPhase
  /** 0 → 1 through the current phase. */
  phaseProgress: number
  /** Seconds remaining in the current phase, rounded up for display. */
  phaseRemaining: number
  /**
   * 0 → 1 → 0 across a whole breath: how expanded the orb should be.
   * Eased, so the turn at the top and bottom feels like breath rather than
   * a triangle wave.
   */
  expansion: number
  /**
   * How much of this phase's own movement is happening right now: 1 in the
   * middle of an in- or out-breath, 0 through a hold, and 0 at the exact turn
   * between the two.
   *
   * It is the eased curve's own slope, normalised — so it is not a second
   * opinion about the breath, it is the same curve differentiated. The room
   * uses it to let its *secondary* motion — the slow drifts that run on their
   * own clocks — fall away as the breath comes to its turn, which is what
   * makes the top of an inhale feel like time suspending rather than like one
   * layer stopping while the others carry on.
   */
  motion: number
  completedBreaths: number
}

const ORDER: BreathPhase[] = ['inhale', 'holdIn', 'exhale', 'holdOut']

/** Smooth acceleration and settle — the shape a real breath has. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/**
 * `easeInOut`'s slope, scaled so its peak is 1.
 *
 * The derivative is `4t` up to the midpoint and `4(1 - t)` after it, so
 * halving it gives a triangle from 0 up to 1 and back — zero at both ends of
 * the phase, which is exactly where a breath comes to rest.
 */
export function easeInOutSlope(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t
  return clamped < 0.5 ? 2 * clamped : 2 * (1 - clamped)
}

/** Where in the cycle `elapsedSeconds` lands. Negative time wraps backwards. */
function locate(
  pattern: BreathPattern,
  elapsedSeconds: number,
  total: number,
): { phase: BreathPhase; progress: number; remaining: number; breaths: number } {
  const breaths = Math.floor(elapsedSeconds / total)
  let offset = elapsedSeconds - breaths * total

  for (const phase of ORDER) {
    const duration = pattern[phase]
    if (duration <= 0) continue

    if (offset < duration) {
      return {
        phase,
        progress: offset / duration,
        remaining: Math.max(1, Math.ceil(duration - offset)),
        breaths,
      }
    }
    offset -= duration
  }

  // Floating point can land a hair past the end of the last phase.
  return { phase: 'holdOut', progress: 1, remaining: 1, breaths }
}

/**
 * Resolve the breath state at `elapsedSeconds` into the cycle.
 * Pure, so it is trivial to reason about and to test.
 */
export function breathStateAt(
  pattern: BreathPattern,
  elapsedSeconds: number,
): BreathState {
  const total = cycleSeconds(pattern)
  if (total <= 0) {
    return {
      phase: 'inhale',
      phaseProgress: 0,
      phaseRemaining: 0,
      expansion: 0,
      motion: 0,
      completedBreaths: 0,
    }
  }

  const { phase, progress, remaining, breaths } = locate(
    pattern,
    elapsedSeconds,
    total,
  )

  return {
    phase,
    phaseProgress: progress,
    phaseRemaining: remaining,
    expansion: expansionFor(phase, progress),
    motion: motionFor(phase, progress),
    completedBreaths: breaths,
  }
}

/**
 * The expansion alone, at some other moment in the same cycle.
 *
 * This is how the room gets its sense of distance. Light nearer the orb is
 * drawn at `breathStateAt(now)`; light further out is drawn at
 * `expansionAt(now - a fraction of a second)`, so an in-breath appears to
 * travel outward from the centre instead of the whole screen changing at once.
 *
 * It is deliberately a *sample of the same curve* rather than a delayed copy
 * of the value: there is no buffer to fill, nothing to keep in sync and
 * nothing to restart, and a negative time simply wraps into the previous
 * cycle — which is the correct answer half a second into the first breath.
 */
export function expansionAt(
  pattern: BreathPattern,
  elapsedSeconds: number,
): number {
  const total = cycleSeconds(pattern)
  if (total <= 0) return 0
  const { phase, progress } = locate(pattern, elapsedSeconds, total)
  return expansionFor(phase, progress)
}

function expansionFor(phase: BreathPhase, progress: number): number {
  switch (phase) {
    case 'inhale':
      return easeInOut(progress)
    case 'holdIn':
      return 1
    case 'exhale':
      return 1 - easeInOut(progress)
    case 'holdOut':
      return 0
  }
}

function motionFor(phase: BreathPhase, progress: number): number {
  switch (phase) {
    case 'inhale':
    case 'exhale':
      return easeInOutSlope(progress)
    case 'holdIn':
    case 'holdOut':
      return 0
  }
}

/** Phases in this pattern that actually take time, in order. */
export function activePhases(pattern: BreathPattern): BreathPhase[] {
  return ORDER.filter((phase) => pattern[phase] > 0)
}
