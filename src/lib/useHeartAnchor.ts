import { useEffect, type RefObject } from 'react'

/**
 * Where the room's heart is.
 *
 * The atmosphere used to guess: `--heart-x: 50%`, `--heart-y: 44%`, and a
 * hand-written `38%` on desktop because the stage is the left column of a
 * two-column grid there. Every one of those numbers was right for exactly one
 * window size, and everywhere else the light gathered somewhere the orb was
 * not — which is the difference between a room the orb is breathing in and a
 * gradient the orb happens to be near.
 *
 * So nothing is guessed now. The orb is measured, and its centre and radius
 * are written onto the field as lengths. Every layer in `theme.css` was
 * already drawn around `--heart-x`/`--heart-y`, so the whole environment —
 * the wash, the fields, the rings, the curtains, the vignette — re-centres on
 * the real orb without a single one of them learning that it moved.
 *
 * `--halo` is the third number, and it is what keeps the room *behind* the
 * orb: it is the orb's own radius, and the scene's figures (rings, curtains,
 * stars, the waterline) are masked out inside it. See `.player-scene__figures`.
 *
 * ── What it costs ──
 *
 * A `getBoundingClientRect` on one element, and only when something could
 * plausibly have moved it: a resize of the orb (which the registered `--size`
 * transition fires every frame as the stage expands, for free), a scroll, a
 * viewport change, or a bounded frame loop after whatever the caller passes as
 * `watch` changes. Never a per-frame read alongside the breath — a layout
 * flush on every frame of an animation is exactly the cost this app spends its
 * whole stylesheet avoiding.
 */

/**
 * How long to keep watching after the layout has been told to change. The
 * stage's own travel is 620ms (`useStageExpansion`); this clears it with room
 * to spare, and then stops.
 */
const SETTLE_MS = 1000

/** Below this, a move is not worth a style write. */
const EPSILON = 0.5

export function useHeartAnchor(
  /** The orb itself — the thing the room is gathered around. */
  orbRef: RefObject<HTMLElement | null>,
  /** Everything that needs to know where it is. Must be stable across renders. */
  targets: Array<RefObject<HTMLElement | null>>,
  /** Anything that changes the layout around the orb, e.g. expanded mode. */
  watch?: unknown,
) {
  useEffect(() => {
    let frame = 0
    let until = 0
    let lastX = Number.NaN
    let lastY = Number.NaN
    let lastR = Number.NaN

    const measure = () => {
      const orb = orbRef.current
      if (!orb) return

      const rect = orb.getBoundingClientRect()
      // Mid-mount, or hidden: nothing to say, and last frame's answer is a
      // better one than the middle of the screen.
      if (rect.width < 1 || rect.height < 1) return

      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const radius = Math.min(rect.width, rect.height) / 2

      if (
        Math.abs(x - lastX) < EPSILON &&
        Math.abs(y - lastY) < EPSILON &&
        Math.abs(radius - lastR) < EPSILON
      ) {
        return
      }

      lastX = x
      lastY = y
      lastR = radius

      for (const target of targets) {
        const node = target.current
        if (!node) continue
        node.style.setProperty('--heart-x', `${x.toFixed(1)}px`)
        node.style.setProperty('--heart-y', `${y.toFixed(1)}px`)
        node.style.setProperty('--halo', `${radius.toFixed(1)}px`)
      }
    }

    /** Watch for a while, then stop. Overlapping calls extend the window. */
    const follow = (duration: number) => {
      until = Math.max(until, performance.now() + duration)
      if (frame) return
      const step = () => {
        measure()
        frame = performance.now() < until ? requestAnimationFrame(step) : 0
      }
      frame = requestAnimationFrame(step)
    }

    measure()
    follow(SETTLE_MS)

    /*
     * The orb's box is a registered custom property under a transition, so
     * this fires on every frame of a growth and nothing has to know how long
     * one takes. Position-only moves are what the frame loop above is for.
     */
    const observer = new ResizeObserver(() => follow(120))
    if (orbRef.current) observer.observe(orbRef.current)

    const nudge = () => follow(120)
    window.addEventListener('scroll', nudge, { passive: true, capture: true })
    window.addEventListener('resize', nudge, { passive: true })
    window.visualViewport?.addEventListener('resize', nudge, { passive: true })
    window.visualViewport?.addEventListener('scroll', nudge, { passive: true })

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', nudge, { capture: true })
      window.removeEventListener('resize', nudge)
      window.visualViewport?.removeEventListener('resize', nudge)
      window.visualViewport?.removeEventListener('scroll', nudge)
    }
  }, [orbRef, targets, watch])
}
