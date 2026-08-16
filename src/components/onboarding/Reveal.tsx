import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, type ElementType, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { useReducedMotion } from '../../lib/motion'

/**
 * Typography that behaves like breath.
 *
 * Words arrive slightly low, slightly blurred and slightly apart, then settle
 * — which reads, at the speed it runs, as a sentence being *said* rather than
 * printed. It is the only text effect in the welcome experience and it appears
 * exactly once per step, on the one line that step is about.
 *
 * Two rules keep it from becoming an animation demo:
 *
 *  - **Nothing waits for it.** Every control on the step is mounted, hittable
 *    and correct from the first frame; the reveal is decoration over the top
 *    of an interface that already works. Somebody who taps during it gets what
 *    they tapped.
 *  - **It never runs twice.** Re-rendering a step must not re-animate its
 *    heading, or a state change three steps in makes the title flicker.
 *
 * With motion reduced it does nothing at all — not a shorter version, nothing
 * — and the words are simply there.
 */

interface RevealTextProps {
  text: string
  as?: ElementType
  className?: string
  /** Seconds before the first word moves. */
  delay?: number
}

export function RevealText({
  text,
  as: Tag = 'p',
  className,
  delay = 0,
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()

  useGSAP(
    () => {
      if (reducedMotion) return
      const words = ref.current?.querySelectorAll('[data-word]')
      if (!words || words.length === 0) return
      gsap.from(words, {
        opacity: 0,
        y: '0.42em',
        filter: 'blur(7px)',
        duration: 0.85,
        delay,
        ease: 'power2.out',
        stagger: 0.055,
        // Leaving a `filter` on the element costs a composited layer per word
        // for the rest of the page's life, which on a phone is the difference
        // between a smooth scroll and a sticky one.
        clearProps: 'opacity,transform,filter',
      })
    },
    { scope: ref, dependencies: [text, reducedMotion] },
  )

  return (
    <Tag ref={ref} className={className}>
      {/*
        Each word is its own `inline-block` — transforms do not apply to plain
        inline elements — with an ordinary space *between* the spans rather
        than inside them.

        A trailing space inside an inline-block is collapsed by CSS, so the
        naive version renders "Wordsyouwant". The reflex fix is a non-breaking
        space, and it is a trap: a heading joined by U+00A0 cannot be searched
        for, copied, or translated correctly, and it will not break where a
        line needs to. (This file shipped that bug for one revision, which is
        why it is written down.)

        A space between two inline-blocks is both a real word space and a real
        break opportunity, and it costs nothing.
      */}
      {text.split(' ').flatMap((word, index, all) => {
        const span = (
          <span
            key={`${word}-${index}`}
            data-word
            className="inline-block will-change-[transform,opacity,filter]"
          >
            {word}
          </span>
        )
        return index < all.length - 1 ? [span, ' '] : [span]
      })}
    </Tag>
  )
}

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  /** How far it travels. Smaller for things low on the screen. */
  distance?: number
}

/** The same arrival, for a block that is not a sentence. */
export function Reveal({
  children,
  className,
  delay = 0,
  distance = 14,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useGSAP(
    () => {
      if (reducedMotion) return
      gsap.from(ref.current, {
        opacity: 0,
        y: distance,
        duration: 0.7,
        delay,
        ease: 'power2.out',
        clearProps: 'opacity,transform',
      })
    },
    { scope: ref, dependencies: [reducedMotion] },
  )

  return (
    <div ref={ref} className={cx(className)}>
      {children}
    </div>
  )
}
