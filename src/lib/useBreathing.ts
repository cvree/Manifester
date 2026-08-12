import { useCallback, useEffect, useRef, useState } from 'react'
import {
  breathStateAt,
  expansionAt,
  isPatternValid,
  PHASE_LABEL,
  type BreathPattern,
  type BreathPhase,
} from './breathing'
import { breathElapsed, subscribeBreath } from './breathEngine'
import { BREATH_LAG_SECONDS } from './environment'
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

/** Anything else that should receive the breath on the very same frame. */
type Mirrors = ReadonlyArray<React.RefObject<HTMLElement | null>>

/**
 * Half-open and perfectly still. Every value the same, because a pose has no
 * front and back — nothing is travelling outward through the room.
 */
const RESTING_POSE: BreathFrame = { e: 0.35, p: 0, m: 0, mid: 0.35, far: 0.35 }

/** The same idea a little more open, for a guide someone has asked to hold still. */
const REDUCED_POSE: BreathFrame = { e: 0.55, p: 0, m: 0, mid: 0.55, far: 0.55 }

/**
 * Write the breath onto the elements that answer to it.
 *
 * `mirror: false` writes the orb alone. Used for the resting pose, which is a
 * jump rather than a movement — the breath stops and the guide settles
 * half-open at once. On a 15rem orb that reads as settling; across a whole
 * viewport of atmosphere it would read as a flinch. So the environment is left
 * holding the value it had, and the amplitude it is multiplied by (`--field`,
 * in `theme.css`) eases to nothing instead. Same destination, and nothing
 * lurches to get there.
 */
function useWriter(
  stageRef: React.RefObject<HTMLDivElement | null>,
  mirrors: Mirrors | undefined,
) {
  const mirrorsRef = useRef(mirrors)
  mirrorsRef.current = mirrors

  return useCallback(
    (frame: BreathFrame, mirror = true) => {
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
    },
    [stageRef],
  )
}

interface DrawOptions {
  pattern: BreathPattern
  active: boolean
  reducedMotion: boolean
  elapsed: () => number
  write: (frame: BreathFrame, mirror?: boolean) => void
  onFrame?: (phase: BreathPhase, remaining: number, breaths: number) => void
}

/**
 * The picture, and nothing but.
 *
 * It draws while the page is visible and stops while it is not, because
 * `requestAnimationFrame` does exactly that and it is the right behaviour for
 * something nobody can see. Every value it draws is derived from a clock it
 * does not own, so stopping and starting costs precisely nothing: the next
 * frame after a tab comes back is simply the correct frame.
 */
function useDraw({
  pattern,
  active,
  reducedMotion,
  elapsed,
  write,
  onFrame,
}: DrawOptions): void {
  const frameRef = useRef(0)
  const elapsedRef = useRef(elapsed)
  const onFrameRef = useRef(onFrame)
  elapsedRef.current = elapsed
  onFrameRef.current = onFrame

  const valid = isPatternValid(pattern)

  useEffect(() => {
    if (!valid || !active) return

    const tick = () => {
      const seconds = elapsedRef.current()
      const state = breathStateAt(pattern, seconds)

      if (reducedMotion) {
        // The phase ring still turns: it reports progress without anything
        // moving fast, which is the one piece of motion worth keeping here.
        write({ ...REDUCED_POSE, p: state.phaseProgress })
      } else {
        /*
         * The two extra samples are the room's sense of distance: the same
         * curve, read a fraction of a second earlier, so an in-breath appears
         * to travel outward from the orb rather than land everywhere at once.
         */
        write({
          e: state.expansion,
          p: state.phaseProgress,
          m: state.motion,
          mid: expansionAt(pattern, seconds - BREATH_LAG_SECONDS.mid),
          far: expansionAt(pattern, seconds - BREATH_LAG_SECONDS.far),
        })
      }

      onFrameRef.current?.(
        state.phase,
        state.phaseRemaining,
        state.completedBreaths,
      )
    }

    /*
     * Reduced motion still needs the words and the countdown — just not sixty
     * scaling frames a second. A quarter-second tick serves both, and no
     * animation frame is ever requested.
     */
    if (reducedMotion) {
      write(REDUCED_POSE)
      tick()
      const interval = window.setInterval(tick, 250)
      return () => window.clearInterval(interval)
    }

    const loop = () => {
      tick()
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameRef.current)
  }, [active, pattern, reducedMotion, valid, write])

  // Settle the orb to a resting half-open pose when the guide is switched off,
  // rather than collapsing it to nothing — a closed orb reads as broken.
  useEffect(() => {
    if (!active && !reducedMotion) write(RESTING_POSE, false)
  }, [active, reducedMotion, write])
}

/* ── The guide you are following ────────────────────────────── */

/**
 * The live guide, read from the session's breath engine.
 *
 * It owns nothing. The clock, the voice, the phase turns and the haptics all
 * live in `breathEngine`, which is not mounted anywhere and therefore cannot
 * be unmounted by walking to another tab. This hook draws the picture and
 * reports the words, and both of those are allowed to stop when nobody is
 * looking at them.
 */
export function useSessionBreathing({
  pattern,
  active,
  mirrors,
}: PreviewOptions): BreathingRuntime {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()
  const write = useWriter(stageRef, mirrors)

  /*
   * The pattern and the switch are passed in rather than read back out of the
   * engine, and they are the same two values the session hands the engine. Two
   * readers of one source cannot disagree; a reader and a writer, one render
   * apart, can — and would show a breath the sound was no longer following.
   */
  const running = active && isPatternValid(pattern)

  const [display, setDisplay] = useState(() => {
    const state = breathStateAt(pattern, breathElapsed())
    return {
      phase: state.phase,
      remaining: state.phaseRemaining,
      breaths: state.completedBreaths,
    }
  })


  const report = useCallback(
    (phase: BreathPhase, remaining: number, breaths: number) => {
      setDisplay((current) =>
        current.phase === phase &&
        current.remaining === remaining &&
        current.breaths === breaths
          ? current
          : { phase, remaining, breaths },
      )
    },
    [],
  )

  useDraw({
    pattern,
    active: running,
    reducedMotion,
    elapsed: breathElapsed,
    write,
    onFrame: report,
  })

  /*
   * Frames are not the only way to hear about a turn, and deliberately: the
   * engine announces every one of them whether or not this page is drawing. So
   * the moment a hidden tab comes back the label already says the right thing,
   * rather than saying the wrong thing until the next frame lands.
   */
  useEffect(() => {
    return subscribeBreath(({ phase, breaths }) => {
      setDisplay((current) =>
        current.phase === phase && current.breaths === breaths
          ? current
          : { ...current, phase, breaths },
      )
    })
  }, [])

  return {
    stageRef,
    phase: display.phase,
    label: PHASE_LABEL[display.phase],
    remaining: display.remaining,
    breaths: display.breaths,
    active: running,
  }
}

/* ── The guide in a picture of a guide ──────────────────────── */

interface PreviewOptions {
  pattern: BreathPattern
  /** False holds the orb still, half open. */
  active: boolean
  mirrors?: Mirrors
}

/**
 * A silent guide for a preview.
 *
 * Create's ritual preview and the breathing settings sheet both show the orb
 * breathing so that what you choose is what you get. Neither of them is the
 * session, so neither of them makes a sound, fires a haptic, or touches the
 * engine the session is running on — which is what keeps flipping through
 * breath styles mid-session from disturbing the breath you are actually
 * following.
 */
export function useBreathing({
  pattern,
  active,
  mirrors,
}: PreviewOptions): BreathingRuntime {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()
  const write = useWriter(stageRef, mirrors)

  // Its own clock, banked exactly like the engine's so that pausing a preview
  // holds it mid-breath rather than resetting it.
  const banked = useRef(0)
  const startedAt = useRef(0)

  const [display, setDisplay] = useState({
    phase: 'inhale' as BreathPhase,
    remaining: Math.max(1, Math.ceil(pattern.inhale)),
    breaths: 0,
  })

  // A new pattern is a new breath, not a continuation of the old one.
  useEffect(() => {
    banked.current = 0
    startedAt.current = performance.now()
  }, [pattern.inhale, pattern.holdIn, pattern.exhale, pattern.holdOut])

  useEffect(() => {
    if (active) {
      startedAt.current = performance.now()
      return () => {
        if (startedAt.current > 0) {
          banked.current += (performance.now() - startedAt.current) / 1000
          startedAt.current = 0
        }
      }
    }
  }, [active])

  const elapsed = useCallback(
    () =>
      startedAt.current > 0
        ? banked.current + (performance.now() - startedAt.current) / 1000
        : banked.current,
    [],
  )

  const report = useCallback(
    (phase: BreathPhase, remaining: number, breaths: number) => {
      setDisplay((current) =>
        current.phase === phase &&
        current.remaining === remaining &&
        current.breaths === breaths
          ? current
          : { phase, remaining, breaths },
      )
    },
    [],
  )

  useDraw({
    pattern,
    active,
    reducedMotion,
    elapsed,
    write,
    onFrame: report,
  })

  return {
    stageRef,
    phase: display.phase,
    label: PHASE_LABEL[display.phase],
    remaining: display.remaining,
    breaths: display.breaths,
    active: active && isPatternValid(pattern),
  }
}
