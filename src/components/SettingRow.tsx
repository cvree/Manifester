import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import { ChevronIcon } from './Icons'

interface SettingRowProps {
  icon: ReactNode
  title: string
  /** The state of this setting at a glance, e.g. `"Moon Garden · 25%"`. */
  summary: string
  onClick: () => void
  /** Marks the row as carrying something the user set up deliberately. */
  accent?: boolean
}

/**
 * One line of the "Customize your ritual" list.
 *
 * The summary is the whole idea: you should be able to read the state of every
 * advanced setting without opening anything, which is what turns a settings
 * form back into a single calm surface.
 */
export function SettingRow({
  icon,
  title,
  summary,
  onClick,
  accent = false,
}: SettingRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'interactive group flex min-h-[4.25rem] w-full items-center gap-4 px-4 py-3 text-left sm:px-5',
        'border-b border-[var(--quiet-border)] last:border-b-0',
        // A row is part of a list, so it tints rather than lifts — but the
        // press still has to register, hence the darker active state.
        'hover:bg-[var(--quiet)] active:bg-[var(--control-sunken)]',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] text-[1.05rem] transition-colors duration-200',
          accent
            ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
            : 'bg-[var(--quiet)] text-ink-muted group-hover:text-ink',
        )}
      >
        {icon}
      </span>

      <span className="min-w-0 grow">
        <span className="block text-[0.98rem] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-[0.85rem] text-ink-muted">
          {summary}
        </span>
      </span>

      <ChevronIcon
        aria-hidden="true"
        className="shrink-0 -rotate-90 text-[1.05rem] text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </button>
  )
}
