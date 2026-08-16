import { useState, type ComponentType, type SVGProps } from 'react'
import {
  FEATURED_FOCUSES,
  MAX_FOCUSES,
  MORE_FOCUSES,
  type Focus,
} from '../../lib/affirmations'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { Button } from '../Button'
import {
  BloomIcon,
  BookIcon,
  BreathIcon,
  CheckIcon,
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
 * to touch rather than a list of things to read.
 *
 * ── Why more than one ───────────────────────────────────────────────────────
 *
 * This screen used to end the moment a tile was tapped: one intent, no
 * confirmation, straight on. It was a lovely interaction and it asked the
 * wrong question, because nobody opens this app carrying exactly one thing.
 * Calm and sleep are the same evening. Confidence and career are the same
 * meeting. Being made to pick which of two true answers counted was a small
 * refusal right at the start of a first visit, and the shortlist that followed
 * was narrower for it.
 *
 * So up to three, blended — the starters on the next screen are drawn from all
 * of them in turn — and the first one chosen leads, because it is the one that
 * decides the recommendation, the loop's name and the colour of the field
 * behind the page.
 *
 * The cost is a Continue button where there did not use to be one. That is the
 * honest price of a multiple choice and it is paid deliberately: a tile that
 * both selects *and* advances cannot let you pick a second, so either the tap
 * stops advancing or the choice stays single. The button appears only once
 * something is chosen, so the screen is still a grid of things to touch until
 * the moment it needs to be something else.
 *
 * Hovering warms the field behind the page towards that intent before it is
 * chosen — the only pointer affordance in the flow, and it exists because it
 * makes the choice feel like it has consequences before it has been made.
 */

interface IntentStepProps {
  /** In the order they were chosen. The first one leads. */
  chosen: Focus[]
  onChange: (focuses: Focus[]) => void
  onContinue: () => void
  /** Warms the field towards whatever is under the pointer. */
  onPreviewTone: (focus: Focus | null) => void
}

export function IntentStep({
  chosen,
  onChange,
  onContinue,
  onPreviewTone,
}: IntentStepProps) {
  const [showMore, setShowMore] = useState(
    () => chosen.some((focus) => MORE_FOCUSES.includes(focus)),
  )

  const full = chosen.length >= MAX_FOCUSES

  const toggle = (focus: Focus) => {
    const already = chosen.some((entry) => entry.id === focus.id)
    if (already) {
      cue('tap')
      onChange(chosen.filter((entry) => entry.id !== focus.id))
      return
    }
    if (full) {
      // Nothing silently replaces anything. Three is the limit and the tiles
      // say so; a fourth tap that quietly evicted the first choice would be
      // the screen making a decision on somebody's behalf.
      cue('tap')
      return
    }
    cue('select')
    onChange([...chosen, focus])
    onPreviewTone(focus)
  }

  const tiles = showMore ? [...FEATURED_FOCUSES, ...MORE_FOCUSES] : FEATURED_FOCUSES

  return (
    <div>
      <RevealText
        as="h1"
        className="type-title text-center text-balance"
        text="What would you like to strengthen right now?"
      />

      <Reveal delay={0.28}>
        <p className="type-meta mt-2 text-center" aria-live="polite">
          {chosen.length === 0
            ? `Pick one, or up to ${MAX_FOCUSES} — your words will draw on all of them.`
            : full
              ? 'That is three. Tap one again to swap it out.'
              : `${chosen.length} chosen · you can add ${MAX_FOCUSES - chosen.length} more`}
        </p>
      </Reveal>

      <Reveal delay={0.35}>
        <div
          role="group"
          aria-label="Choose what to strengthen"
          className="mt-4 grid grid-cols-3 gap-2 [@media(max-height:720px)]:mt-3 sm:mt-5 sm:grid-cols-3 sm:gap-3"
          onPointerLeave={() => onPreviewTone(null)}
        >
          {tiles.map((focus) => {
            const Glyph = GLYPHS[focus.glyph]
            const rank = chosen.findIndex((entry) => entry.id === focus.id)
            const active = rank >= 0
            // Dimmed rather than disabled: it still responds, it just has
            // nothing left to say yes to, and a disabled tile cannot explain
            // itself to a screen reader half as well as a pressed state can.
            const spent = full && !active
            return (
              <button
                key={focus.id}
                type="button"
                onClick={() => toggle(focus)}
                onPointerEnter={() => onPreviewTone(focus)}
                onFocus={() => onPreviewTone(focus)}
                aria-pressed={active}
                className={cx(
                  'interactive pressable group relative flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border px-2 py-3 text-center [@media(max-height:720px)]:min-h-[4.75rem]',
                  'sm:min-h-[7rem] sm:items-start sm:px-4 sm:text-left',
                  'transition-[background-color,border-color,box-shadow,opacity] duration-300 ease-[var(--ease-calm)]',
                  active
                    ? 'border-[var(--rose)] bg-[var(--rose-soft)] shadow-[0_10px_30px_-16px_var(--glow)]'
                    : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]',
                  spent && 'opacity-45',
                )}
              >
                {/*
                  The order is shown, not just the fact of being chosen. The
                  first pick decides the recommendation and the colour of the
                  room, so it is worth being able to see which one it was.
                */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--rose-deep)] text-[0.62rem] font-semibold text-[var(--bg-0)]"
                  >
                    {rank === 0 ? <CheckIcon /> : rank + 1}
                  </span>
                )}

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

      {/*
        Present only once there is something to continue with. Until then the
        screen is exactly what it always was — a grid of things to touch, with
        no button on it asking to be pressed.
      */}
      {chosen.length > 0 && (
        <Reveal delay={0.1} distance={10}>
          <Button
            variant="primary"
            size="xl"
            block
            className="mt-4"
            onClick={() => {
              cue('tap')
              onContinue()
            }}
          >
            Continue
          </Button>
        </Reveal>
      )}
    </div>
  )
}
