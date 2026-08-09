/**
 * Keeping the spoken line inside a box that never changes size.
 *
 * The orb is the anchor of the whole screen, and it was moving. In the expanded
 * player the orb and the line it is speaking are centred together in whatever
 * height is left over, so a line that wrapped to two lines instead of one
 * pushed the orb up by half a line — about thirty pixels, every few seconds, on
 * the one screen someone is looking at while trying to be still. In the card
 * the orb held its place but the stage itself grew and shrank underneath it, so
 * every control below the words shifted instead.
 *
 * The fix is that the line's box is a fixed height. That immediately raises the
 * real question, which is what to do with a line too long for it:
 *
 *   - clamp it, and the words — the entire point of the app — get an ellipsis;
 *   - reserve enough height for the longest line anyone could write, and the
 *     orb pays for it on every screen, including the great majority where the
 *     lines are short;
 *   - or set the long line slightly smaller, which is what a person laying this
 *     out by hand would do without thinking about it.
 *
 * So: fixed box, and the type shrinks to meet it. Nothing is ever cut and the
 * orb never moves.
 *
 * Two details make it work rather than merely run.
 *
 * **The width has to be a real length.** It was `32ch`, and `ch` is a multiple
 * of the font size — so shrinking the type shrank the column with it and the
 * line wrapped in exactly the same places, forever. Measured in `rem` the
 * column stays put and smaller type genuinely fits more of it. That one unit is
 * the difference between this converging and it not working at all.
 *
 * **The step is a square root.** Halving the font size roughly halves the
 * height of a line *and* roughly halves the number of lines, so the block's
 * height goes with the square of the scale. Stepping by `A/N` therefore
 * overshoots badly — it lands at 0.5 where 0.7 would have done — and the words
 * end up needlessly small. `sqrt(A/N)` lands within a few percent, and the loop
 * below tidies up what the quantisation into whole lines leaves over.
 *
 * The cost is a handful of forced layout reads each time the line changes,
 * which is a few times a minute. Nothing here runs per frame.
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

/** Below this the words stop being the loudest thing on the screen. */
const MIN_SCALE = 0.55

/** Enough for the line-quantised search to settle; it usually takes two. */
const MAX_PASSES = 5

export function useFittedLine(
  /** The fixed-height box. Its first `.stage__line-text` child is measured. */
  boxRef: RefObject<HTMLElement | null>,
  /** Changes when the words do. */
  line: string | null | undefined,
  /** Changes when the box does — expanding re-sizes the type underneath us. */
  expanded: boolean,
): void {
  const fit = useRef(() => {})

  fit.current = () => {
    const box = boxRef.current
    const text = box?.querySelector<HTMLElement>('.stage__line-text')
    if (!box || !text) return

    const available = box.clientHeight
    if (available <= 0) return

    let scale = 1
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      box.style.setProperty('--line-fit', scale.toFixed(4))
      // Reading it back is what forces the layout the next pass depends on.
      const natural = text.scrollHeight
      // Half a pixel of slack: sub-pixel line heights should not cost a pass.
      if (natural <= available + 0.5) break
      if (scale <= MIN_SCALE) break
      scale = Math.max(MIN_SCALE, scale * Math.sqrt(available / natural) * 0.99)
    }
  }

  // Before paint, so the words are never briefly the wrong size.
  useLayoutEffect(() => {
    fit.current()
  }, [line, expanded])

  /*
   * The box changes width while the stage travels, and again whenever the
   * window does. Coalesced into one measurement per frame at most, because the
   * expansion tween resizes it on every frame of a 620ms journey.
   */
  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return

    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => fit.current())
    })
    observer.observe(box)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [boxRef])
}
