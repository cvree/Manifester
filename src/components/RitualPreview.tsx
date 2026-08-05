import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { formatApproxDuration, estimateSpokenSeconds } from '../lib/format'
import { useReducedMotion } from '../lib/motion'
import { affirmationLines } from '../lib/summaries'
import type { BreathingRuntime } from '../lib/useBreathing'
import type { LoopSettings } from '../lib/types'
import { BreathingVisualizer } from './BreathingVisualizer'
import { ClockIcon, PauseIcon, PlayIcon, VoiceIcon, WaveIcon } from './Icons'

interface RitualPreviewProps {
  title: string
  text: string
  settings: LoopSettings
  breathing: BreathingRuntime
  voice: string
  sound: string
  timer: string
  delay: string
  /** Name of the chosen ambience, used to tint the scene. */
  sceneKey: string
  onPreview: () => void
  onStopPreview: () => void
  previewing: boolean
  canPreview: boolean
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
  voice,
  sound,
  timer,
  delay,
  sceneKey,
  onPreview,
  onStopPreview,
  previewing,
  canPreview,
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
          <BreathingVisualizer runtime={breathing} size="md" />
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

        <button
          type="button"
          onClick={() => {
            cue('tap')
            if (previewing) onStopPreview()
            else onPreview()
          }}
          disabled={!canPreview}
          className={cx(
            'interactive mt-6 inline-flex min-h-12 items-center gap-2.5 rounded-pill border px-5 text-[0.95rem] font-medium',
            previewing
              ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-[var(--rose-deep)]'
              : 'border-[var(--control-border)] bg-[var(--control)] text-ink',
            'disabled:cursor-not-allowed disabled:opacity-45',
          )}
        >
          {previewing ? (
            <PauseIcon className="text-[0.85rem]" />
          ) : (
            <PlayIcon className="text-[0.85rem]" />
          )}
          {previewing ? 'Stop preview' : 'Hear a line'}
        </button>

        {/* The summary of everything the loop is made of. */}
        <dl className="mt-7 grid w-full grid-cols-2 gap-2.5">
          <SummaryTile icon={<VoiceIcon />} label="Voice" value={voice} />
          <SummaryTile icon={<WaveIcon />} label="Sound" value={sound} />
          <SummaryTile icon={<ClockIcon />} label="Length" value={timer} />
          <SummaryTile icon={<PauseIcon />} label="Delay" value={delay} />
        </dl>

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
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="surface-control flex min-w-0 items-center gap-2.5 px-3 py-2.5">
      <span aria-hidden="true" className="shrink-0 text-[0.95rem] text-ink-faint">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.09em] text-ink-faint">
          {label}
        </dt>
        <dd className="truncate text-[0.85rem] text-ink">{value}</dd>
      </div>
    </div>
  )
}
