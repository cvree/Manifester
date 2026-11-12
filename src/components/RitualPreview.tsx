import { useEffect, useMemo, useState } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { formatApproxDuration, estimateSpokenSeconds } from '../lib/format'
import { autoTitle } from '../lib/loops'
import type { BreathStyleId } from '../lib/breathing'
import { useReducedMotion } from '../lib/motion'
import { affirmationLines } from '../lib/summaries'
import type { BreathingRuntime } from '../lib/useBreathing'
import type { LoopSettings, PreviewState } from '../lib/types'
import { BreathingVisualizer } from './BreathingVisualizer'
import { BusyStrip, Spinner } from './Button'
import { PauseIcon, VoiceIcon } from './Icons'

interface RitualPreviewProps {
  title: string
  text: string
  settings: LoopSettings
  breathing: BreathingRuntime
  breathStyle: BreathStyleId
  /** Drives the ambient wash: one of the built-in sound ids, `off`, or `custom`. */
  sceneKey: string
  onPreview: () => void
  onStopPreview: () => void
  previewState: PreviewState
  canPreview: boolean
  className?: string
}

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

/**
 * A quiet picture of the reading, beside the words on a wide screen.
 *
 * It used to be the control centre of Create: Start, Save and five setting
 * tiles lived here, in a column apart from the words they acted on, and on a
 * phone it was a second stage a full screen below the editor. The actions now
 * sit directly under the words and the settings are rows beneath them, which
 * leaves this to do the one thing nothing else on the page can — show the
 * lines the way they will be read, one at a time, in the room they will be
 * read in — and to let somebody hear a single line before committing.
 */
export function RitualPreview({
  title,
  text,
  settings,
  breathing,
  breathStyle,
  sceneKey,
  onPreview,
  onStopPreview,
  previewState,
  canPreview,
  className,
}: RitualPreviewProps) {
  const reducedMotion = useReducedMotion()
  const lines = useMemo(() => affirmationLines(text), [text])
  const preparing = previewState === 'loading'
  const [index, setIndex] = useState(0)

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
        <p className="type-label">How it will sound</p>

        <h2 className="mt-2 max-w-full truncate text-center font-display text-[1.4rem] leading-tight text-ink">
          {title.trim() || autoTitle(text)}
        </h2>

        <div className="my-6">
          <BreathingVisualizer runtime={breathing} style={breathStyle} size="md" />
        </div>

        {/* The words, rotating slowly through the lines. */}
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

        {/*
          Pressing this can be answered instantly — the line is already on the
          device — or after a second or two of synthesis. Both are normal, so
          the wait is a state of the button rather than an exception.
        */}
        <button
          type="button"
          onClick={() => {
            cue('tap')
            if (previewState === 'playing') onStopPreview()
            else if (previewState === 'idle') onPreview()
          }}
          disabled={!canPreview || preparing}
          aria-busy={preparing || undefined}
          className={cx(
            'interactive pressable relative mt-5 inline-flex min-h-12 items-center gap-2.5 rounded-pill border px-5 text-[0.95rem] font-medium',
            previewState === 'idle'
              ? 'border-[var(--control-border)] bg-[var(--control)] text-ink'
              : 'border-[var(--rose)] bg-[var(--rose-soft)] text-[var(--rose-deep)]',
            !preparing && 'disabled:cursor-not-allowed disabled:opacity-45',
          )}
        >
          {preparing ? (
            <Spinner />
          ) : previewState === 'playing' ? (
            <PauseIcon className="text-[0.85rem]" />
          ) : (
            <VoiceIcon className="text-[0.95rem]" />
          )}
          {preparing
            ? 'Getting the voice ready…'
            : previewState === 'playing'
              ? 'Stop preview'
              : 'Hear one line'}
          {preparing && <BusyStrip />}
        </button>

        <p className="type-meta mt-4 text-center">
          {lines.length === 0
            ? 'Write a line to hear how it sounds.'
            : settings.repeat
              ? `${perPass} per pass · begins again after ${
                  settings.repeatPauseSeconds === 0
                    ? 'no pause'
                    : `${settings.repeatPauseSeconds}s`
                }`
              : `${perPass}, read once`}
        </p>
      </div>
    </div>
  )
}
