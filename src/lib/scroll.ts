/**
 * Moving a scroller to a section, gently.
 *
 * `scrollIntoView` almost does this, but it lands the section flush against
 * the container's edge and gives you no way to ask for air above it — inside
 * a sheet that reads as the heading being clipped by the header. So find the
 * scroller by hand, measure, and leave a gap.
 */

import { prefersReducedMotion } from './motion'

/** The nearest ancestor that actually scrolls, or null if nothing does. */
export function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    const scrolls = overflowY === 'auto' || overflowY === 'scroll'
    if (scrolls && el.scrollHeight > el.clientHeight) return el
  }
  return null
}

/**
 * Bring `node` to the top of whatever scrolls around it, `gap` pixels down.
 *
 * Silently does nothing when there is no scroller — on a tall window the whole
 * panel is already visible, and a scroll that cannot move anything is better
 * than one that jumps the page behind it.
 */
export function revealSection(node: HTMLElement | null, gap = 16): void {
  if (!node) return

  const scroller = scrollParent(node)
  if (!scroller) return

  const top =
    scroller.scrollTop +
    node.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top -
    gap

  scroller.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}
