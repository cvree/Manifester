/**
 * Growing the player's stage into the whole screen, and bringing it back.
 *
 * The rule this is built on: it is the same element throughout. Nothing is
 * portalled, cloned or re-mounted, so the session, the timer, the pass count,
 * the breath and the audio carry on without ever learning that the box around
 * them changed shape. Expanded mode is a class on the stage and a tween on its
 * rectangle — that is the whole of it.
 *
 * The tween is here because CSS cannot do this part: a box cannot be
 * transitioned out of a grid cell and into `position: fixed`, since `position`
 * is not an animatable property. So the stage's rectangle is measured before
 * the class changes and again after, and GSAP travels between the two — the
 * classic first/last/invert/play, with the same easing on the way out as on
 * the way back. Everything *inside* the box is transitioned in CSS on the same
 * clock, so the orb, the words and the controls arrive together with the edges.
 *
 * Three ways out, and they all end in the same place:
 *
 *   - the collapse control, which is the same button that expanded it;
 *   - Escape;
 *   - leaving browser fullscreen by any means the browser offers.
 */

import gsap from 'gsap'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { isLowPowerDevice, prefersReducedMotion, useReducedMotion } from './motion'

/**
 * Slow enough to read as one continuous movement, short enough that it never
 * stands between someone and the control they were reaching for. Kept in step
 * with `--stage-travel` in `theme.css`, which carries the inside of the box.
 */
const STAGE_TRAVEL_SECONDS = 0.62

/** Everything the travel writes on the stage, and nothing else. */
const TWEENED = 'position,zIndex,top,left,right,bottom,width,height,margin'

/**
 * Move the stage from the rectangle it was in to the one the stylesheet now
 * says it should be in.
 *
 * `from` has to have been measured before the styles changed — this cannot
 * do it, because by the time it is called the new layout is already in force.
 * Anything a half-finished travel left inline is cleared *before* the
 * destination is read: otherwise the rectangle read as the destination is the
 * one the last travel was passing through, and a quick double-tap folds the
 * stage into whatever shape it happened to be in.
 */
function travel(
  stage: HTMLElement,
  from: DOMRect,
  duration: number,
  onComplete?: () => void,
) {
  gsap.killTweensOf(stage)
  gsap.set(stage, { clearProps: TWEENED })

  // Reduced motion is a preference; a software-rendered compositor is a
  // constraint. Either way the honest answer is the same one already used
  // for it elsewhere: hold still, and let the destination arrive without a
  // journey rather than run one on hardware — or a setting — that cannot be
  // trusted to carry it smoothly.
  if (prefersReducedMotion() || isLowPowerDevice()) {
    onComplete?.()
    return
  }

  const to = stage.getBoundingClientRect()
  gsap.set(stage, { position: 'fixed', zIndex: 42, margin: 0 })
  gsap.fromTo(
    stage,
    { top: from.top, left: from.left, width: from.width, height: from.height },
    {
      top: to.top,
      left: to.left,
      width: to.width,
      height: to.height,
      duration,
      // Eased at both ends: it leaves from rest and arrives at rest, which is
      // what makes it read as breathing out rather than as a panel being
      // thrown open.
      ease: 'power2.inOut',
      clearProps: TWEENED,
      onComplete,
    },
  )
}

interface StageExpansionOptions {
  expanded: boolean
  onChange: (expanded: boolean) => void
  /**
   * False when there is no stage to expand — the completion card takes its
   * place, and anything still expanded folds itself away.
   */
  available?: boolean
}

interface StageExpansion {
  /** The element that grows: the stage itself. */
  stageRef: RefObject<HTMLElement | null>
  /** Its place in the page, held open while the stage is lifted out of flow. */
  slotRef: RefObject<HTMLDivElement | null>
  /** Expand it, or bring it back. One control does both. */
  toggle: () => void
  /**
   * True on a reduced-motion preference or a renderer that cannot be trusted
   * with the trip. The caller adds it as a class (`.stage--instant`) so the
   * CSS transitions on the inside of the box agree with the GSAP tween
   * `travel()` is already skipping for the same reason.
   */
  instant: boolean
}

export function useStageExpansion({
  expanded,
  onChange,
  available = true,
}: StageExpansionOptions): StageExpansion {
  const stageRef = useRef<HTMLElement | null>(null)
  const slotRef = useRef<HTMLDivElement | null>(null)

  // Where the stage stood a moment ago, and how much room it was taking.
  const fromRect = useRef<DOMRect | null>(null)
  const slotHeight = useRef(0)

  // Only exit the fullscreen we asked for. If someone was already there — F11,
  // a kiosk, a presentation — collapsing the stage is not a reason to leave.
  const ownsFullscreen = useRef(false)

  // Where the page behind was, and whether this hook is the one holding it.
  const locked = useRef(false)
  const scrollY = useRef(0)

  const changeRef = useRef(onChange)
  useEffect(() => {
    changeRef.current = onChange
  }, [onChange])

  const change = useCallback((next: boolean) => {
    const stage = stageRef.current
    const slot = slotRef.current
    if (stage) fromRect.current = stage.getBoundingClientRect()
    if (next) {
      // Both measured before the class lands, and neither can be measured
      // after it: the slot still has the stage in it — or, mid-flight, is
      // still holding the height it had then — and the page has not yet been
      // clamped to the top by having its tallest element lifted out of it.
      if (slot) slotHeight.current = slot.offsetHeight
      scrollY.current = window.scrollY
    }
    changeRef.current(next)
  }, [])

  const expand = useCallback(() => {
    /*
     * Real fullscreen where the browser offers it: the point of expanding is
     * to be left alone with the words, and a tab strip is not that. It is
     * asked for on the document rather than on the stage so the Cosmic Garden
     * behind it comes too — fullscreening the stage alone would take the orb
     * out of its own sky. iOS has no element fullscreen at all, so this
     * quietly does nothing there and the layer below does all the work.
     *
     * It is asked for *before* the stage itself changes, and the travel does
     * not start until the browser has settled into it one way or the other.
     * Entering fullscreen is its own viewport-resizing transition; starting
     * our own animation on the same tick means two compositor-heavy changes
     * landing on the same frame, and on a renderer already leaning on
     * software work that has been enough to bring the tab down. Waiting the
     * one request out costs at most the time the browser's own fullscreen
     * transition already takes, and buys a stage that only ever travels
     * through a viewport that has already finished changing shape.
     */
    const root = document.documentElement
    const canRequestFullscreen =
      !document.fullscreenElement && typeof root.requestFullscreen === 'function'

    if (!canRequestFullscreen) {
      change(true)
      return
    }

    root
      .requestFullscreen()
      .then(() => {
        ownsFullscreen.current = true
        change(true)
      })
      .catch(() => {
        // Blocked, dismissed, or unsupported here. Expanding is still worth
        // doing without it.
        change(true)
      })
  }, [change])

  const collapse = useCallback(() => {
    // Escape is handled below both by our own listener and, natively, by the
    // browser leaving fullscreen — which can call back in here a second time
    // for the same press. Once collapsed, a second call is a no-op.
    if (!expanded) return

    if (ownsFullscreen.current && document.fullscreenElement) {
      ownsFullscreen.current = false
      // Left exactly as it was entered: fullscreen settles first, and only
      // then does the stage travel, so the two transitions never overlap.
      const exit = document.exitFullscreen?.bind(document)
      if (exit) {
        void exit()
          .catch(() => {})
          .finally(() => change(false))
        return
      }
    }
    change(false)
  }, [expanded, change])

  const toggle = useCallback(() => {
    if (expanded) collapse()
    else expand()
  }, [expanded, expand, collapse])

  /*
   * `travel()` already skips the GSAP tween on a preference or a renderer
   * that cannot be trusted with it, but that leaves the *interior* of the
   * box — the padding, the radius, the glass, the orb's own `--size` — still
   * easing over the same 620ms in plain CSS, since those transitions are
   * always on. `instant` is the other half of that same decision, for the
   * caller to add as a class (`.stage--instant`) so both halves of the stage
   * agree about whether this is a journey or a jump.
   */
  const [lowPower] = useState(isLowPowerDevice)
  const instant = useReducedMotion() || lowPower

  /* ── The travel ── */

  useLayoutEffect(() => {
    const stage = stageRef.current
    const slot = slotRef.current
    const from = fromRect.current
    fromRect.current = null

    /*
     * The page behind does not scroll while the stage is the screen. Hiding
     * its overflow is what stops it, and that also throws the scroll offset
     * away — so the offset recorded above is handed straight back here,
     * *before* the stage is measured. After would be too late: the
     * destination would be read against a page sitting at the top, and the
     * stage would come to rest a screenful from where it left.
     */
    if (expanded && !locked.current) {
      locked.current = true
      document.body.setAttribute('data-scroll-locked', '')
    } else if (!expanded && locked.current) {
      locked.current = false
      document.body.removeAttribute('data-scroll-locked')
      window.scrollTo(0, scrollY.current)
    }

    // Hold the stage's place in the page while it is away, so the column
    // beside it and the height of the page itself stay as they were.
    if (slot && expanded) slot.style.height = `${slotHeight.current}px`

    const release = () => {
      if (slot && !expanded) slot.style.height = ''
    }

    // Nothing to travel from on the first render, or when the stage has just
    // been replaced by the completion card.
    if (!stage || !from) {
      release()
      return
    }

    travel(stage, from, STAGE_TRAVEL_SECONDS, release)
  }, [expanded])

  /* ── The ways out ── */

  useEffect(() => {
    if (!expanded) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      collapse()
    }

    const onFullscreenChange = () => {
      /*
       * Leaving fullscreen by the browser's own means — Escape, F11, the
       * toolbar — has to bring the layout back with it, or the page is left
       * wearing a full-screen player inside a normal window.
       */
      if (!document.fullscreenElement && ownsFullscreen.current) collapse()
    }

    /*
     * Entering fullscreen moves the goalposts: the viewport grows by however
     * much browser chrome went away, and a travel already in flight was aimed
     * at the old one. Turning a phone on its side does the same thing. So a
     * travel that is still going is aimed again, from wherever the stage has
     * got to; one that has already landed needs nothing, because by then the
     * stylesheet is holding the stage rather than any inline geometry.
     */
    const onResize = () => {
      const stage = stageRef.current
      if (stage && gsap.isTweening(stage)) {
        travel(stage, stage.getBoundingClientRect(), 0.3)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      window.removeEventListener('resize', onResize)
    }
  }, [expanded, collapse])

  useEffect(() => {
    if (!available && expanded) collapse()
  }, [available, expanded, collapse])

  // Navigating away mid-session leaves nothing behind: no locked page, no
  // fullscreen, and a shell that knows the stage has gone.
  useEffect(
    () => () => {
      if (ownsFullscreen.current && document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {})
      }
      ownsFullscreen.current = false
      if (locked.current) {
        locked.current = false
        document.body.removeAttribute('data-scroll-locked')
      }
      changeRef.current(false)
    },
    [],
  )

  return { stageRef, slotRef, toggle, instant }
}
