import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { useReducedMotion } from '../lib/motion'
import type { SessionStatus } from '../lib/types'
import { PauseIcon, PlayIcon, StopIcon } from './Icons'

interface PlayerControlsProps {
  status: SessionStatus
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  disabled?: boolean
  /** Shown under the button, e.g. `"Looping"` or `"12:04 left"`. */
  caption?: string
  /**
   * The breathing orb, drawn behind the play button. When present it replaces
   * the default pulse rings so the two never compete for attention.
   */
  visualizer?: ReactNode
  /** Rendered above the caption, for the breathing phase.  */
  visualizerCaption?: ReactNode
}

export function PlayerControls({
  status,
  onStart,
  onPause,
  onResume,
  onStop,
  disabled = false,
  caption,
  visualizer,
  visualizerCaption,
}: PlayerControlsProps) {
  const scope = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const playing = status === 'playing'

  // The button breathes very slightly while a session runs.
  useGSAP(
    () => {
      if (reducedMotion) return
      const target = scope.current?.querySelector('[data-play-button]')
      if (!target) return
      gsap.killTweensOf(target)
      if (playing) {
        gsap.to(target, {
          scale: 1.035,
          duration: 2.1,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        })
      } else {
        gsap.to(target, { scale: 1, duration: 0.4, ease: 'power2.out' })
      }
    },
    { scope, dependencies: [playing, reducedMotion] },
  )

  const primaryAction = () => {
    if (status === 'playing') onPause()
    else if (status === 'paused') onResume()
    else onStart()
  }

  const primaryLabel =
    status === 'playing'
      ? 'Pause the loop'
      : status === 'paused'
        ? 'Resume the loop'
        : 'Start the loop'

  return (
    <div ref={scope} className="flex flex-col items-center">
      <div className="relative flex h-[15rem] w-[15rem] items-center justify-center">
        {visualizer}

        {!visualizer && playing && !reducedMotion && (
          <>
            <span
              aria-hidden="true"
              className="animate-breathe absolute h-[7.5rem] w-[7.5rem] rounded-full border border-[var(--rose)]"
            />
            <span
              aria-hidden="true"
              className="animate-breathe absolute h-[7.5rem] w-[7.5rem] rounded-full border border-[var(--gold)]"
              style={{ animationDelay: '-2.1s' }}
            />
          </>
        )}

        <button
          type="button"
          data-play-button
          onClick={primaryAction}
          disabled={disabled}
          aria-label={primaryLabel}
          className={cx(
            'relative flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-full',
            'text-[2.2rem] text-[var(--bg-0)] transition-[filter,opacity] duration-200',
            'bg-[var(--rose-deep)] shadow-[0_14px_40px_-14px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.25)]',
            'active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {playing ? <PauseIcon /> : <PlayIcon className="translate-x-[3px]" />}
        </button>
      </div>

      {visualizerCaption && <div className="mt-1 mb-1">{visualizerCaption}</div>}

      <div
        className="min-h-6 text-center text-[0.95rem] text-ink-muted"
        aria-live="polite"
      >
        {caption}
      </div>

      <button
        type="button"
        onClick={onStop}
        disabled={status === 'idle'}
        className={cx(
          'mt-4 inline-flex min-h-11 items-center gap-2 rounded-pill border border-[var(--border)] px-5',
          'text-[0.95rem] font-medium text-ink-muted transition-colors duration-200',
          'hover:bg-[var(--surface-sunken)] hover:text-ink',
          'disabled:cursor-not-allowed disabled:opacity-35',
        )}
      >
        <StopIcon className="text-[0.9rem]" />
        End session
      </button>
    </div>
  )
}
