/**
 * Waking the room, and letting it go quiet again.
 *
 * There are two numbers behind the background visualiser and keeping them
 * apart is the whole architecture:
 *
 *   - **the breath**, written by `useBreathing` every frame — `--e`, `--p`,
 *     `--m` and the two lagged samples. This hook never touches any of them.
 *   - **the mix**, written here — how much of itself the environment is
 *     currently showing, `0` to `1`.
 *
 * Every environmental calculation in `theme.css` is the product of the two, so
 * switching the visualiser on halfway through an in-breath cannot restart,
 * jump or desynchronise anything: the breath carries straight on at whatever
 * value it was already at, and the room fades *in at that value*. There is no
 * moment where the environment is at the start of a breath the person is not
 * at, because the environment has no idea where the start of a breath is.
 *
 * The mix is four numbers rather than one so the room can wake in the order a
 * room wakes in — ground light, then colour, then the fine points, then the
 * depth around the edges — and settle in the reverse. That is the only reason
 * GSAP is here: the timing of a reveal, which is exactly what it is for, and
 * emphatically not a second opinion about the breath.
 */

import gsap from 'gsap'
import { useEffect, useRef, type RefObject } from 'react'

/** The four bands, weakest-to-hold-still first. */
interface Mix {
  /** The ground light: the breathing field, the warm wash, the echo. */
  master: number
  /** Colour: the aurora clouds and the haze planes. */
  cloud: number
  /** The points of light. */
  mote: number
  /** Depth: the horizon and the vignette. */
  depth: number
}

const OFF: Mix = { master: 0, cloud: 0, mote: 0, depth: 0 }

const VARIABLES: Record<keyof Mix, string> = {
  master: '--mix',
  cloud: '--mix-cloud',
  mote: '--mix-mote',
  depth: '--mix-depth',
}

const KEYS = Object.keys(VARIABLES) as Array<keyof Mix>

interface Options {
  /** Whether the environment should be present at all. */
  enabled: boolean
  /**
   * Everything that reads the mix. The atmosphere itself, and the stage —
   * which is not a descendant of it, and whose own pool of light has to agree
   * with the light beyond the glass.
   */
  targets: ReadonlyArray<RefObject<HTMLElement | null>>
  /**
   * A reveal is still a reveal with reduced motion on; it is simply a fade,
   * over less time, with nothing arriving in stages.
   */
  reducedMotion: boolean
}

export function useBackgroundMix({ enabled, targets, reducedMotion }: Options) {
  /*
   * The live value, held in a ref rather than in state. It is read on the
   * first frame of a new tween so that reversing mid-reveal continues from
   * wherever the room had got to instead of snapping to an end it never
   * reached — switch the setting off and on twice in a second and the light
   * simply changes its mind, which is what light does.
   */
  const mix = useRef<Mix>({ ...OFF })
  const targetsRef = useRef(targets)
  targetsRef.current = targets

  // Whether anything has been drawn yet. Opening the player with the
  // visualiser already on is not an awakening — the room was simply there.
  const first = useRef(true)

  useEffect(() => {
    const flush = () => {
      const { current } = mix
      for (const target of targetsRef.current) {
        const node = target.current
        if (!node) continue
        for (const key of KEYS) {
          node.style.setProperty(VARIABLES[key], current[key].toFixed(4))
        }
      }
    }

    if (first.current) {
      first.current = false
      mix.current = enabled ? { master: 1, cloud: 1, mote: 1, depth: 1 } : { ...OFF }
      flush()
      return
    }

    if (reducedMotion) {
      const tween = gsap.to(mix.current, {
        ...(enabled ? { master: 1, cloud: 1, mote: 1, depth: 1 } : OFF),
        duration: 0.42,
        ease: 'none',
        onUpdate: flush,
      })
      return () => {
        tween.kill()
      }
    }

    const timeline = gsap.timeline({ onUpdate: flush })

    if (enabled) {
      /*
       * About 1.2 seconds, and the order is the argument.
       *
       * The ground light comes up first and alone, so for a quarter of a
       * second the only change is that the room got deeper. Colour follows it,
       * then the points of light, then the depth at the edges — each one
       * overlapping the last, so no band ever arrives on its own beat. Nothing
       * here starts from a breath of its own: every layer enters already at
       * whatever the breath's current value says it should be.
       */
      timeline
        .to(mix.current, { master: 1, duration: 0.62, ease: 'power2.out' }, 0.05)
        .to(mix.current, { cloud: 1, duration: 0.55, ease: 'power2.out' }, 0.28)
        .to(mix.current, { mote: 1, duration: 0.62, ease: 'power1.out' }, 0.5)
        .to(mix.current, { depth: 1, duration: 0.66, ease: 'power2.out' }, 0.62)
    } else {
      /*
       * And about a second back the other way, in reverse order: the points go
       * first, then the colour, then the light, and the vignette is the last
       * thing to lift — so what is left at the end is the ordinary player, and
       * the way it got there was the room going quiet rather than an effect
       * being switched off.
       */
      timeline
        .to(mix.current, { mote: 0, duration: 0.38, ease: 'power1.in' }, 0)
        .to(mix.current, { cloud: 0, duration: 0.52, ease: 'power2.inOut' }, 0.16)
        .to(mix.current, { master: 0, duration: 0.58, ease: 'power2.inOut' }, 0.3)
        .to(mix.current, { depth: 0, duration: 0.6, ease: 'power2.inOut' }, 0.42)
    }

    return () => {
      timeline.kill()
    }
  }, [enabled, reducedMotion])

  /*
   * A target that mounts after the mix has settled — the stage coming back
   * when a completed session is played again — would otherwise be handed
   * nothing and sit at the initial value of every property, which is zero.
   */
  useEffect(() => {
    for (const target of targets) {
      const node = target.current
      if (!node) continue
      for (const key of KEYS) {
        node.style.setProperty(VARIABLES[key], mix.current[key].toFixed(4))
      }
    }
  })
}
