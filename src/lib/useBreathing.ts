import { useCallback, useEffect, useRef, useState } from 'react'
import {
  breathStateAt,
  cycleSeconds,
  isPatternValid,
  PHASE_LABEL,
  type BreathPattern,
  type BreathPhase,
} from './breathing'
import { cue } from './feedback'
import { useReducedMotion } from './motion'

export interface BreathingRuntime {
  /** Attach to the element the orb scales inside; receives the `--e` variable. */
  stageRef: React.RefObject<HTMLDivElement | null>
  phase: BreathPhase
  label: string
  /** Whole seconds left in this phase. */
  remaining: number
  breaths: number
  active: boolean
}

interface Options {
  pattern: BreathPattern
  /** False pauses the clock exactly where it is. */
  active: boolean
  soundCues: boolean
  hapticCues: boolean
}

/**
 * Drives the breathing guide.
 *
 * The expansion value is written straight onto a CSS custom property every
 * frame rather than through React state — sixty re-renders a second would make
 * a phone warm for no reason, and the whole point of this thing is that it is
 * smooth. React only hears about phase and second changes.
 */
export function useBreathing({
  pattern,
  active,
  soundCues,
  hapticCues,
}: Options): BreathingRuntime {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()

  // Seconds banked from previous runs, plus when the current run started.
  const bankedRef = useRef(0)
  const startedAtRef = useRef(0)
  const frameRef = useRef(0)
  const lastPhaseRef = useRef<BreathPhase | null>(null)

  const [display, setDisplay] = useState({
    phase: 'inhale' as BreathPhase,
    remaining: Math.max(1, Math.ceil(pattern.inhale)),
    breaths: 0,
  })

  const valid = isPatternValid(pattern)

  const write = useCallback((expansion: number) => {
    stageRef.current?.style.setProperty('--e', expansion.toFixed(4))
  }, [])

  // Restart the cycle whenever the pattern itself changes.
  useEffect(() => {
    bankedRef.current = 0
    startedAtRef.current = performance.now()
    lastPhaseRef.current = null
  }, [pattern.inhale, pattern.holdIn, pattern.exhale, pattern.holdOut])

  useEffect(() => {
    if (!valid) return

    if (!active) {
      // Bank the elapsed time so resuming continues mid-breath.
      if (startedAtRef.current > 0) {
        bankedRef.current += (performance.now() - startedAtRef.current) / 1000
        startedAtRef.current = 0
      }
      cancelAnimationFrame(frameRef.current)
      return
    }

    startedAtRef.current = performance.now()
    const total = cycleSeconds(pattern)

    const step = () => {
      const elapsed =
        bankedRef.current + (performance.now() - startedAtRef.current) / 1000
      const state = breathStateAt(pattern, elapsed)

      if (!reducedMotion) write(state.expansion)

      if (state.phase !== lastPhaseRef.current) {
        const previous = lastPhaseRef.current
        lastPhaseRef.current = state.phase

        // Never fire a cue for the phase we happened to mount inside.
        if (previous !== null && (soundCues || hapticCues)) {
          cue(
            state.phase === 'inhale'
              ? 'inhale'
              : state.phase === 'exhale'
                ? 'exhale'
                : 'hold',
          )
        }
      }

      setDisplay((current) =>
        current.phase === state.phase &&
        current.remaining === state.phaseRemaining &&
        current.breaths === state.completedBreaths
          ? current
          : {
              phase: state.phase,
              remaining: state.phaseRemaining,
              breaths: state.completedBreaths,
            },
      )

      frameRef.current = requestAnimationFrame(step)
    }

    // Reduced motion still needs the labels and countdown, just not the scaling.
    if (reducedMotion) {
      write(0.55)
      const interval = window.setInterval(step, 250)
      return () => window.clearInterval(interval)
    }

    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
    // `total` is included so a pattern edit restarts the loop cleanly.
    void total
  }, [active, valid, pattern, reducedMotion, soundCues, hapticCues, write])

  // Settle the orb closed when the guide is switched off entirely.
  useEffect(() => {
    if (!active && !reducedMotion) write(0)
  }, [active, reducedMotion, write])

  return {
    stageRef,
    phase: display.phase,
    label: PHASE_LABEL[display.phase],
    remaining: display.remaining,
    breaths: display.breaths,
    active: active && valid,
  }
}
