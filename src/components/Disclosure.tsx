import { useId, useState, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { ChevronIcon } from './Icons'

interface DisclosureProps {
  title: string
  /** A short summary of what is inside, shown while collapsed. */
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

/**
 * Progressive disclosure: the everyday controls stay on screen, and the fiddly
 * ones live behind one of these. Animated with a grid-row trick so the height
 * transition works without measuring anything.
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div
      className={cx(
        'overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-sunken)]',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[0.98rem] font-medium text-ink">{title}</span>
          {summary && !open && (
            <span className="block truncate text-[0.85rem] text-ink-faint">
              {summary}
            </span>
          )}
        </span>
        <ChevronIcon
          className={cx(
            'shrink-0 text-[1.1rem] text-ink-faint transition-transform duration-300 ease-[var(--ease-calm)]',
            open && '-rotate-180',
          )}
        />
      </button>

      <div
        id={panelId}
        className={cx(
          'grid transition-[grid-template-rows] duration-300 ease-[var(--ease-calm)]',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        {/*
          `visibility` keeps collapsed content out of the tab order and away
          from screen readers. It transitions discretely, so it stays visible
          for the whole closing animation and only then flips to hidden.
        */}
        <div
          className={cx(
            'overflow-hidden transition-[visibility] duration-300',
            !open && 'invisible',
          )}
        >
          <div className="space-y-5 border-t border-[var(--border)] px-4 pt-4 pb-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
