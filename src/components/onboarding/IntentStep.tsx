import { useState, type ComponentType, type SVGProps } from 'react'
import { FEATURED_FOCUSES, MORE_FOCUSES, type Focus } from '../../lib/affirmations'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { useReducedMotion } from '../../lib/motion'
import {
  BloomIcon,
  BookIcon,
  BreathIcon,
  CompassIcon,
  FlameIcon,
  GrowthIcon,
  HeartIcon,
  LeafIcon,
  MoonIcon,
  MountainIcon,
  PulseIcon,
  SeedIcon,
  SparkIcon,
  StarIcon,
  SunIcon,
} from '../Icons'
import { Reveal, RevealText } from './Reveal'

const GLYPHS: Record<Focus['glyph'], ComponentType<SVGProps<SVGSVGElement>>> = {
  spark: SparkIcon,
  breath: BreathIcon,
  pulse: PulseIcon,
  mountain: MountainIcon,
  bloom: BloomIcon,
  moon: MoonIcon,
  leaf: LeafIcon,
  book: BookIcon,
  compass: CompassIcon,
  heart: HeartIcon,
  seed: SeedIcon,
  flame: FlameIcon,
  growth: GrowthIcon,
  sun: SunIcon,
  star: StarIcon,
}

/**
 * "What would you like to strengthen right now?"
 *
 * The one question this app actually needs answered, asked as a grid of things
 * to touch rather than a list of things to read. Every tile is a complete
 * answer — there is no Next button, because tapping a tile *is* the answer and
 * asking somebody to confirm it would be a second decision about the same
 * thing.
 *
 * Three columns on a phone and three from a tablet up — the same count, twice
 * the size — so the ten intents people actually arrive with plus "Something
 * else" are all on screen at once on the smallest supported handset. That
 * constraint is what shaped the tile: on a phone it is a centred glyph and a
 * word, because a description under each of eleven cards is three rows of
 * scrolling, and scrolling to find your own intent is the one thing this
 * screen must not ask for. From `sm` up there is room, and the blurbs return.
 *
 * The other six live behind "Something else", which is not a lesser option:
 * Night and Discipline are two of the best reasons to open this app. They are
 * one tap away rather than on screen because sixteen tiles is a form.
 *
 * Hovering warms the field behind the page towards that intent before it is
 * chosen — the only pointer affordance in the flow, and it exists because it
 * makes the choice feel like it has consequences before it has been made.
 */

interface IntentStepProps {
  onChoose: (focus: Focus) => void
  /** Warms the field towards whatever is under the pointer. */
  onPreviewTone: (focus: Focus | null) => void
}

export function IntentStep({ onChoose, onPreviewTone }: IntentStepProps) {
  const [showMore, setShowMore] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()

  const choose = (focus: Focus) => {
    if (chosen) return
    cue('select')
    setChosen(focus.id)
    onPreviewTone(focus)
    // Long enough for the tile to acknowledge the tap and no longer. With
    // motion reduced there is nothing to wait for, so nothing waits.
    window.setTimeout(() => onChoose(focus), reducedMotion ? 0 : 240)
  }

  const tiles = showMore ? [...FEATURED_FOCUSES, ...MORE_FOCUSES] : FEATURED_FOCUSES

  return (
    <div>
      <RevealText
        as="h1"
        className="type-title text-center text-balance"
        text="What would you like to strengthen right now?"
      />

      <Reveal delay={0.35}>
        <div
          role="group"
          aria-label="Choose what to strengthen"
          className="mt-6 grid grid-cols-3 gap-2 [@media(max-height:720px)]:mt-4 sm:mt-7 sm:grid-cols-3 sm:gap-3"
          onPointerLeave={() => onPreviewTone(null)}
        >
          {tiles.map((focus) => {
            const Glyph = GLYPHS[focus.glyph]
            const active = chosen === focus.id
            return (
              <button
                key={focus.id}
                type="button"
                onClick={() => choose(focus)}
                onPointerEnter={() => onPreviewTone(focus)}
                onFocus={() => onPreviewTone(focus)}
                className={cx(
                  'interactive pressable group flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border px-2 py-3 text-center [@media(max-height:720px)]:min-h-[4.75rem]',
                  'sm:min-h-[7rem] sm:items-start sm:px-4 sm:text-left',
                  'transition-[background-color,border-color,box-shadow] duration-300 ease-[var(--ease-calm)]',
                  active
                    ? 'border-[var(--rose)] bg-[var(--rose-soft)] shadow-[0_10px_30px_-16px_var(--glow)]'
                    : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]',
                  active && !reducedMotion && 'animate-choice-settle',
                  chosen && !active && 'opacity-40',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[0.95rem] transition-colors duration-300 sm:h-8 sm:w-8',
                    active
                      ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                      : 'bg-[var(--quiet)] text-ink-faint group-hover:text-[var(--rose-deep)]',
                  )}
                >
                  <Glyph />
                </span>
                <span className="font-display text-[0.88rem] leading-[1.15] text-ink sm:text-[1.1rem]">
                  {focus.label}
                </span>
                {/*
                  The blurb is warmth, and warmth is the first thing to go when
                  the alternative is scrolling to find your own intent.
                */}
                <span className="hidden text-[0.8rem] leading-snug text-ink-faint sm:block">
                  {focus.blurb}
                </span>
              </button>
            )
          })}

          {!showMore && (
            <button
              type="button"
              onClick={() => {
                cue('tap')
                setShowMore(true)
              }}
              className="interactive pressable flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border border-dashed border-[var(--border-strong)] px-2 py-3 text-center text-ink-muted hover:text-ink [@media(max-height:720px)]:min-h-[4.75rem] sm:min-h-[7rem] sm:items-start sm:px-4 sm:text-left"
            >
              <span className="font-display text-[0.88rem] leading-[1.15] sm:text-[1.1rem]">
                Something else
              </span>
              <span className="hidden text-[0.8rem] leading-snug text-ink-faint sm:block">
                Discipline, fitness, mornings and more
              </span>
            </button>
          )}
        </div>
      </Reveal>
    </div>
  )
}
