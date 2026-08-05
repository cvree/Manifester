import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'

/**
 * Level 2 of the surface system.
 *
 * `panel` is the everyday elevated surface. `stage` is the one screen-defining
 * surface per route — bigger radius, deeper shadow, a warm bloom at its top
 * edge. `quiet` groups related things inside a panel without adding a second
 * shadow. Nothing in the app should use all three the same way, which is the
 * whole point of naming them.
 */
type Level = 'panel' | 'stage' | 'quiet'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  /** Rendered top-right, beside the title. */
  action?: ReactNode
  level?: Level
  /** Drop the built-in padding for full-bleed content. */
  bare?: boolean
  children: ReactNode
}

const LEVELS: Record<Level, string> = {
  panel: 'surface-panel',
  stage: 'surface-stage',
  quiet: 'surface-quiet',
}

const PADDING: Record<Level, string> = {
  panel: 'p-5 sm:p-6',
  stage: 'p-5 sm:p-7',
  quiet: 'p-4 sm:p-5',
}

export function Card({
  title,
  description,
  action,
  level = 'panel',
  bare = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <section
      {...props}
      className={cx(
        LEVELS[level],
        !bare && PADDING[level],
        'relative overflow-hidden',
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="type-heading">{title}</h2>}
            {description && <p className="type-meta mt-1.5">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/** A quiet label above a control group. */
export function FieldLabel({
  children,
  hint,
  htmlFor,
}: {
  children: ReactNode
  hint?: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="type-label">
        {children}
      </label>
      {hint && (
        <span className="text-[0.8125rem] tabular-nums text-ink-muted">{hint}</span>
      )}
    </div>
  )
}

/** A section heading used on the page itself rather than inside a card. */
export function SectionHeading({
  children,
  hint,
}: {
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="type-heading">{children}</h2>
      {hint && <span className="type-meta shrink-0">{hint}</span>}
    </div>
  )
}
