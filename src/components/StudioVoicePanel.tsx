import { useEffect, useState } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { STUDIO_DOWNLOAD_MB } from '../lib/tts'
import { useStudioVoice } from '../lib/tts/useTTSStatus'
import { Button } from './Button'
import { CheckIcon, CloseIcon, SparkIcon } from './Icons'

/**
 * The one place Studio Voice is offered, installed, and reported on.
 *
 * Ninety megabytes is a real thing to ask of somebody, so the whole card is
 * built around never letting it be a surprise. The size is on screen before
 * the button is, the button is the only thing that starts a download, and
 * "Maybe later" is exactly as prominent as "Install" — a person who declines
 * has lost nothing, because everything in this app already works without it.
 *
 * The three states it can be in are all rendered here rather than in the two
 * screens that use it, so an install started in onboarding and watched from
 * settings is visibly the same install.
 */

interface StudioVoicePanelProps {
  /**
   * `card` is the full offer — used in onboarding and in the Voice sheet.
   * `inline` is the same machine with the paragraph trimmed, for when it
   * appears under something that has already explained itself.
   */
  variant?: 'card' | 'inline'
  /** Called when the model is up. Lets onboarding move on by itself. */
  onInstalled?: () => void
  /** Called when somebody declines. Absent means "no decline button". */
  onDismiss?: () => void
  dismissLabel?: string
  className?: string
}

/** Bytes as somebody would say them. */
function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`
}

export function StudioVoicePanel({
  variant = 'card',
  onInstalled,
  onDismiss,
  dismissLabel = 'Maybe later',
  className,
}: StudioVoicePanelProps) {
  const studio = useStudioVoice()
  const [announced, setAnnounced] = useState(false)

  useEffect(() => {
    if (studio.installed && !announced) {
      setAnnounced(true)
      cue('complete')
      onInstalled?.()
    }
  }, [studio.installed, announced, onInstalled])

  if (studio.state === 'unsupported') {
    return (
      <div
        className={cx(
          'rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-sunken)] p-4',
          className,
        )}
      >
        <p className="text-[0.92rem] leading-relaxed text-ink-muted">
          This browser cannot run Studio Voice on the device. Everything still
          works — pre-made affirmations play in Ivy and Fen, and anything you
          write is read by your device&rsquo;s own voice.
        </p>
      </div>
    )
  }

  if (studio.installed) {
    return (
      <div
        className={cx(
          'rounded-[1.25rem] border border-[var(--sage)] bg-[var(--sage-soft)] p-4',
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sage-soft)] text-[1.05rem] text-[var(--sage)]"
          >
            <CheckIcon />
          </span>
          <div className="min-w-0 grow">
            <p className="text-[1rem] font-medium text-ink">Studio Voice</p>
            <ul className="mt-1.5 space-y-1 text-[0.88rem] leading-relaxed text-ink-muted">
              <li>✓ Installed{studio.backend === 'webgpu' && ' — hardware accelerated'}</li>
              <li>✓ Private — your words never leave this device</li>
              <li>✓ Works offline</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  if (studio.state === 'installing') {
    const percent = studio.fraction == null ? null : Math.round(studio.fraction * 100)
    return (
      <div
        className={cx(
          'rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-sunken)] p-4',
          className,
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[1rem] font-medium text-ink" role="status">
            Preparing Studio Voice…
          </p>
          <span className="type-meta tabular-nums">
            {percent == null ? 'starting' : `${percent}%`}
          </span>
        </div>

        {/*
          An indeterminate bar until a total is known, rather than a
          confident 0%. The first seconds are spent asking how big the files
          are, and a bar that sits still at zero reads as a stall.
        */}
        <div
          className="mt-3 h-2 overflow-hidden rounded-pill bg-[var(--quiet)]"
          role="progressbar"
          aria-label="Studio Voice download"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
        >
          <div
            className={cx(
              'h-full rounded-pill bg-[var(--rose-deep)] transition-[width] duration-300 ease-out',
              percent == null && 'animate-studio-indeterminate w-1/3',
            )}
            style={percent == null ? undefined : { width: `${Math.max(2, percent)}%` }}
          />
        </div>

        <p className="type-meta mt-3">
          {studio.total > 0
            ? `${megabytes(studio.loaded)} of ${megabytes(studio.total)}. `
            : ''}
          Downloaded once. Generated privately on this device.
        </p>

        <Button
          size="sm"
          variant="ghost"
          className="mt-2 -ml-2"
          onClick={() => {
            cue('tap')
            studio.cancel()
          }}
          leading={<CloseIcon className="text-[0.85rem]" />}
        >
          Cancel
        </Button>
      </div>
    )
  }

  const failed = studio.state === 'failed'

  return (
    <div
      className={cx(
        'rounded-[1.25rem] border p-4',
        failed
          ? 'border-[var(--gold)] bg-[var(--gold-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--rose-soft)] text-[1.05rem] text-[var(--rose-deep)]"
        >
          <SparkIcon />
        </span>

        <div className="min-w-0 grow">
          <p className="text-[1rem] font-medium text-ink">Studio Voice</p>
          <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-muted">
            More natural, private AI speech, generated on this device.
            {variant === 'card' && (
              <>
                {' '}
                Free forever. Works offline after setup. About{' '}
                {STUDIO_DOWNLOAD_MB} MB, downloaded once.
              </>
            )}
          </p>

          {failed && (
            <p role="alert" className="mt-2 text-[0.85rem] leading-snug text-ink">
              {explainFailure(studio.failure)}
            </p>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                cue('start')
                studio.install()
              }}
            >
              {failed ? 'Try again' : 'Install Studio Voice'}
            </Button>
            {onDismiss && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  cue('tap')
                  onDismiss()
                }}
              >
                {dismissLabel}
              </Button>
            )}
          </div>

          {variant === 'card' && !failed && (
            <p className="type-meta mt-2.5">
              Nothing downloads until you press Install.
              {studio.accelerated
                ? ' This device supports hardware acceleration.'
                : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * What went wrong, in a sentence somebody can act on.
 *
 * None of these blame the person and none of them are dead ends — the button
 * beside them says "Try again", and the app is still perfectly usable if they
 * never press it.
 */
function explainFailure(failure: string | null): string {
  switch (failure) {
    case 'download':
      return 'The download did not finish. It picks up where it left off, so trying again on a steadier connection is usually all it needs.'
    case 'storage':
      return 'There was not enough room to store the voice. Freeing some space — or leaving private browsing, which does not allow it at all — will let it through.'
    case 'unsupported':
      return 'This device could not start the voice engine. It is usually memory: closing other tabs and trying once more often works.'
    default:
      return 'Studio Voice could not be set up just now.'
  }
}
