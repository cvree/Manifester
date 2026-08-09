import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from '../lib/cx'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: these buttons have no visible text. */
  label: string
  icon: ReactNode
  tone?: 'neutral' | 'danger'
  /** For the callers that have to position something against this button. */
  ref?: Ref<HTMLButtonElement>
}

/** A 44×44 tap target — the smallest comfortable size on a phone. */
export function IconButton({
  label,
  icon,
  tone = 'neutral',
  className,
  ref,
  ...props
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        // `interactive` carries the cursor, the press and the transition —
        // a bare `transition-colors` here would override that shorthand and
        // silently drop the transform, leaving the press unanimated.
        'interactive pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-[1.15rem]',
        'border-[var(--border)] bg-surface',
        'hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger'
          ? 'text-[var(--rose-deep)] hover:bg-[var(--rose-soft)]'
          : 'text-ink-muted hover:text-ink',
        className,
      )}
    >
      {icon}
    </button>
  )
}
