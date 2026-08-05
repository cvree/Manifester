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

export interface BreathPreset {
  id: string
  name: string
  /** One honest line about what it is for. */
  description: string
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
    pattern: DEFAULT_PATTERN,
  },
  {
    id: 'even',
    name: 'Even',
    description: 'In for 5, out for 5. Steady and easy to follow.',
    pattern: { inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 },
  },
  {
    id: 'box',
    name: 'Box',
    description: 'Four counts each: in, hold, out, hold.',
    pattern: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  },
  {
    id: 'unwind',
    name: 'Unwind',
    description: 'In for 4, hold 7, out for 8. Slow and deep.',
    pattern: { inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  },
]

export const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: 'Breathe in',
  holdIn: 'Hold',
  exhale: 'Breathe out',
  holdOut: 'Rest',
}

export const PHASE_LIMITS = { min: 0, max: 20 }

export function cycleSeconds(pattern: BreathPattern): number {
  return pattern.inhale + pattern.holdIn + pattern.exhale + pattern.holdOut
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
  completedBreaths: number
}

const ORDER: BreathPhase[] = ['inhale', 'holdIn', 'exhale', 'holdOut']

/** Smooth acceleration and settle — the shape a real breath has. */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
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
      completedBreaths: 0,
    }
  }

  const completedBreaths = Math.floor(elapsedSeconds / total)
  let offset = elapsedSeconds - completedBreaths * total

  for (const phase of ORDER) {
    const duration = pattern[phase]
    if (duration <= 0) continue

    if (offset < duration) {
      const phaseProgress = offset / duration
      return {
        phase,
        phaseProgress,
        phaseRemaining: Math.max(1, Math.ceil(duration - offset)),
        expansion: expansionFor(phase, phaseProgress),
        completedBreaths,
      }
    }
    offset -= duration
  }

  // Floating point can land a hair past the end of the last phase.
  return {
    phase: 'holdOut',
    phaseProgress: 1,
    phaseRemaining: 1,
    expansion: 0,
    completedBreaths,
  }
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

/** Phases in this pattern that actually take time, in order. */
export function activePhases(pattern: BreathPattern): BreathPhase[] {
  return ORDER.filter((phase) => pattern[phase] > 0)
}
