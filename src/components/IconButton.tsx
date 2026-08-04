import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: these buttons have no visible text. */
  label: string
  icon: ReactNode
  tone?: 'neutral' | 'danger'
}

/** A 44×44 tap target — the smallest comfortable size on a phone. */
export function IconButton({
  label,
  icon,
  tone = 'neutral',
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-[1.15rem]',
        'border-[var(--border)] bg-surface transition-colors duration-200',
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
