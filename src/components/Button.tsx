import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Stretch to the full width of the container. */
  block?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  /** Swaps the leading slot for a spinner and blocks further presses. */
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: cx(
    'border-transparent text-[var(--bg-0)]',
    'bg-[linear-gradient(175deg,color-mix(in_oklab,var(--rose-deep)_86%,white)_0%,var(--rose-deep)_62%)]',
    'shadow-[0_1px_0_rgb(255_255_255/0.28)_inset,0_8px_24px_-10px_var(--glow)]',
    'hover:brightness-[1.04] active:brightness-95',
  ),
  secondary: cx(
    'border-[var(--control-border)] bg-[var(--control)] text-ink',
    'shadow-[0_1px_0_var(--panel-highlight)_inset]',
    'hover:border-[var(--control-border-hover)] hover:bg-[var(--surface-strong)]',
  ),
  ghost: 'border-transparent bg-transparent text-ink-muted hover:bg-[var(--quiet)] hover:text-ink',
  danger:
    'border-[var(--control-border)] bg-transparent text-[var(--rose-deep)] hover:bg-[var(--rose-soft)]',
}

const SIZES: Record<Size, string> = {
  sm: 'min-h-11 px-3.5 text-[0.9rem] rounded-[0.875rem]',
  md: 'min-h-11 px-4 text-[0.95rem] rounded-[1rem]',
  lg: 'min-h-[3.25rem] px-6 text-[1.02rem] rounded-[1.15rem]',
  xl: 'min-h-[3.75rem] px-7 text-[1.08rem] rounded-[1.35rem]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  leading,
  trailing,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'interactive inline-flex items-center justify-center gap-2.5 border font-medium',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner /> : leading}
      {children}
      {trailing}
    </button>
  )
}

/**
 * A ring that draws itself round rather than spinning a sprite — it keeps the
 * app's "nothing jitters" rule while still reading as work in progress.
 */
function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-[1.05em] w-[1.05em] shrink-0 animate-spin rounded-full border-2 border-[color-mix(in_oklab,currentColor_28%,transparent)] border-t-current"
    />
  )
}
