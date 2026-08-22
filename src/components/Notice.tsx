import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import { CloseIcon } from './Icons'

interface NoticeProps {
  children: ReactNode
  /** Offered only when the message is one somebody can be finished with. */
  onDismiss?: () => void
  className?: string
}

/**
 * The one way this app tells somebody something went sideways.
 *
 * Create and the Player each carried their own copy of this markup, which is
 * how the same warm gold panel ended up with two dismiss buttons written twice
 * and no guarantee they would stay the same shape.
 */
export function Notice({ children, onDismiss, className }: NoticeProps) {
  return (
    <div
      role="alert"
      className={cx(
        'flex items-start gap-3 rounded-[1.25rem] border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3.5',
        className,
      )}
    >
      <p className="grow text-[0.92rem] leading-relaxed text-ink">{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss this message"
          className="interactive -mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  )
}
