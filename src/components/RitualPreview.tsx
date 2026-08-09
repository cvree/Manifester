import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { formatApproxDuration, estimateSpokenSeconds } from '../lib/format'
import type { BreathStyleId } from '../lib/breathing'
import { useReducedMotion } from '../lib/motion'
import { affirmationLines } from '../lib/summaries'
import type { BreathingRuntime } from '../lib/useBreathing'
import type { LoopSettings } from '../lib/types'
import { BreathingVisualizer } from './BreathingVisualizer'
import {
  ChevronIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  PulseIcon,
  VoiceIcon,
  WaveIcon,
} from './Icons'

/** The five things the summary tiles stand for, in the order they are shown. */
export type RitualSetting = 'voice' | 'sound' | 'timer' | 'delay' | 'rhythm'

interface RitualPreviewProps {
  title: string
  text: string
  settings: LoopSettings
  breathing: BreathingRuntime
  /** Which of the six forms the guide is drawn as. */
  breathStyle: BreathStyleId
  voice: string
  sound: string
  /** The brainwave rhythm summary, or `null` when it is off. */
  rhythm: string | null
  timer: string
  delay: string
  /** Name of the chosen ambience, used to tint the scene. */
  sceneKey: string
  onPreview: () => void
  onStopPreview: () => void
  previewing: boolean
  canPreview: boolean
  /**
   * Begin the loop from here.
   *
   * The preview is the picture of the finished thing, and on a desktop it is
   * the right-hand column — which meant the one button that acts on what you
   * are looking at was in the other column, below the fold. Hearing a line and
   * starting the loop are the same question at two sizes, so they are the same
   * pair of buttons in the same place.
   */
  onStart: () => void
  canStart: boolean
  starting: boolean
  /**
   * Take me to the control behind this tile. The preview does not know
   * whether that means opening a sheet or scrolling the page — Create owns
   * both the sheet state and the layout, so it decides.
   */
  onOpenSetting: (setting: RitualSetting) => void
  className?: string
}

/**
 * A live picture of the finished ritual.
 *
 * This is the thing the old Create screen was missing: instead of reading a
 * list of settings and imagining the result, you watch it. The orb breathes,
 * your lines cycle through the way they will when spoken, and the scene takes
 * its colour from the ambience you picked.
 */

/** Each ambience gets its own light, so the scene changes when you change it. */
const SCENES: Record<string, { wash: string; name: string }> = {
  'moon-garden': {
    name: 'Moon Garden',
    wash:
      'radial-gradient(80% 60% at 50% 0%, color-mix(in oklab, var(--sage) 16%, transparent) 0%, transparent 62%)',
  },
  'soft-horizon': {
    name: 'Soft Horizon',
    wash:
      'radial-gradient(80% 60% at 50% 0%, color-mix(in oklab, var(--gold) 18%, transparent) 0%, transparent 62%)',
  },
  'rain-window': {
    name: 'Rain on Window',
    wash:
      'radial-gradient(80% 60% at 50% 0%, color-mix(in oklab, var(--twilight) 20%, transparent) 0%, transparent 62%)',
  },
  'ocean-tide': {
    name: 'Ocean Tide',
    wash:
      'radial-gradient(80% 60% at 50% 0%, color-mix(in oklab, var(--twilight) 15%, transparent) 30%, color-mix(in oklab, var(--gold) 10%, transparent) 100%)',
  },
  'fireplace-glow': {
    name: 'Fireplace Glow',
    wash:
      'radial-gradient(80% 70% at 50% 100%, color-mix(in oklab, var(--gold) 24%, transparent) 0%, transparent 66%)',
  },
  off: {
    name: 'Silence',
    wash:
      'radial-gradient(80% 60% at 50% 0%, color-mix(in oklab, var(--twilight) 10%, transparent) 0%, transparent 62%)',
  },
  custom: {
    name: 'Your sound',
    wash:
      'radial-gradient(80% 60% at 50% 0%, color-mix(in oklab, var(--rose) 16%, transparent) 0%, transparent 62%)',
  },
}

const ROTATE_MS = 5200

export function RitualPreview({
  title,
  text,
  settings,
  breathing,
  breathStyle,
  voice,
  sound,
  rhythm,
  timer,
  delay,
  sceneKey,
  onPreview,
  onStopPreview,
  previewing,
  canPreview,
  onStart,
  canStart,
  starting,
  onOpenSetting,
  className,
}: RitualPreviewProps) {
  const reducedMotion = useReducedMotion()
  const lines = useMemo(() => affirmationLines(text), [text])
  const [index, setIndex] = useState(0)

  // Cycle the lines the way the loop will read them. Held still when someone
  // has asked for reduced motion — a line that swaps itself out is motion too.
  useEffect(() => {
    setIndex(0)
    if (reducedMotion || lines.length < 2) return
    const interval = window.setInterval(
      () => setIndex((current) => (current + 1) % lines.length),
      ROTATE_MS,
    )
    return () => window.clearInterval(interval)
  }, [lines, reducedMotion])

  const scene = SCENES[sceneKey] ?? SCENES.custom
  const line = lines[index] ?? 'Your words will appear here as you write them.'
  const perPass = formatApproxDuration(estimateSpokenSeconds(text, settings.rate))

  return (
    <div
      className={cx(
        'surface-stage flex flex-col items-center overflow-hidden px-5 pt-7 pb-6 sm:px-7',
        className,
      )}
    >
      {/* The ambient wash: the scene's response to the chosen sound. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: scene.wash, transition: 'background 900ms var(--ease-calm)' }}
      />

      <div className="relative flex w-full flex-col items-center">
        <p className="type-label">Your ritual</p>

        <h2 className="mt-2 max-w-full truncate text-center font-display text-[1.4rem] leading-tight text-ink">
          {title.trim() || 'Untitled loop'}
        </h2>

        <div className="my-6">
          <BreathingVisualizer
            runtime={breathing}
            style={breathStyle}
            size="md"
          />
        </div>

        {/* The affirmation excerpt, rotating slowly through the lines. */}
        <p
          key={line}
          aria-live="off"
          className={cx(
            'min-h-[3.5rem] max-w-[26ch] text-center font-display text-[1.15rem] leading-snug text-ink',
            !reducedMotion && 'animate-phase-in',
            lines.length === 0 && 'text-ink-faint',
          )}
        >
          {line}
        </p>

        {lines.length > 1 && (
          <div
            aria-hidden="true"
            className="mt-1 flex items-center gap-1.5"
            role="presentation"
          >
            {lines.slice(0, 8).map((_, dot) => (
              <span
                key={dot}
                className={cx(
                  'h-1 rounded-pill transition-all duration-500 ease-[var(--ease-calm)]',
                  dot === index % 8
                    ? 'w-4 bg-[var(--rose)]'
                    : 'w-1 bg-[var(--control-border)]',
                )}
              />
            ))}
          </div>
        )}

        {/*
          Start the loop, and hear one line of it. The pair sit together
          because they are the same question at two sizes — and Start is the
          filled one, because a preview is a step on the way to it rather than
          an alternative to it.
        */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart || starting}
            aria-busy={starting || undefined}
            className={cx(
              'interactive pressable inline-flex min-h-12 items-center gap-2.5 rounded-pill border border-transparent px-6 text-[0.95rem] font-medium',
              'bg-[linear-gradient(175deg,color-mix(in_oklab,var(--rose-deep)_86%,white)_0%,var(--rose-deep)_62%)] text-[var(--bg-0)]',
              'shadow-[0_1px_0_rgb(255_255_255/0.28)_inset,0_8px_24px_-10px_var(--glow)]',
              'hover:brightness-[1.05]',
              'disabled:cursor-not-allowed disabled:opacity-45',
            )}
          >
            {starting ? (
              <span
                aria-hidden="true"
                className="h-[1.05em] w-[1.05em] shrink-0 animate-spin rounded-full border-2 border-[color-mix(in_oklab,currentColor_28%,transparent)] border-t-current"
              />
            ) : (
              <PlayIcon className="text-[0.85rem]" />
            )}
            {starting ? 'Beginning…' : 'Start loop'}
          </button>

          <button
            type="button"
            onClick={() => {
              cue('tap')
              if (previewing) onStopPreview()
              else onPreview()
            }}
            disabled={!canPreview}
            className={cx(
              'interactive pressable inline-flex min-h-12 items-center gap-2.5 rounded-pill border px-5 text-[0.95rem] font-medium',
              previewing
                ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                : 'border-[var(--control-border)] bg-[var(--control)] text-ink',
              'disabled:cursor-not-allowed disabled:opacity-45',
            )}
          >
            {previewing ? (
              <PauseIcon className="text-[0.85rem]" />
            ) : (
              <VoiceIcon className="text-[0.95rem]" />
            )}
            {previewing ? 'Stop preview' : 'Hear a line'}
          </button>
        </div>

        {!canStart && (
          <p className="type-meta mt-2.5 text-center">
            Write a line to begin.
          </p>
        )}

        {/*
          The summary of everything the loop is made of — and the shortcut to
          changing it. These tiles looked exactly like controls and did
          nothing, which is the worst state for a thing to be in: it taught
          you that this half of the screen was scenery. Each one now goes
          straight to the setting it reports.

          It is a grid of buttons rather than a `<dl>` because a button cannot
          legally contain `<dt>`/`<dd>`, and being an operable control matters
          more here than the description-list semantics did.
        */}
        <div className="mt-7 grid w-full grid-cols-2 gap-2.5">
          <SummaryTile
            icon={<VoiceIcon />}
            label="Voice"
            value={voice}
            onClick={() => onOpenSetting('voice')}
          />
          <SummaryTile
            icon={<WaveIcon />}
            label="Sound"
            value={sound}
            onClick={() => onOpenSetting('sound')}
          />
          <SummaryTile
            icon={<ClockIcon />}
            label="Length"
            value={timer}
            onClick={() => onOpenSetting('timer')}
          />
          <SummaryTile
            icon={<PauseIcon />}
            label="Delay"
            value={delay}
            onClick={() => onOpenSetting('delay')}
          />
          {/*
            Always shown, including when the rhythm is off. It used to appear
            only once enabled, which meant the one setting you could not reach
            from here was the one you had not turned on yet — exactly backwards
            for a panel whose job is to be the shortcut.
          */}
          <SummaryTile
            icon={<PulseIcon />}
            label="Rhythm"
            value={rhythm ?? 'Off'}
            onClick={() => onOpenSetting('rhythm')}
            className="col-span-2"
          />
        </div>

        <p className="type-meta mt-4 text-center">
          {lines.length > 0
            ? `${perPass} per pass · begins again after ${
                settings.repeatPauseSeconds === 0
                  ? 'no pause'
                  : `${settings.repeatPauseSeconds}s`
              }`
            : 'Write a line to see how long each pass will take.'}
        </p>
      </div>
    </div>
  )
}

function SummaryTile({
  icon,
  label,
  value,
  onClick,
  className,
}: {
  icon: ReactNode
  label: string
  value: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => {
        cue('tap')
        onClick()
      }}
      // The value is already visible, but a screen reader needs to know the
      // tile is a way in and not just a readout.
      aria-label={`${label}: ${value}. Change`}
      className={cx(
        'interactive pressable surface-control group flex min-h-[3.5rem] min-w-0 items-center gap-2.5 px-3 py-2.5 text-left',
        'hover:bg-[var(--surface-strong)]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="shrink-0 text-[0.95rem] text-ink-faint transition-colors duration-200 group-hover:text-[var(--rose-deep)]"
      >
        {icon}
      </span>
      <span className="min-w-0 grow">
        <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.09em] text-ink-faint">
          {label}
        </span>
        <span className="block truncate text-[0.85rem] text-ink">{value}</span>
      </span>
      {/*
        Always visible, not hover-only. A phone has no hover, and the phone is
        where this app lives — an affordance that only appears under a cursor
        would leave the tiles looking exactly as dead as they used to.
      */}
      <ChevronIcon
        aria-hidden="true"
        className="shrink-0 -rotate-90 text-[0.85rem] text-ink-faint opacity-50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
      />
    </button>
  )
}
