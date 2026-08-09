import { useCallback, useEffect, useRef, useState } from 'react'
import {
  breathStateAt,
  cycleSeconds,
  expansionAt,
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
import { BREATH_LAG_SECONDS } from './environment'
import { haptic } from './feedback'
import { useReducedMotion } from './motion'

/** What one frame of breath looks like, in the numbers the stylesheet reads. */
interface BreathFrame {
  /** `--e`: expansion here and now, 0 → 1 → 0. */
  e: number
  /** `--p`: progress through the current phase. */
  p: number
  /** `--m`: how much of this phase's movement is happening right now. */
  m: number
  /** `--e-mid`: the same expansion curve, a quarter-second back. */
  mid: number
  /** `--e-far`: and two thirds of a second back. */
  far: number
}

export interface BreathingRuntime {
  /**
   * Attach to the element the orb scales inside. It receives the breath as
   * custom properties every frame — `--e` (expansion) and `--p` (phase
   * progress) chief among them.
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
  /**
   * Anything else that should receive the breath on the very same frame as the
   * orb — the player's stage and the atmosphere behind it.
   *
   * This exists so that "the room breathes too" can never become a second
   * clock. There is one loop, one `breathStateAt` call and one pair of values,
   * written to every element that answers to them; a `setInterval`, a keyframe
   * or a second `requestAnimationFrame` for the background would drift against
   * the orb within a minute and look exactly like what it was.
   *
   * Read through a ref each frame rather than closed over, so passing a fresh
   * array on every render costs nothing and never restarts the breath.
   */
  mirrors?: ReadonlyArray<React.RefObject<HTMLElement | null>>
}

/**
 * Half-open and perfectly still. Every value the same, because a pose has no
 * front and back — nothing is travelling outward through the room.
 */
const RESTING_POSE: BreathFrame = { e: 0.35, p: 0, m: 0, mid: 0.35, far: 0.35 }

/** The same idea a little more open, for a guide someone has asked to hold still. */
const REDUCED_POSE: BreathFrame = { e: 0.55, p: 0, m: 0, mid: 0.55, far: 0.55 }

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
  mirrors,
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
  const mirrorsRef = useRef(mirrors)
  volumeRef.current = soundVolume
  hapticsRef.current = hapticCues
  mirrorsRef.current = mirrors

  const [display, setDisplay] = useState({
    phase: 'inhale' as BreathPhase,
    remaining: Math.max(1, Math.ceil(pattern.inhale)),
    breaths: 0,
  })

  const valid = isPatternValid(pattern)
  const audible = sound !== 'off'

  /**
   * `mirror: false` writes the orb alone.
   *
   * Used for the resting pose, which is a jump rather than a movement — the
   * breath stops and the guide settles half-open at once. On a 15rem orb that
   * reads as settling; across a whole viewport of atmosphere it would read as
   * a flinch. So the environment is left holding the value it had, and the
   * amplitude it is multiplied by (`--field`, in `theme.css`) eases to nothing
   * instead. Same destination, and nothing lurches to get there.
   */
  const write = useCallback((frame: BreathFrame, mirror = true) => {
    const e = frame.e.toFixed(4)
    const p = frame.p.toFixed(4)
    const m = frame.m.toFixed(4)
    const mid = frame.mid.toFixed(4)
    const far = frame.far.toFixed(4)

    const apply = (node: HTMLElement) => {
      node.style.setProperty('--e', e)
      node.style.setProperty('--p', p)
      node.style.setProperty('--m', m)
      node.style.setProperty('--e-mid', mid)
      node.style.setProperty('--e-far', far)
    }

    const stage = stageRef.current
    if (stage) apply(stage)

    /*
     * A handful of `setProperty` calls per mirror per frame, and no more than
     * that: every element written to here is one the stylesheet has already
     * promoted to its own layer, so the browser answers a change with a
     * composite rather than a layout. The style recalculation is one pass
     * whether it is asked two questions or five.
     */
    const extra = mirror ? mirrorsRef.current : null
    if (!extra) return
    for (const target of extra) {
      const node = target.current
      if (node) apply(node)
    }
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
      if (reducedMotion) {
        // The phase ring still turns: it reports progress without anything
        // moving fast, which is the one piece of motion worth keeping here.
        write({ ...REDUCED_POSE, p: state.phaseProgress })
      } else {
        /*
         * The two extra samples are the room's sense of distance: the same
         * curve, read a fraction of a second earlier, so an in-breath appears
         * to travel outward from the orb rather than land everywhere at once.
         * Two more passes over four numbers — cheaper than the `toFixed` calls
         * below it — and, because they are samples rather than a delay line,
         * there is nothing here that can fall out of step.
         */
        write({
          e: state.expansion,
          p: state.phaseProgress,
          m: state.motion,
          mid: expansionAt(pattern, elapsed - BREATH_LAG_SECONDS.mid),
          far: expansionAt(pattern, elapsed - BREATH_LAG_SECONDS.far),
        })
      }

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
      write(REDUCED_POSE)
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
    if (!active && !reducedMotion) write(RESTING_POSE, false)
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
