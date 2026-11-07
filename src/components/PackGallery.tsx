import type { ComponentType, SVGProps } from 'react'
import type { Focus } from '../lib/affirmations'
import { findAmbientPreset } from '../lib/ambient'
import { cx } from '../lib/cx'
import { PACKS, packBreath, packLength, packLines, type Pack } from '../lib/packs'
import { useEditPack, usePlayPack } from '../lib/usePlayPack'
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
  PencilIcon,
  PlayIcon,
  PulseIcon,
  SeedIcon,
  SparkIcon,
  StarIcon,
  SunIcon,
} from './Icons'

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

const TONE: Record<Focus['tone'], string> = {
  rose: 'bg-[var(--rose-soft)] text-[var(--rose-deep)]',
  sage: 'bg-[var(--sage-soft)] text-[var(--sage)]',
  gold: 'bg-[var(--gold-soft)] text-[var(--gold)]',
  twilight:
    'bg-[color-mix(in_oklab,var(--twilight)_14%,transparent)] text-[var(--twilight)]',
}

/**
 * Ready-made sessions, as cards you can play with one press.
 *
 * `strip` scrolls sideways under a heading — for the top of Create and the
 * empty Player, where packs are an alternative to writing rather than the
 * main event. `grid` lays them all out, for the library.
 */
export function PackGallery({
  layout = 'strip',
  title = 'Ready-made sessions',
  description,
  className,
}: {
  layout?: 'strip' | 'grid'
  title?: string
  description?: string
  className?: string
}) {
  const play = usePlayPack()
  const edit = useEditPack()

  return (
    <section aria-labelledby="packs-heading" className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 id="packs-heading" className="type-subheading">
          {title}
        </h2>
        {layout === 'strip' && (
          <span className="type-meta hidden sm:inline">One press to play</span>
        )}
      </div>
      {description && <p className="type-meta -mt-1 mb-3 px-1">{description}</p>}

      <ul
        className={cx(
          layout === 'strip'
            ? 'no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-1 sm:px-1'
            : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3',
        )}
        data-lenis-prevent={layout === 'strip' ? '' : undefined}
      >
        {PACKS.map((pack) => (
          <li
            key={pack.id}
            className={cx(layout === 'strip' && 'w-[17.5rem] shrink-0 snap-start')}
          >
            <PackCard pack={pack} onPlay={() => play(pack)} onEdit={() => edit(pack)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function PackCard({
  pack,
  onPlay,
  onEdit,
}: {
  pack: Pack
  onPlay: () => void
  onEdit: () => void
}) {
  const Glyph = GLYPHS[pack.glyph]
  const firstLine = packLines(pack)[0]
  const sound = pack.sound ? findAmbientPreset(pack.sound)?.name : null
  const breath = packBreath(pack).name
  const meta = [packLength(pack), sound, `${breath} breath`].filter(Boolean).join(' · ')

  return (
    <article className="surface-panel group relative flex h-full flex-col gap-3 p-4 shadow-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] text-[1.15rem]',
            TONE[pack.tone],
          )}
        >
          <Glyph />
        </span>
        <div className="min-w-0">
          <p className="text-[0.74rem] font-semibold tracking-[0.08em] text-ink-faint uppercase">
            {pack.when}
          </p>
          <h3 className="font-display text-[1.25rem] leading-tight text-ink">{pack.title}</h3>
        </div>
      </div>

      <p className="text-[0.9rem] leading-snug text-ink-muted">{pack.promise}</p>

      <blockquote className="border-l-2 border-[var(--rose-soft)] pl-3 font-display text-[0.98rem] leading-snug text-ink italic">
        “{firstLine}”
      </blockquote>

      <p className="type-meta mt-auto">{meta}</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play ${pack.title}: ${meta}`}
          className="interactive inline-flex min-h-11 grow items-center justify-center gap-2 rounded-pill bg-[linear-gradient(175deg,color-mix(in_oklab,var(--rose-deep)_88%,white)_0%,var(--rose-deep)_64%)] px-4 text-[0.95rem] font-medium text-[var(--bg-0)] shadow-[inset_0_1px_0_rgb(255_255_255/0.28)]"
        >
          <PlayIcon className="text-[0.8rem]" />
          Play
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit the words of ${pack.title} before playing`}
          title="Make it yours first"
          className="interactive inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-[var(--control-border)] px-4 text-[0.9rem] font-medium text-ink-muted hover:text-ink"
        >
          <PencilIcon className="text-[0.8rem]" />
          Edit
        </button>
      </div>
    </article>
  )
}
