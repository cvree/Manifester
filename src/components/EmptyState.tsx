import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-sunken)] text-[1.6rem] text-[var(--sage)]"
      >
        {icon}
      </span>
      <h3 className="font-display text-[1.3rem] text-ink">{title}</h3>
      <p className="mt-2 max-w-[34ch] text-[0.95rem] leading-relaxed text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
