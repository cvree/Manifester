import { useId, type ReactNode } from 'react'
import { cx } from '../lib/cx'

interface ToggleProps {
  label: string
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * A switch with the whole row as its target — comfortably tappable on a phone
 * without needing to hit the switch itself.
 */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
  const id = useId()
  const descriptionId = description ? `${id}-description` : undefined

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={descriptionId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'flex w-full items-start gap-4 rounded-2xl border border-transparent py-1 text-left',
        'transition-opacity duration-200',
        disabled && 'opacity-55',
      )}
    >
      <span className="min-w-0 grow">
        <span className="block text-[0.98rem] font-medium text-ink">{label}</span>
        {description && (
          <span
            id={descriptionId}
            className="mt-0.5 block text-[0.84rem] leading-snug text-ink-muted"
          >
            {description}
          </span>
        )}
      </span>

      <span
        aria-hidden="true"
        className={cx(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-pill border transition-colors duration-200 ease-[var(--ease-calm)]',
          checked
            ? 'border-[var(--rose-deep)] bg-[var(--rose-deep)]'
            : 'border-[var(--border-strong)] bg-[var(--surface-sunken)]',
        )}
      >
        <span
          className={cx(
            'absolute top-[3px] h-[1.125rem] w-[1.125rem] rounded-full bg-[var(--bg-0)] shadow-sm',
            'transition-[left] duration-200 ease-[var(--ease-calm)]',
            checked ? 'left-[1.5rem]' : 'left-[3px]',
          )}
        />
      </span>
    </button>
  )
}
