import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Stretch to the full width of the container. */
  block?: boolean
  leading?: ReactNode
  trailing?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--rose-deep)] text-[var(--bg-0)] border-transparent shadow-[0_6px_20px_-8px_var(--glow)] hover:brightness-105 active:brightness-95',
  secondary:
    'bg-surface-strong text-ink border-[var(--border-strong)] hover:bg-[var(--surface-strong)] active:scale-[.99]',
  ghost:
    'bg-transparent text-ink-muted border-transparent hover:bg-[var(--surface-sunken)] hover:text-ink',
  danger:
    'bg-transparent text-[var(--rose-deep)] border-[var(--border-strong)] hover:bg-[var(--rose-soft)]',
}

const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-4 text-[0.95rem] rounded-2xl',
  lg: 'min-h-14 px-6 text-[1.05rem] rounded-[1.25rem]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  leading,
  trailing,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 border font-medium',
        'transition-[transform,background-color,filter,border-color] duration-200 ease-[var(--ease-calm)]',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {leading}
      {children}
      {trailing}
    </button>
  )
}
