import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import {
  dismissInstall,
  engagementCount,
  ENGAGEMENT_THRESHOLD,
  isInstallDismissed,
  subscribeEngagement,
} from '../lib/engagement'
import { cue } from '../lib/feedback'
import { useInstallPrompt } from '../lib/install'
import { useSession } from '../state/SessionProvider'
import { Button } from './Button'
import { CloseIcon, DownloadIcon, ShareIcon } from './Icons'

/** A short beat after the qualifying action, so it never interrupts it. */
const APPEAR_DELAY_MS = 2500

/**
 * A compact, contextual suggestion that Manifester can live on the home
 * screen — not a banner parked over the controls.
 *
 * It waits until someone has actually started or saved a loop, appears once
 * as a small card, remembers being dismissed, and never renders while a
 * session is running. The full instructions live on the About screen, which
 * is where it sends you if the browser has no native prompt to offer.
 */
export function InstallPrompt() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { platform, installed, canPrompt, install } = useInstallPrompt()
  const [ready, setReady] = useState(false)

  const engaged = useSyncExternalStore(
    subscribeEngagement,
    () => engagementCount() >= ENGAGEMENT_THRESHOLD && !isInstallDismissed(),
    () => false,
  )

  useEffect(() => {
    if (!engaged || installed) {
      setReady(false)
      return
    }
    const timeout = window.setTimeout(() => setReady(true), APPEAR_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [engaged, installed])

  const close = () => {
    cue('tap')
    dismissInstall()
    setReady(false)
  }

  // Never on top of a live session, and never before it has been earned.
  if (!ready || !engaged || installed || session.status !== 'idle') return null

  return (
    <div
      role="status"
      className="animate-sheet-in pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 px-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:px-0"
    >
      <div className="surface-sheet pointer-events-auto mx-auto flex w-full max-w-md items-start gap-3 rounded-[1.25rem] p-4 lg:mx-0 lg:w-[22rem]">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-[var(--sage-soft)] text-[1.05rem] text-[var(--sage)]"
        >
          <DownloadIcon />
        </span>

        <div className="min-w-0 grow">
          <p className="text-[0.95rem] font-medium text-ink">
            Keep it on your home screen
          </p>
          <p className="mt-0.5 text-[0.85rem] leading-snug text-ink-muted">
            It opens full screen and works with no connection.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {canPrompt ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  void install()
                  close()
                }}
              >
                Install
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigate('/about')
                  close()
                }}
              >
                {platform === 'ios' ? 'Show me how' : 'How to install'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={close}>
              Not now
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Dismiss the install suggestion"
          className="interactive -mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-faint hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

/** The full, platform-aware instructions used on the About screen. */
export function InstallInstructions() {
  const { platform, installed, canPrompt, install } = useInstallPrompt()

  if (installed) {
    return (
      <p className="type-body">
        Manifester is already running from your home screen. Nothing else to do —
        enjoy it.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {canPrompt && (
        <Button variant="primary" block size="lg" onClick={() => void install()}>
          Install Manifester
        </Button>
      )}

      <div className="space-y-3">
        <h3 className="type-subheading">
          iPhone and iPad{platform === 'ios' && ' — you are here'}
        </h3>
        <ol className="type-body space-y-2">
          <li>
            <strong className="font-medium text-ink">1.</strong> Open this page in
            Safari (not Chrome — only Safari can add to the home screen on iOS).
          </li>
          <li className="flex items-start gap-2">
            <span>
              <strong className="font-medium text-ink">2.</strong> Tap the Share
              button
            </span>
            <ShareIcon className="mt-1 shrink-0 text-[1.05rem] text-[var(--rose-deep)]" />
          </li>
          <li>
            <strong className="font-medium text-ink">3.</strong> Scroll down and tap{' '}
            <em className="not-italic text-ink">Add to Home Screen</em>.
          </li>
          <li>
            <strong className="font-medium text-ink">4.</strong> Tap{' '}
            <em className="not-italic text-ink">Add</em>. Manifester will appear
            with your other apps.
          </li>
        </ol>
      </div>

      <div className="space-y-3">
        <h3 className="type-subheading">
          Android{platform === 'android' && ' — you are here'}
        </h3>
        <ol className="type-body space-y-2">
          <li>
            <strong className="font-medium text-ink">1.</strong> Open this page in
            Chrome.
          </li>
          <li>
            <strong className="font-medium text-ink">2.</strong> Tap the ⋮ menu, then{' '}
            <em className="not-italic text-ink">Install app</em> or{' '}
            <em className="not-italic text-ink">Add to Home screen</em>.
          </li>
          <li>
            <strong className="font-medium text-ink">3.</strong> Confirm, and it is
            done.
          </li>
        </ol>
      </div>

      <div className="space-y-3">
        <h3 className="type-subheading">Desktop</h3>
        <p className="type-body">
          In Chrome or Edge, look for the install icon at the right-hand end of the
          address bar.
        </p>
      </div>
    </div>
  )
}
