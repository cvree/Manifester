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
 * "What do you want to strengthen?"
 *
 * The one question this app actually needs answered, asked as a grid of things
 * to touch rather than as a list of things to read. Eight tiles, two columns
 * on a phone, and every one of them is a full answer — there is no Next
 * button, because tapping a tile *is* the answer and asking somebody to
 * confirm it would be a second decision about the same thing.
 *
 * The other seven live behind "Something else", which is not a lesser option:
 * Sleep and Night are two of the best reasons to open this app, and they are
 * one tap away rather than on screen because fifteen tiles is a form.
 */

interface FocusStepProps {
  onChoose: (focus: Focus) => void
}

export function FocusStep({ onChoose }: FocusStepProps) {
  const [showMore, setShowMore] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()

  const choose = (focus: Focus) => {
    if (chosen) return
    cue('select')
    setChosen(focus.id)
    // Long enough for the tile to acknowledge the tap and no longer. With
    // motion reduced there is nothing to wait for, so nothing waits.
    window.setTimeout(() => onChoose(focus), reducedMotion ? 0 : 260)
  }

  const tiles = showMore ? [...FEATURED_FOCUSES, ...MORE_FOCUSES] : FEATURED_FOCUSES

  return (
    <div>
      <h1 className="type-display text-center text-balance">
        What do you want to strengthen?
      </h1>
      <p className="type-body mt-3 text-center text-balance">
        Pick one to begin with. You can change it any time.
      </p>

      <div
        role="group"
        aria-label="Choose a focus"
        className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {tiles.map((focus) => {
          const Glyph = GLYPHS[focus.glyph]
          const active = chosen === focus.id
          return (
            <button
              key={focus.id}
              type="button"
              onClick={() => choose(focus)}
              className={cx(
                'interactive pressable group flex min-h-[7rem] flex-col items-start gap-1.5 rounded-[1.25rem] border p-4 text-left',
                'transition-[background-color,border-color,box-shadow] duration-300 ease-[var(--ease-calm)]',
                active
                  ? 'border-[var(--rose)] bg-[var(--rose-soft)] shadow-[0_10px_30px_-16px_var(--glow)]'
                  : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]',
                active && !reducedMotion && 'animate-choice-settle',
                chosen && !active && 'opacity-45',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex h-9 w-9 items-center justify-center rounded-full text-[1.1rem] transition-colors duration-300',
                  active
                    ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                    : 'bg-[var(--quiet)] text-ink-muted group-hover:text-[var(--rose-deep)]',
                )}
              >
                <Glyph />
              </span>
              <span className="font-display text-[1.1rem] leading-tight text-ink">
                {focus.label}
              </span>
              <span className="text-[0.8rem] leading-snug text-ink-faint">
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
            className="interactive pressable flex min-h-[7rem] flex-col items-start justify-end gap-1.5 rounded-[1.25rem] border border-dashed border-[var(--border-strong)] p-4 text-left text-ink-muted hover:text-ink"
          >
            <span className="font-display text-[1.1rem] leading-tight">
              Something else
            </span>
            <span className="text-[0.8rem] leading-snug text-ink-faint">
              Sleep, gratitude, fitness and more
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
