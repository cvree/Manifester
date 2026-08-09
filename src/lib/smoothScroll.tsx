/**
 * Smooth scrolling, on the screens that actually scroll.
 *
 * Lenis takes over the wheel and turns a page into something you glide down
 * rather than step down, which suits a long reading page and an authoring page
 * you move up and down while you work. It suits nothing else here: the player
 * has essentially nothing to scroll, a sheet has its own scroller, and a slider
 * is a control rather than a surface. So this is opt-in per route, and the two
 * routes that opt in are the two long ones.
 *
 * Three rules hold it together:
 *
 *   - one instance at a time. `ReactLenis root` drives the window, and two of
 *     those would be two animation loops fighting over one scroll position, so
 *     no route may nest inside another that has already mounted it;
 *   - `prefers-reduced-motion` unmounts it entirely rather than configuring it
 *     down. Someone who has asked for less movement has not asked for slower
 *     movement;
 *   - anything with its own scroller — a textarea, a sheet's body — carries
 *     `data-lenis-prevent`, or the wheel over it moves the page behind instead.
 *
 * `scrollToSection` is here rather than in a hook because the code that needs
 * it is often the code that mounts the provider, and so is outside its own
 * context. The instance is a module-level reference for exactly that reason,
 * and it is safe to be one precisely because of the first rule above.
 */

import type Lenis from 'lenis'
import { ReactLenis } from 'lenis/react'
import { useCallback, type ReactNode } from 'react'
import { prefersReducedMotion, useReducedMotion } from './motion'

/** The one running instance, or null when nothing is smoothing the page. */
let instance: Lenis | null = null

/**
 * Sedate rather than floaty. Much past this and a flick of the wheel takes
 * long enough to land that the page feels like it is deciding whether to.
 */
const OPTIONS = { duration: 1.1, smoothWheel: true }

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion()

  const attach = useCallback((node: { lenis?: Lenis } | null) => {
    instance = node?.lenis ?? null
    return () => {
      instance = null
    }
  }, [])

  if (reducedMotion) return <>{children}</>

  return (
    <ReactLenis root options={OPTIONS} ref={attach}>
      {children}
    </ReactLenis>
  )
}

/**
 * Move the window to an element, leaving `gap` pixels of air above it.
 *
 * Falls back to the platform's own smooth scroll when Lenis is not running —
 * which is both the reduced-motion case and every route that has not opted in.
 * Going through here rather than calling `scrollTo` directly matters while
 * Lenis *is* running: it keeps its own idea of the scroll position, and a
 * native scroll underneath it leaves the two disagreeing until the next wheel
 * event snaps the page back.
 */
export function scrollToSection(target: Element | null, gap = 16): void {
  if (!target) return

  if (instance) {
    instance.scrollTo(target as HTMLElement, { offset: -gap })
    return
  }

  window.scrollTo({
    top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - gap),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}

/** Centre an element in the window, for the tiles that point at a card. */
export function scrollToCentre(target: Element | null): void {
  if (!target) return
  const gap = Math.max(
    16,
    (window.innerHeight - target.getBoundingClientRect().height) / 2,
  )
  scrollToSection(target, gap)
}

/** Back to the top of the page. */
export function scrollToTop(): void {
  if (instance) {
    instance.scrollTo(0)
    return
  }
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}
