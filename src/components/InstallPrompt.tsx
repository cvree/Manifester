import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useInstallPrompt } from '../lib/install'
import { readLocal, writeLocal } from '../lib/storage'
import { useSession } from '../state/SessionProvider'
import { Button } from './Button'
import { CloseIcon, DownloadIcon, ShareIcon } from './Icons'

const DISMISS_KEY = 'installDismissed'
const APPEAR_DELAY_MS = 6000

/** A quiet, one-time nudge that the app can live on the home screen. */
export function InstallPrompt() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { platform, installed, canPrompt, install } = useInstallPrompt()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (installed || readLocal(DISMISS_KEY) === '1') return
    const timeout = window.setTimeout(() => setVisible(true), APPEAR_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [installed])

  const dismiss = () => {
    writeLocal(DISMISS_KEY, '1')
    setVisible(false)
  }

  // Never cover the mini-player during a session.
  if (!visible || installed || session.status !== 'idle') return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 px-4">
      <div className="surface-sheet mx-auto flex w-full max-w-2xl items-center gap-3 rounded-[1.25rem] px-4 py-3.5 shadow-[var(--shadow-lift)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sage-soft)] text-[1.1rem] text-[var(--sage)]">
          <DownloadIcon />
        </span>
        <div className="min-w-0 grow">
          <p className="text-[0.95rem] font-medium text-ink">
            Keep Manifester on your home screen
          </p>
          <p className="text-[0.84rem] leading-snug text-ink-muted">
            It opens full screen and works without a connection.
          </p>
        </div>
        {canPrompt ? (
          <Button
            variant="primary"
            onClick={() => {
              void install()
              dismiss()
            }}
          >
            Install
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              navigate('/about')
              dismiss()
            }}
          >
            {platform === 'ios' ? 'How' : 'Show me'}
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss the install suggestion"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
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
      <p className="text-[0.95rem] leading-relaxed text-ink-muted">
        Manifester is already running from your home screen. Nothing else to do —
        enjoy it.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {canPrompt && (
        <Button variant="primary" block size="lg" onClick={() => void install()}>
          Install Manifester
        </Button>
      )}

      <div className="space-y-3">
        <h3 className="font-display text-[1.15rem] text-ink">
          iPhone and iPad{platform === 'ios' && ' — you are here'}
        </h3>
        <ol className="space-y-2 text-[0.95rem] leading-relaxed text-ink-muted">
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
        <h3 className="font-display text-[1.15rem] text-ink">
          Android{platform === 'android' && ' — you are here'}
        </h3>
        <ol className="space-y-2 text-[0.95rem] leading-relaxed text-ink-muted">
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
        <h3 className="font-display text-[1.15rem] text-ink">Desktop</h3>
        <p className="text-[0.95rem] leading-relaxed text-ink-muted">
          In Chrome or Edge, look for the install icon at the right-hand end of the
          address bar.
        </p>
      </div>
    </div>
  )
}
