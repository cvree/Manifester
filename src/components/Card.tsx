import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  /** Rendered top-right, beside the title. */
  action?: ReactNode
  children: ReactNode
}

export function Card({
  title,
  description,
  action,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <section
      {...props}
      className={cx('surface-card relative overflow-hidden p-5 sm:p-6', className)}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-[1.35rem] leading-tight text-ink">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-[0.9rem] leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
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
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <label
        htmlFor={htmlFor}
        className="text-[0.8rem] font-medium uppercase tracking-[0.09em] text-ink-faint"
      >
        {children}
      </label>
      {hint && <span className="text-[0.82rem] text-ink-muted">{hint}</span>}
    </div>
  )
}
