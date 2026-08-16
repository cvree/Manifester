import { useEffect, useState } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { STUDIO_DOWNLOAD_MB } from '../lib/tts'
import type { StudioStage } from '../lib/tts/studioTypes'
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
   * `card` is the full offer, used in the Voice sheet.
   *
   * `compact` is the same offer at the end of the welcome experience, where
   * the primary action is `Begin my first loop` and this must not push it off
   * a phone screen. It leads with the three words that are the whole argument
   * — Private · Free · Offline after setup — because by then the person has
   * heard the voice and does not need it described again.
   *
   * `inline` is the paragraph trimmed, for when it sits under something that
   * has already explained itself.
   */
  variant?: 'card' | 'compact' | 'inline'
  /** Called when the model is up. Lets onboarding move on by itself. */
  onInstalled?: () => void
  /** Called when somebody declines. Absent means "no decline button". */
  onDismiss?: () => void
  dismissLabel?: string
  /**
   * Offered *only* when the install has failed.
   *
   * A failure with one button on it is a wall. Somebody who has just watched
   * ninety megabytes not work is owed a way forward that does not involve
   * trying the same thing again, and the way forward is a real choice between
   * the voices their device already has. See `DeviceVoicePicker`.
   */
  onChooseAnother?: () => void
  chooseAnotherLabel?: string
  className?: string
}

/** Bytes as somebody would say them. */
function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`
}

/**
 * What the install is doing, in words, at each stage.
 *
 * Every one of these used to read "Preparing Studio Voice…", including the
 * long silent minute after the bar had already filled — which is the stretch
 * people actually gave up during, because a full bar that does not move is
 * indistinguishable from a hang.
 */
const STAGE_LABEL: Record<StudioStage, string> = {
  starting: 'Starting the voice engine…',
  downloading: 'Downloading Studio Voice…',
  preparing: 'Setting it up on this device…',
  warming: 'Trying out the voice…',
}

export function StudioVoicePanel({
  variant = 'card',
  onInstalled,
  onDismiss,
  dismissLabel = 'Maybe later',
  onChooseAnother,
  chooseAnotherLabel = 'Choose another voice',
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
    /*
     * After the last byte there is a minute or more in which nothing at all is
     * reported, because the runtime is building the graph and then speaking one
     * word to prove it can. A full bar and the word "Preparing" through all of
     * that is the app looking frozen while it works, so the bar goes back to
     * moving of its own accord and the label says which thing is happening.
     */
    const settling = studio.stage === 'preparing' || studio.stage === 'warming'
    return (
      <div
        className={cx(
          'rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-sunken)] p-4',
          className,
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[1rem] font-medium text-ink" role="status">
            {/*
              A second attempt against the other engine is the app fixing
              something, not the app failing. Saying so is more honest than a
              bar that silently restarts, and far more honest than the error it
              replaced.
            */}
            {studio.retrying ? 'Trying another engine…' : STAGE_LABEL[studio.stage]}
          </p>
          <span className="type-meta tabular-nums">
            {settling ? 'almost' : percent == null ? 'starting' : `${percent}%`}
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
              (percent == null || settling) && 'animate-studio-indeterminate w-1/3',
            )}
            style={
              percent == null || settling ? undefined : { width: `${Math.max(2, percent)}%` }
            }
          />
        </div>

        <p className="type-meta mt-3">
          {settling
            ? 'Everything is downloaded. Setting it up can take a minute on a phone — it only happens once.'
            : `${
                studio.total > 0
                  ? `${megabytes(studio.loaded)} of ${megabytes(studio.total)}. `
                  : ''
              }Downloaded once. Generated privately on this device.`}
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

  if (variant === 'compact') {
    return (
      <div
        className={cx(
          'rounded-[1.15rem] border px-4 py-3',
          failed
            ? 'border-[var(--gold)] bg-[var(--gold-soft)]'
            : 'border-[var(--border)] bg-[var(--surface-sunken)]',
          className,
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--rose-soft)] text-[0.9rem] text-[var(--rose-deep)]"
          >
            <SparkIcon />
          </span>
          <p className="min-w-0 grow text-[0.95rem] font-medium text-ink">
            Studio Voice
          </p>
          <p className="type-meta shrink-0 text-[0.76rem]">
            ~{STUDIO_DOWNLOAD_MB} MB
          </p>
        </div>

        <p className="mt-1.5 text-[0.84rem] leading-snug text-ink-muted">
          {failed
            ? explainFailure(studio.failure)
            : 'Private · Free · Offline after setup'}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              cue('start')
              studio.install()
            }}
          >
            {failed ? 'Try again' : 'Install Studio Voice'}
          </Button>
          {failed && onChooseAnother && (
            <Button
              size="sm"
              onClick={() => {
                cue('tap')
                onChooseAnother()
              }}
            >
              {chooseAnotherLabel}
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                cue('tap')
                onDismiss()
              }}
            >
              {dismissLabel}
            </Button>
          )}
        </div>

        {failed && (
          <>
            <FailureDetail message={studio.message} trail={studio.trail} />
            <StartOver onStartOver={studio.startOver} />
          </>
        )}
      </div>
    )
  }

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
            {failed && onChooseAnother && (
              <Button
                size="md"
                onClick={() => {
                  cue('tap')
                  onChooseAnother()
                }}
              >
                {chooseAnotherLabel}
              </Button>
            )}
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

          {failed && (
          <>
            <FailureDetail message={studio.message} trail={studio.trail} />
            <StartOver onStartOver={studio.startOver} />
          </>
        )}

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
 * The engine's own words, folded away.
 *
 * Nobody needs to read "no available backend found" to use this app, and the
 * one person who does need it — somebody reporting that Studio Voice will not
 * install on their machine — currently has no way to get at it at all. One
 * line of detail behind a summary costs a person who does not care nothing,
 * and it is the difference between a bug report that can be acted on and one
 * that says "it does not work".
 */
function FailureDetail({
  message,
  trail,
}: {
  message: string | null
  trail: string[]
}) {
  const [copied, setCopied] = useState(false)
  const report = trail.length > 0 ? trail.join('\n') : (message ?? '')
  if (!report) return null

  return (
    <details className="mt-2 text-[0.78rem] text-ink-faint">
      <summary className="interactive cursor-pointer rounded-pill py-1 hover:text-ink-muted">
        What the engine reported
      </summary>
      {/*
        Every attempt, in order, rather than only the last one. "wasm failed"
        and "the GPU failed and then wasm failed" are different problems with
        different answers, and the difference is invisible from the final
        message alone.
      */}
      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[0.72rem] leading-relaxed">
        {report}
      </pre>
      <button
        type="button"
        onClick={() => {
          cue('tap')
          void navigator.clipboard?.writeText(report).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }}
        className="interactive mt-1.5 min-h-11 rounded-pill underline decoration-[var(--border-strong)] underline-offset-4 hover:text-ink"
      >
        {copied ? 'Copied' : 'Copy this'}
      </button>
    </details>
  )
}

/**
 * The way out of a copy that will not work, however it got that way.
 *
 * Quiet, and below everything else, because "Try again" is right nearly always
 * — the files already on the device are what make a second attempt cheap, and
 * throwing them away to make a point would cost somebody another ninety
 * megabytes for nothing.
 *
 * It exists because for every failure this app cannot name there was
 * previously no next step at all. Everything the install downloads lives in
 * caches this app cannot reach from any screen, so a device holding something
 * unusable would fail identically for ever, and the only remedy anybody could
 * offer was clearing site data — which takes the person's saved loops with it.
 * One sentence and one press is a better answer than that.
 */
function StartOver({ onStartOver }: { onStartOver: () => void }) {
  const [asked, setAsked] = useState(false)

  if (!asked) {
    return (
      <button
        type="button"
        onClick={() => {
          cue('tap')
          setAsked(true)
        }}
        className="interactive mt-1 block min-h-11 rounded-pill text-[0.78rem] text-ink-faint underline decoration-[var(--border-strong)] underline-offset-4 hover:text-ink-muted"
      >
        Still failing? Start the download over
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-[1rem] border border-[var(--border)] p-3">
      <p className="text-[0.82rem] leading-snug text-ink-muted">
        This throws away everything already downloaded and fetches all{' '}
        {STUDIO_DOWNLOAD_MB} MB again. Worth it when the same error keeps
        coming back; a waste of a download otherwise.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            cue('start')
            setAsked(false)
            onStartOver()
          }}
        >
          Download it again
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            cue('tap')
            setAsked(false)
          }}
        >
          Not now
        </Button>
      </div>
    </div>
  )
}

/**
 * What went wrong, in a sentence somebody can act on.
 *
 * None of these blame the person and none of them are dead ends — the button
 * beside them says "Try again", there is a way to choose another voice next to
 * it, and the app is still perfectly usable if they never press either.
 *
 * Each sentence has to survive a harder test than sounding kind: the advice in
 * it has to be capable of working. For a long time every failure here arrived
 * as `unsupported` and was reported as a memory problem, so people were told
 * to close their tabs for a fault that was the engine being fetched from a CDN
 * their browser would not allow. `runtime` exists to separate those, and the
 * app now recovers from it by itself before anybody reads this at all.
 */
export function explainFailure(failure: string | null): string {
  switch (failure) {
    case 'download':
      /*
       * It does not, in fact, pick up where it left off, and saying so was a
       * small lie with a real cost: a browser only stores a file once the whole
       * of it has arrived, so a connection that drops at eighty megabytes
       * leaves nothing behind. Somebody deciding whether to retry on a train
       * deserves to know that. Files that *did* complete are kept, which is
       * what makes a second attempt shorter rather than free.
       */
      return 'The download did not finish. Whole files already fetched are kept, but the one that was interrupted starts again — so it is worth waiting for a steadier connection.'
    case 'storage':
      return 'There was not enough room to store the voice. Freeing some space — or leaving private browsing, which does not allow it at all — will let it through.'
    case 'runtime':
      return 'The voice engine could not be loaded. A content or script blocker is the usual cause, so allowing this site and trying once more is the thing most likely to work.'
    case 'corrupt':
      return 'The copy that was downloaded turned out to be damaged, so it has been thrown away. Trying again fetches a clean one — this is not the same as the attempt that just failed.'
    case 'timeout':
      return 'Nothing happened for long enough that waiting further would not have been honest. Trying again is worth it: whatever finished downloading is still here.'
    case 'unsupported':
      return 'This device could not start the voice engine. It is usually memory: closing other tabs and trying once more often works.'
    default:
      return 'Studio Voice could not be set up just now.'
  }
}
