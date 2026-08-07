import { useCallback, useEffect, useRef, useState } from 'react'
import {
  breathStateAt,
  cycleSeconds,
  isPatternValid,
  PHASE_LABEL,
  type BreathPattern,
  type BreathPhase,
} from './breathing'
import {
  findVoice,
  liveBreathVoice,
  primeBreathAudio,
  type BreathSound,
} from './breathAudio'
import { haptic } from './feedback'
import { useReducedMotion } from './motion'

export interface BreathingRuntime {
  /**
   * Attach to the element the orb scales inside. It receives two custom
   * properties every frame: `--e` (expansion) and `--p` (phase progress).
   */
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
  /** Which breath voice to sound, or `'off'`. */
  sound: BreathSound
  soundVolume: number
  hapticCues: boolean
}

/**
 * Drives the breathing guide.
 *
 * The expansion value is written straight onto a CSS custom property every
 * frame rather than through React state — sixty re-renders a second would make
 * a phone warm for no reason, and the whole point of this thing is that it is
 * smooth. React only hears about phase and second changes.
 *
 * Sound is handled the other way about: instead of nudging the audio each
 * frame, the whole phase is handed to the audio clock the moment it begins.
 * See `breathAudio` for why that is the arrangement that stays in step.
 */
export function useBreathing({
  pattern,
  active,
  sound,
  soundVolume,
  hapticCues,
}: Options): BreathingRuntime {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()

  // Seconds banked from previous runs, plus when the current run started.
  const bankedRef = useRef(0)
  const startedAtRef = useRef(0)
  const frameRef = useRef(0)
  const lastPhaseRef = useRef<BreathPhase | null>(null)

  /*
   * Live values the loop reads but must never be restarted by. Turning the
   * volume down mid-session should move a fader, not begin the breath again.
   */
  const volumeRef = useRef(soundVolume)
  const hapticsRef = useRef(hapticCues)
  volumeRef.current = soundVolume
  hapticsRef.current = hapticCues

  const [display, setDisplay] = useState({
    phase: 'inhale' as BreathPhase,
    remaining: Math.max(1, Math.ceil(pattern.inhale)),
    breaths: 0,
  })

  const valid = isPatternValid(pattern)
  const audible = sound !== 'off'

  const write = useCallback((expansion: number, progress = 0) => {
    const stage = stageRef.current
    if (!stage) return
    stage.style.setProperty('--e', expansion.toFixed(4))
    stage.style.setProperty('--p', progress.toFixed(4))
  }, [])

  // Restart the cycle whenever the pattern itself changes.
  useEffect(() => {
    bankedRef.current = 0
    startedAtRef.current = performance.now()
    lastPhaseRef.current = null
  }, [pattern.inhale, pattern.holdIn, pattern.exhale, pattern.holdOut])

  // Keep the live voice's level in step with the slider while it plays.
  useEffect(() => {
    if (!audible) return
    liveBreathVoice()?.setVolume(soundVolume)
  }, [audible, soundVolume])

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

    // The guide's own voice, open for as long as this run lasts.
    const voice = audible ? liveBreathVoice() : null
    if (voice) {
      voice.setVoice(sound)
      voice.setVolume(volumeRef.current)
      voice.start()
    }
    const sustained = findVoice(sound)?.sustained ?? false

    const tick = () => {
      const elapsed =
        bankedRef.current + (performance.now() - startedAtRef.current) / 1000
      const state = breathStateAt(pattern, elapsed)

      // Reduced motion keeps the phase ring, which conveys progress without
      // anything moving fast, but not the scaling.
      write(reducedMotion ? 0.55 : state.expansion, state.phaseProgress)

      if (state.phase !== lastPhaseRef.current) {
        const previous = lastPhaseRef.current
        lastPhaseRef.current = state.phase
        const duration = pattern[state.phase]

        if (previous === null) {
          /*
           * The phase we happened to start inside. A sustained voice still has
           * to be placed correctly — resuming into the middle of an out-breath
           * should sound like an out-breath — but a struck one waits for a
           * real turn rather than ringing a bell late.
           */
          if (voice && sustained) {
            voice.phase(state.phase, duration * (1 - state.phaseProgress))
          }
        } else {
          if (voice) {
            /*
             * A browser suspends the whole audio context when the page is
             * backgrounded. Waking it at the turn of a breath is both the
             * cheapest place to check and the first moment it matters.
             */
            primeBreathAudio()
            voice.phase(state.phase, duration)
          }
          if (hapticsRef.current) {
            haptic(
              state.phase === 'inhale'
                ? 'inhale'
                : state.phase === 'exhale'
                  ? 'exhale'
                  : 'hold',
            )
          }
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
    }

    /*
     * Reduced motion still needs the words, the countdown and the sound — just
     * not sixty scaling frames a second. A quarter-second tick serves all
     * three, and no animation frame is ever requested.
     */
    if (reducedMotion) {
      write(0.55, 0)
      tick()
      const interval = window.setInterval(tick, 250)
      return () => {
        window.clearInterval(interval)
        voice?.stop()
      }
    }

    const loop = () => {
      tick()
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frameRef.current)
      voice?.stop()
    }
    // `total` is included so a pattern edit restarts the loop cleanly.
    void total
  }, [active, audible, pattern, reducedMotion, sound, valid, write])

  // Settle the orb to a resting half-open pose when the guide is switched off,
  // rather than collapsing it to nothing — a closed orb reads as broken.
  useEffect(() => {
    if (!active && !reducedMotion) write(0.35, 0)
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
