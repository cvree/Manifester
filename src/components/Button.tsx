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
  /**
   * What the button says while it is loading.
   *
   * Optional only because a handful of callers already swap their own label.
   * Everywhere else it is the whole point: a spinner says "something",
   * "Saving your recording…" says what. Write it in the present tense, in the
   * words somebody would use out loud.
   */
  loadingLabel?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: cx(
    'border-transparent text-[var(--bg-0)]',
    'bg-[linear-gradient(175deg,color-mix(in_oklab,var(--rose-deep)_86%,white)_0%,var(--rose-deep)_62%)]',
    // The glow deepens on hover as well as brightening, so the whole button
    // reads as lifting off the page rather than just changing colour.
    'shadow-[0_1px_0_rgb(255_255_255/0.28)_inset,0_8px_24px_-10px_var(--glow)]',
    'hover:brightness-[1.05] hover:shadow-[0_1px_0_rgb(255_255_255/0.3)_inset,0_14px_30px_-10px_var(--glow)]',
    'active:brightness-[0.97]',
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

/*
 * Ghost is the only variant that should not float. It has no border and no
 * fill, so lifting it detaches a piece of text from the page with nothing
 * underneath it — the hover tint is the whole affordance there.
 */
const RAISED: Record<Variant, boolean> = {
  primary: true,
  secondary: true,
  ghost: false,
  danger: true,
}

const SIZES: Record<Size, string> = {
  sm: 'min-h-11 px-3.5 text-[0.9rem] rounded-[0.875rem]',
  md: 'min-h-11 px-4 text-[0.95rem] rounded-[1rem]',
  lg: 'min-h-[3.25rem] px-6 text-[1.02rem] rounded-[1.15rem]',
  xl: 'min-h-[3.75rem] px-7 text-[1.08rem] rounded-[1.35rem]',
}

/**
 * The one button in the app.
 *
 * `loading` is three things at once, and it has to be all three: the label
 * changes to say what is happening, a spinner turns beside it, and a band
 * travels across the foot of the button. Any one of them alone is missable —
 * the label by somebody who was already looking away, the spinner by anybody
 * holding a phone at arm's length — and a press that appears to do nothing is
 * the one moment people decide the app is broken and press it again.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  leading,
  trailing,
  loading = false,
  loadingLabel,
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
        'interactive relative inline-flex items-center justify-center gap-2.5 border font-medium',
        RAISED[variant] && 'pressable',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner /> : leading}
      {loading && loadingLabel != null ? loadingLabel : children}
      {trailing}
      {loading && <BusyStrip />}
    </button>
  )
}

/**
 * A ring that draws itself round rather than spinning a sprite — it keeps the
 * app's "nothing jitters" rule while still reading as work in progress.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'h-[1.05em] w-[1.05em] shrink-0 animate-spin rounded-full border-2 border-[color-mix(in_oklab,currentColor_28%,transparent)] border-t-current',
        className,
      )}
    />
  )
}

/**
 * The travelling band on its own, for the few controls that are hand-built
 * rather than a `Button` — the start button in the ritual preview, the pill
 * row beside it. Those are styled from scratch on purpose; waiting should
 * still look identical everywhere.
 *
 * The host needs `position: relative` and `aria-busy`, the second of which is
 * also what stops it wearing the disabled fade. See `.busy-strip` in
 * `theme.css`.
 */
export function BusyStrip() {
  return <span aria-hidden="true" className="busy-strip" />
}
