import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  CINEMATIC_WORD,
  cinematicGlyphs,
  cinematicWhisper,
  glyphCount,
  isMovingPhase,
} from '../lib/cinematic'
import { cx } from '../lib/cx'
import type { BreathingRuntime } from '../lib/useBreathing'

/**
 * How long the phrase takes to resolve from its first letter to its last,
 * whatever the phrase is.
 *
 * Kept in step with `cinema-resolve` in `theme.css`, which runs 900ms: the last
 * letter of the longest phrase is therefore settled a little over one and a
 * half seconds in — comfortably inside the shortest phase any preset has, which
 * is three seconds. A sweep long enough to still be arriving when the phase
 * turns would mean a word nobody ever sees finished.
 */
const SWEEP_MS = 620

/**
 * The breath, as a title card.
 *
 * ── What this is ──
 *
 * The orb tells you the *shape* of the breath and the breath's voice tells you
 * its *edges*. Neither of them tells you, in words, at the size a person can
 * read with their eyes half shut from the other side of a dark room, what to
 * do right now. This does: two words across the middle of the screen, resolving
 * out of blur one letter at a time, spreading as you fill and drawing back
 * together as you empty.
 *
 * It is the difference between an app with a breathing feature and a room that
 * is breathing with you, and it costs almost nothing to run — which is the
 * second thing worth saying about it.
 *
 * ── How it costs nothing ──
 *
 * Every value that changes per *frame* is a CSS custom property. `--e`, `--p`
 * and `--m` are already written onto `.stage` sixty times a second by
 * `useBreathing`, and custom properties inherit — so this layer, sitting inside
 * the stage, is handed the current frame for free and never asks React for it.
 * The tracking that opens with the in-breath, the light that gathers at the top
 * of it, the rule that fills across the phase and the whisper that fades out at
 * the turn are all `calc()` against those three numbers.
 *
 * React re-renders here exactly when the *words* change: once per phase for the
 * phrase, once per second for the count. The phrase is keyed by phase and
 * breath so it re-mounts at each turn and its entrance animation plays once —
 * which is the whole reason the count is a sibling rather than part of it. A
 * countdown inside the keyed block would restart the letters every second.
 *
 * ── What it deliberately is not ──
 *
 * It is not a second clock, not a second source of truth about the breath, and
 * not readable by a screen reader. The orb already carries the accessible name
 * for the guide and the stage already has a live region for its state; a layer
 * that announced "Breathe out" a second time would make the app say everything
 * twice. So this is `aria-hidden`, and everything it says is said elsewhere in
 * a form that does not depend on being seen.
 */

interface CinematicBreathTypeProps {
  runtime: BreathingRuntime
  /** The expanded stage gives the type the room to be set much larger. */
  immersive?: boolean
  /**
   * With no words in the player, the type is the whole composition rather than
   * a layer over one — so it takes the room the spoken line would have used.
   */
  wordless?: boolean
  className?: string
}

export function CinematicBreathType({
  runtime,
  immersive = false,
  wordless = false,
  className,
}: CinematicBreathTypeProps) {
  const { phase, breaths, remaining, active } = runtime

  const words = cinematicGlyphs(CINEMATIC_WORD[phase])
  /*
   * The sweep is a fixed *total*, divided among however many letters there
   * are, rather than a fixed step per letter — so "Hold" and "Breathe out"
   * finish resolving at the same moment instead of the short word being over
   * while the long one is still arriving, and the phrase always lands well
   * inside the shortest phase any preset has.
   *
   * The division is done here rather than in the stylesheet, and it has to be:
   * `calc(var(--i) / var(--glyphs))` is rejected — a `var()` has no type at
   * parse time and `/` demands a number on the right — so the delay silently
   * computed to `0s` and every letter arrived at once, which is not a stagger,
   * it is the whole word blinking. It costs one string per letter per phase
   * turn, on a render that was happening anyway, and nothing per frame.
   */
  const stagger = (index: number) =>
    `${Math.round((index / Math.max(glyphCount(words), 1)) * SWEEP_MS)}ms`

  /*
   * ── Where each letter travels as the breath opens the phrase ──
   *
   * The in-breath used to open the words with `letter-spacing`, rewritten from
   * `--e` every frame. Letter-spacing is a layout property: the phrase was
   * re-laid out sixty times a second, each glyph's position rounded to whole
   * device pixels on its own, and the letters crawled against each other — the
   * shimmer people saw as the title "shaking". On a narrow phone the extra
   * width could also re-wrap "Breathe out" from one line to two mid-breath.
   *
   * Now the line is laid out once, at a fixed tracking, and the opening is a
   * `translate` on each glyph: its distance from the centre of what it is
   * centred in, times the breath. That is the same picture — every gap widens
   * by the same amount and the phrase stays centred — drawn by the compositor.
   *
   * "The centre of what it is centred in" depends on whether the phrase fits on
   * one line (the whole phrase) or stacks (each word on its own). Which one it
   * is gets measured once per phrase, and again when the box changes width,
   * and is never asked about per frame.
   */
  const phraseRef = useRef<HTMLParagraphElement>(null)
  const [stacked, setStacked] = useState(false)

  useLayoutEffect(() => {
    const phrase = phraseRef.current
    if (!phrase) return
    const measure = () => {
      const parts = phrase.querySelectorAll<HTMLElement>('.cinema__word-part')
      if (parts.length < 2) {
        setStacked(false)
        return
      }
      const first = parts[0].offsetTop
      setStacked(Array.from(parts).some((part) => part.offsetTop !== first))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(phrase)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [phase, breaths])

  /*
   * Offsets are counted in glyph slots. On one line the gap between words
   * counts as one slot, because that is what letter-spacing would have done to
   * it; stacked, each word is its own centred line.
   */
  const phraseSlots = glyphCount(words) + Math.max(words.length - 1, 0)
  let slot = 0
  const offsets = words.map((word) => {
    const start = slot
    slot += word.glyphs.length + 1
    return word.glyphs.map((_, i) =>
      stacked
        ? i - (word.glyphs.length - 1) / 2
        : start + i - (phraseSlots - 1) / 2,
    )
  })

  return (
    <div
      aria-hidden="true"
      data-phase={phase}
      data-moving={isMovingPhase(phase)}
      data-live={active}
      className={cx(
        'cinema',
        immersive && 'cinema--immersive',
        wordless && 'cinema--wordless',
        className,
      )}
    >
      <span className="cinema__glow" />

      <p key={`${phase}-${breaths}`} ref={phraseRef} className="cinema__word">
        {words.map((word, w) => (
          <span key={word.index} className="cinema__word-part">
            {word.glyphs.map((glyph, g) => (
              <span
                key={glyph.index}
                className="cinema__glyph"
                style={
                  {
                    animationDelay: stagger(glyph.index),
                    '--c': offsets[w][g].toFixed(2),
                  } as CSSProperties
                }
              >
                {glyph.char}
              </span>
            ))}
          </span>
        ))}
      </p>

      {/*
        A hairline that opens from the centre across the phase. It is the only
        part of this layer that reports *time* rather than breath, and it is a
        single `scaleX(var(--p))` — the cheapest honest progress bar there is.
      */}
      <span className="cinema__rule">
        <span className="cinema__rule-fill" />
      </span>

      <p key={`whisper-${phase}-${breaths}`} className="cinema__whisper">
        {cinematicWhisper(phase, breaths)}
      </p>

      {/*
        Not keyed by the second any more. Re-mounting the numeral every second
        replayed an entrance on it every second — a small twitch, once a second,
        for the whole session, landing on the same frame as the countdown's
        React render. The number now simply changes in a box of fixed width.
      */}
      <p className="cinema__count">{remaining}</p>
    </div>
  )
}
