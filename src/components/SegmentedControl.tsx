import type { ReactNode } from 'react'
import { cx } from '../lib/cx'

export interface Segment<T extends string> {
  value: T
  label: ReactNode
  /** Announced to screen readers when the label is an icon or shorthand. */
  ariaLabel?: string
}

interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive technology. */
  label: string
  segments: Array<Segment<T>>
  value: T
  onChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        'flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] p-1',
        className,
      )}
    >
      {segments.map((segment) => {
        const selected = segment.value === value
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={segment.ariaLabel}
            onClick={() => onChange(segment.value)}
            className={cx(
              'min-h-11 flex-1 rounded-[0.85rem] px-3 text-[0.92rem] font-medium',
              'transition-[background-color,color,box-shadow] duration-200 ease-[var(--ease-calm)]',
              selected
                ? 'bg-[var(--surface-strong)] text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {segment.label}
          </button>
        )
      })}
    </div>
  )
}

interface ChipProps {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}

/** A pill-shaped single choice, used for timer presets and voice filters. */
export function Chip({ selected, onClick, children, className }: ChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        'min-h-11 rounded-pill border px-4 text-[0.95rem] font-medium',
        'transition-[background-color,border-color,color] duration-200 ease-[var(--ease-calm)]',
        selected
          ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-[var(--rose-deep)]'
          : 'border-[var(--border)] bg-surface text-ink-muted hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}
